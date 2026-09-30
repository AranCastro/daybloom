/**
 * Runs in the background when Android asks for a widget update or a widget is tapped.
 * Taps that open a screen are handled natively (OPEN_URI); this handles the rest:
 *   MOOD       check in from the home screen
 *   TASK_DONE    tick off a task (grows a flower, as in the app); a task with steps ticks its next step
 *   TASK_TOGGLE  tick or untick a task from the matrix widget (unticking takes its flower back)
 *   WIDGET_UNDO  put back the task last ticked off from this widget
 *   WIDGET_LOCK  lock or unlock ticking on this widget (locked, task taps open the app)
 *   FOCUS_START / FOCUS_PAUSE / FOCUS_RESUME / FOCUS_STOP  the Pomodoro widget's buttons
 */
import { Platform } from 'react-native';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { stepProgress } from '@/lib/effort';
import { FocusPreset, pauseTimer, PRESETS, resumeTimer, startFocus, stopTimer } from '@/lib/focus';
import { flowerOf } from '@/lib/flowers';
import { moodOf, MoodValue } from '@/lib/moods';
import { syncRoutineReminders } from '@/lib/reminders';
import { awardBadges, ensureRoutines, flushState, getState, recordMood, reloadState, TaskWidget, toggleWidgetLock, WIDGET_UNDO_MS, widgetTickTask, widgetUndo } from '@/lib/store';
import { FLASH_MS, renderFor, setFlash } from '@/widgets/catalogue';
import { refreshWidgets } from '@/widgets/sync';
import { syncFocusDnd } from '@/lib/focus-dnd';

export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return;
  const name = widgetInfo.widgetName;
  // Silent: this handler redraws the widgets itself below, so the reload need not trigger another redraw.
  reloadState({ silent: true });
  // A new day adds its routine tasks (and the next week of their reminders) even if the app is not opened.
  let routinesChanged = ensureRoutines();

  if (widgetAction === 'WIDGET_CLICK') {
    const before = getState().garden.length;

    if (clickAction === 'MOOD') {
      const value = Number(clickActionData?.value) as MoodValue;
      if (moodOf(value)) {
        await recordMood(value);
        awardBadges();
        const grew = getState().garden.length > before ? ` · ${flowerOf(getState().garden[0].flower).name} bloomed` : '';
        setFlash(name, `Noted: ${moodOf(value)?.label}${grew}`);
      }
    }

    if (clickAction === 'TASK_DONE' || clickAction === 'TASK_TOGGLE') {
      const id = String(clickActionData?.id ?? '');
      const widget: TaskWidget = clickAction === 'TASK_DONE' ? 'Tasks' : 'Matrix';
      const changed = widgetTickTask(widget, id, clickAction === 'TASK_DONE' ? 'done' : 'toggle');
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

    if (clickAction === 'FOCUS_START') {
      const preset = String(clickActionData?.preset ?? 'classic') as FocusPreset;
      if (preset in PRESETS && !getState().focus.active) {
        // Awaited: the headless task must not end before the alarm is scheduled.
        await startFocus(preset);
        setFlash(name, `${PRESETS[preset].focus} minutes · go`);
      }
    }
    if (clickAction === 'FOCUS_PAUSE') await pauseTimer();
    if (clickAction === 'FOCUS_RESUME') await resumeTimer();
    if (clickAction === 'FOCUS_STOP') await stopTimer();
    // Do Not Disturb follows the timer here too: the app may not be running to do it.
    if (clickAction?.startsWith('FOCUS_')) syncFocusDnd(getState());

    if (clickAction === 'WIDGET_UNDO') {
      const widget: TaskWidget = clickActionData?.widget === 'Matrix' ? 'Matrix' : 'Tasks';
      if (widgetUndo(widget)) {
        setFlash(name, 'Put back');
        routinesChanged = true;
      }
    }

    if (clickAction === 'WIDGET_LOCK') {
      const widget: TaskWidget = clickActionData?.widget === 'Matrix' ? 'Matrix' : 'Tasks';
      toggleWidgetLock(widget);
      setFlash(name, getState().widgetLocks[widget] ? 'Locked: taps open the app' : 'Unlocked: tap a task to tick it off');
    }
  }

  // Android may stop this background task as soon as it returns: write the tap's changes now.
  flushState();

  if (routinesChanged && getState().routines.length) await syncRoutineReminders(getState().routines, getState().tasks);

  const tree = renderFor(name, getState(), widgetInfo.width, widgetInfo.height);
  if (tree) renderWidget(tree);

  // A tap on one widget changes what the others show (streak, garden, tasks).
  if (widgetAction === 'WIDGET_CLICK') await refreshWidgets(name);

  // Undo and notes like "Done" must not stay on the home screen: Android only redraws widgets now and
  // then, so wait for them to expire and redraw every widget without them. The background task may
  // run for 30 seconds; both last 15.
  if (widgetAction === 'WIDGET_CLICK' && Platform.OS === 'android') {
    await new Promise((r) => setTimeout(r, Math.max(WIDGET_UNDO_MS, FLASH_MS) + 500));
    await refreshWidgets();
  }
}
