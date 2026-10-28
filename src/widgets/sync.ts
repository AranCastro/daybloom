/**
 * Keeps home-screen widgets in step with the app: any change to the saved state
 * redraws every widget the user has placed. A no-op off Android.
 */
import { AppState, Platform } from 'react-native';
import { getWidgetInfo, requestWidgetUpdate, requestWidgetUpdateById, type WidgetInfo } from 'react-native-android-widget';

import { dayKey } from '@/lib/dates';
import { occursOn, type Routine, toMinutes } from '@/lib/routines';
import { ensureRoutines, getState, subscribe } from '@/lib/store';
import { renderFor, WIDGETS } from '@/widgets/catalogue';

/** The pending debounced redraw, cancelled when a redraw happens anyway. */
let pending: ReturnType<typeof setTimeout> | undefined;

/**
 * Redraws every placed widget. `except` is one widget already drawn (the one just tapped); other
 * copies of the same kind on the home screen are still redrawn, by id.
 */
export async function refreshWidgets(except?: Pick<WidgetInfo, 'widgetName' | 'widgetId'>): Promise<void> {
  if (Platform.OS !== 'android') return;
  // This draws the current state, so a redraw already queued for the same changes is not needed.
  clearTimeout(pending);
  const state = getState();
  await Promise.all(
    WIDGETS.map(async (w) => {
      // Every name in WIDGETS has a renderer, so this is never null.
      const renderWidget = (info: WidgetInfo) => renderFor(w.name, state, info.width, info.height)!;
      if (w.name !== except?.widgetName) return requestWidgetUpdate({ widgetName: w.name, renderWidget });
      const others = (await getWidgetInfo(w.name)).filter((i) => i.widgetId !== except.widgetId);
      await Promise.all(others.map((i) => requestWidgetUpdateById({ widgetName: w.name, widgetId: i.widgetId, renderWidget })));
    }).map((p) => p.catch(() => undefined)),
  );
}

/**
 * Home-screen widgets cannot count down on their own (the library has no timer view, and Android
 * redraws them at most every 30 minutes), so while the app is running, the Focus widget is redrawn
 * when the session ends. With the app closed it shows the end time, which stays true, and the
 * next tap or app launch redraws it.
 */
let focusTimer: ReturnType<typeof setTimeout> | undefined;
let focusEnd: number | null = null;

function watchFocusEnd() {
  const endAt = getState().focus.active?.endAt ?? null;
  if (endAt === focusEnd) return;
  focusEnd = endAt;
  clearTimeout(focusTimer);
  if (endAt !== null) focusTimer = setTimeout(() => refreshWidgets(), Math.max(0, endAt - Date.now()) + 1000);
}

/** The next moment the widgets go out of date on their own: a routine's next time today, or midnight. */
export function nextRedrawAt(routines: Routine[], now = new Date()): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const today = dayKey(now);
  let next = midnight;
  for (const r of routines) {
    if (!occursOn(r, today)) continue;
    for (const time of r.times) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, toMinutes(time)).getTime();
      if (at > now.getTime() && at < next) next = at;
    }
  }
  return next;
}

/**
 * For the same reason, while the app is running the widgets are also redrawn at midnight (a new day:
 * mood, streak, today's tasks) and when a routine's next time comes (its new task takes over).
 */
let dayTimer: ReturnType<typeof setTimeout> | undefined;
let plannedFor: Routine[] | null = null;

function planRedraw() {
  const { routines } = getState();
  plannedFor = routines;
  clearTimeout(dayTimer);
  const at = nextRedrawAt(routines);
  // A second late, so the new minute (or day) has surely begun.
  dayTimer = setTimeout(() => {
    ensureRoutines();
    void refreshWidgets();
    planRedraw();
  }, Math.max(0, at - Date.now()) + 1000);
}

/** Starts redrawing widgets after changes (debounced). Returns a stop function. */
export function startWidgetSync(): () => void {
  if (Platform.OS !== 'android') return () => {};
  const unsubscribe = subscribe(() => {
    clearTimeout(pending);
    pending = setTimeout(() => refreshWidgets(), 600);
    watchFocusEnd();
    // A routine added or changed may bring the next redraw forward.
    if (getState().routines !== plannedFor) planRedraw();
  });
  refreshWidgets();
  watchFocusEnd();
  planRedraw();
  // Coming back to the app (for example the next morning) redraws them too, so "today" is right.
  const sub = AppState.addEventListener('change', (s) => {
    if (s !== 'active') return;
    refreshWidgets();
    // The clock may have moved on, or to another time zone, while the app was away.
    planRedraw();
  });
  return () => {
    clearTimeout(pending);
    clearTimeout(focusTimer);
    clearTimeout(dayTimer);
    focusEnd = null;
    plannedFor = null;
    unsubscribe();
    sub.remove();
  };
}
