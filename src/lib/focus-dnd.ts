/**
 * Do Not Disturb during focus sessions (Android only). The native part (modules/daybloom-dnd)
 * switches the phone to priority-only mode, remembers what was on before, and puts it back when
 * the session ends: on Pause, Stop, a break, or at the end time through an alarm, even if the app
 * has been closed. The user first allows Daybloom in the system's Do Not Disturb access page.
 */
import { requireOptionalNativeModule } from 'expo';
import { useEffect, useState } from 'react';
import { AppState as RNAppState, Platform } from 'react-native';

import type { AppState } from '@/lib/store';

export type DndModule = {
  hasAccess(): boolean;
  isActive(): boolean;
  openAccessSettings(): void;
  start(untilMs: number): boolean;
  stop(): void;
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<DndModule>('DaybloomDnd') : null;

/** Whether this phone can do it at all (Android with the native module). */
export const dndSupported = !!native;

export function dndHasAccess(): boolean {
  try {
    return !!native?.hasAccess();
  } catch {
    return false;
  }
}

/** Opens the system page where the user allows Daybloom to change Do Not Disturb. */
export function openDndAccess(): void {
  try {
    native?.openAccessSettings();
  } catch {
    // No such settings page on this phone.
  }
}

/**
 * Brings Do Not Disturb in line with the focus timer: on while a focus session that asked for it
 * is running, off otherwise. Safe to call often; does nothing without the native module or access.
 */
export function syncFocusDnd(s: Pick<AppState, 'focus'>, now = Date.now(), mod: DndModule | null = native): void {
  if (!mod) return;
  try {
    const a = s.focus.active;
    const want = !!a && a.kind === 'focus' && a.dnd === true && a.endAt !== null && a.endAt > now;
    if (want) mod.start(a!.endAt!);
    else if (mod.isActive()) mod.stop();
  } catch {
    // Access withdrawn meanwhile: the timer carries on without Do Not Disturb.
  }
}

/** Keeps Do Not Disturb in step while the app runs, and re-checks on return (access may be new). */
export function startFocusDndSync(getState: () => AppState, subscribe: (l: () => void) => () => void): () => void {
  if (!native) return () => undefined;
  let last = '';
  const run = () => {
    const a = getState().focus.active;
    const sig = a ? `${a.kind}:${a.endAt}:${a.dnd}` : 'none';
    if (sig === last) return;
    last = sig;
    syncFocusDnd(getState());
  };
  run();
  const unsub = subscribe(run);
  const app = RNAppState.addEventListener('change', (st) => {
    if (st !== 'active') return;
    last = '';
    run();
  });
  return () => {
    unsub();
    app.remove();
  };
}

/** Whether Daybloom may change Do Not Disturb, re-checked each time the app comes back. */
export function useDndAccess(): boolean {
  const [access, setAccess] = useState(dndHasAccess);
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (st) => st === 'active' && setAccess(dndHasAccess()));
    return () => sub.remove();
  }, []);
  return access;
}
