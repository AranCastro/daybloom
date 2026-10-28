/**
 * Runs in the background when Android asks for a widget update or a widget is tapped.
 * Taps that open a screen are handled natively (OPEN_URI); this handles the rest:
 *   MOOD       check in from the home screen
 *   TASK_DONE    tick off a task (grows a flower, as in the app); a task with steps ticks its next step
 *   TASK_TOGGLE  tick or untick a task from the matrix widget (unticking takes its flower back)
 *   WIDGET_UNDO  put back the task last ticked off from this widget
 *   WIDGET_LOCK  lock or unlock ticking on this widget (locked, task taps open the app)
 *   FOCUS_START / FOCUS_PAUSE / FOCUS_RESUME / FOCUS_STOP  the Pomodoro widget's buttons (once the
 *                time is up, Pause, Resume and Stop complete the session instead)
 */
import { Platform } from 'react-native';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { dayKey } from '@/lib/dates';
import { stepProgress } from '@/lib/effort';
import { completeIfOver, FocusPreset, pauseTimer, PRESETS, resumeTimer, startFocus, stopTimer } from '@/lib/focus';
import { flowerOf } from '@/lib/flowers';
import { readItem, writeItem } from '@/lib/kv';
import { moodOf, MoodValue } from '@/lib/moods';
import { syncRoutineReminders } from '@/lib/reminders';
import { answeredIn, parseInstanceId } from '@/lib/routines';
import { awardBadges, ensureRoutines, flushState, getState, recordMood, reloadState, setSlotMark, slotMark, TaskWidget, toggleWidgetLock, WIDGET_UNDO_MS, widgetTickTask, widgetUndo } from '@/lib/store';
import { FLASH_MS, renderFor, setFlash } from '@/widgets/catalogue';
import { refreshWidgets } from '@/widgets/sync';
import { syncFocusDnd } from '@/lib/focus-dnd';

/**
 * The day every widget was last redrawn from here. Android updates each kind of widget on its own
 * schedule, so the first update after midnight redraws them all, and none keeps showing yesterday.
 */
const DRAWN_KEY = 'daybloom.widgets-day.v1';

function drawnDay(): string | null {
  try {
    return readItem(DRAWN_KEY);
  } catch {
    return null;
  }
}

function setDrawnDay(day: string) {
  try {
    writeItem(DRAWN_KEY, day);
  } catch {
    // Not saved: the next update redraws them all again, which does no harm.
  }
}

/** The redraw that clears Undo and notes happens by this long after the task starts (Android allows 30 s). */
const CLEANUP_BY_MS = 22_000;

