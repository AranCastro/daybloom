/**
 * Keeps home-screen widgets in step with the app: any change to the saved state
 * redraws every widget the user has placed. A no-op off Android.
 */
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { getState, subscribe } from '@/lib/store';
import { renderFor, WIDGETS } from '@/widgets/catalogue';

export async function refreshWidgets(except?: string): Promise<void> {
  if (Platform.OS !== 'android') return;
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

/** Starts redrawing widgets after changes (debounced). Returns a stop function. */
export function startWidgetSync(): () => void {
  if (Platform.OS !== 'android') return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => refreshWidgets(), 600);
  });
  refreshWidgets();
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
