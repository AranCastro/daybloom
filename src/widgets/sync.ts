/**
 * Keeps home-screen widgets in step with the app: any change to the saved state
 * redraws every widget the user has placed. A no-op off Android.
 */
import { AppState, Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { getState, subscribe } from '@/lib/store';
import { renderFor, WIDGETS } from '@/widgets/catalogue';

/** The pending debounced redraw, cancelled when a redraw happens anyway. */
let pending: ReturnType<typeof setTimeout> | undefined;

export async function refreshWidgets(except?: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  // This draws the current state, so a redraw already queued for the same changes is not needed.
  clearTimeout(pending);
  const state = getState();
  await Promise.all(
    WIDGETS.filter((w) => w.name !== except).map((w) =>
      requestWidgetUpdate({
        widgetName: w.name,
        // Every name in WIDGETS has a renderer, so this is never null.
        renderWidget: (info) => renderFor(w.name, state, info.width, info.height)!,
      }).catch(() => undefined),
    ),
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

/** Starts redrawing widgets after changes (debounced). Returns a stop function. */
export function startWidgetSync(): () => void {
  if (Platform.OS !== 'android') return () => {};
  const unsubscribe = subscribe(() => {
    clearTimeout(pending);
    pending = setTimeout(() => refreshWidgets(), 600);
    watchFocusEnd();
  });
  refreshWidgets();
  watchFocusEnd();
  // Coming back to the app (for example the next morning) redraws them too, so "today" is right.
  const sub = AppState.addEventListener('change', (s) => s === 'active' && refreshWidgets());
  return () => {
    clearTimeout(pending);
    clearTimeout(focusTimer);
    focusEnd = null;
    unsubscribe();
    sub.remove();
  };
}