export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return;
  const started = Date.now();
  const name = widgetInfo.widgetName;
  const click = widgetAction === 'WIDGET_CLICK' ? clickAction : undefined;
  // Silent: this handler redraws the widgets itself below, so the reload need not trigger another redraw.
  reloadState({ silent: true });
  const before = getState().garden.length;
  let routinesChanged = false;

  // A task tap comes before the routines move on (below): a widget not redrawn since a routine's next
  // time, or since midnight, still shows the earlier task, and that is the one the tap means.
  if (click === 'TASK_DONE' || click === 'TASK_TOGGLE') {
    const id = String(clickActionData?.id ?? '');
    const widget: TaskWidget = click === 'TASK_DONE' ? 'Tasks' : 'Matrix';
    const gone = getState().tasks.some((t) => t.id === id) ? null : parseInstanceId(id);
    if (gone && !getState().widgetLocks[widget] && getState().routines.some((r) => r.id === gone.routineId)) {
      // Already replaced (the app or another widget moved the routine on): the answer still goes into
      // the routine's history for that day and time, as for a late press on a reminder.
      if (slotMark(getState(), gone.routineId, gone.day, gone.slot) !== 'done') {
        setSlotMark(gone.routineId, gone.day, gone.slot, 'done');
        routinesChanged = true;
        setFlash(name, 'Done');
      }
    } else {
      const changed = widgetTickTask(widget, id, click === 'TASK_DONE' ? 'done' : 'toggle');
      const task = getState().tasks.find((t) => t.id === id);
      // A routine task ticked here must not be reminded about any more.
      if (changed && task?.routineId) routinesChanged = true;
      const b = getState().garden[0];
      const grew = getState().garden.length - before;
      const bloomed = grew > 1 ? ` · ${grew} flowers bloomed` : grew === 1 && b ? ` · ${flowerOf(b.flower).name} bloomed` : '';
      if (changed === 'step' && task) {
        const p = stepProgress(task);
        setFlash(name, `Step done · ${p?.done}/${p?.total}${bloomed}`);
      } else if (changed === 'task' && task?.done) setFlash(name, `Done${bloomed}`);
    }
  }

  // A new day adds its routine tasks (and the next week of their reminders) even if the app is not opened.
  if (ensureRoutines()) routinesChanged = true;

  if (click === 'MOOD') {
    const value = Number(clickActionData?.value) as MoodValue;
    if (moodOf(value)) {
      await recordMood(value);
      awardBadges();
      const grew = getState().garden.length > before ? ` · ${flowerOf(getState().garden[0].flower).name} bloomed` : '';
      setFlash(name, `Noted: ${moodOf(value)?.label}${grew}`);
    }
  }

  if (click === 'FOCUS_START') {
    const preset = String(clickActionData?.preset ?? 'classic') as FocusPreset;
    if (preset in PRESETS && !getState().focus.active) {
      // Awaited: the headless task must not end before the alarm is scheduled.
      await startFocus(preset);
      setFlash(name, `${PRESETS[preset].focus} minutes · go`);
    }
  }
  if (click === 'FOCUS_PAUSE' || click === 'FOCUS_RESUME' || click === 'FOCUS_STOP') {
    // With the app closed the widget is not redrawn when the time is up, so it may still offer Pause
    // and Stop: a finished session is completed (its flower grows) rather than paused or thrown away.
    const over = completeIfOver();
    if (over?.kind === 'focus') setFlash(name, `Session complete · ${over.flower.name} bloomed`);
    else if (over) setFlash(name, 'Break over');
    else if (click === 'FOCUS_PAUSE') await pauseTimer();
    else if (click === 'FOCUS_RESUME') await resumeTimer();
    else {
      await stopTimer();
      setFlash(name, 'Stopped');
    }
  }
  // Do Not Disturb follows the timer here too: the app may not be running to do it.
  if (click?.startsWith('FOCUS_')) syncFocusDnd(getState());

  if (click === 'WIDGET_UNDO') {
    const widget: TaskWidget = clickActionData?.widget === 'Matrix' ? 'Matrix' : 'Tasks';
    if (widgetUndo(widget)) {
      setFlash(name, 'Put back');
      routinesChanged = true;
    }
  }

  if (click === 'WIDGET_LOCK') {
    const widget: TaskWidget = clickActionData?.widget === 'Matrix' ? 'Matrix' : 'Tasks';
    toggleWidgetLock(widget);
    setFlash(name, getState().widgetLocks[widget] ? 'Locked: taps open the app' : 'Unlocked: tap a task to tick it off');
  }

  // Android may stop this background task as soon as it returns: write the tap's changes now.
  flushState();
  const tappedAt = Date.now();

  // The widget tapped (or updated) first, so a tap shows at once.
  const tree = renderFor(name, getState(), widgetInfo.width, widgetInfo.height);
  if (tree) renderWidget(tree);

  // Rescheduling reminders can take a few seconds: it runs while the widgets redraw, and is awaited at the end.
  const reminders = routinesChanged && getState().routines.length ? syncRoutineReminders(getState().routines, getState().tasks, false, new Date(), answeredIn(getState())) : null;

  // A tap on one widget changes what the others show (streak, garden, tasks), and so do a routine's
  // next time and a new day. Other copies of the widget just drawn are redrawn too.
  const today = dayKey();
  if (widgetAction === 'WIDGET_CLICK' || routinesChanged || drawnDay() !== today) {
    await refreshWidgets(widgetInfo);
    setDrawnDay(today);
  }

  // Undo and notes like "Done" must not stay on the home screen: Android only redraws widgets now and
  // then, so wait for them to expire (both last 15 seconds from the tap) and redraw every widget
  // without them. The background task may only run for 30 seconds, so this redraw comes well before
  // that, whatever else took time.
  if (widgetAction === 'WIDGET_CLICK' && Platform.OS === 'android') {
    const at = Math.min(tappedAt + Math.max(WIDGET_UNDO_MS, FLASH_MS) + 500, started + CLEANUP_BY_MS);
    await new Promise((r) => setTimeout(r, Math.max(0, at - Date.now())));
    await refreshWidgets();
  }
  await reminders;
}
