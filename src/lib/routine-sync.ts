/**
 * Keeps routines running while the app is in use: adds each day's routine tasks (at start-up, on
 * returning to the app and just after midnight) and keeps their quiet reminders in step with the
 * routines and with what has been ticked. Widgets and notification buttons call ensureRoutines
 * themselves, so routine tasks also appear when the app has not been opened.
 */
import { AppState as RNAppState } from 'react-native';

import { dayKey } from '@/lib/dates';
import { syncRoutineReminders } from '@/lib/reminders';
import { ensureRoutines, getState, subscribe } from '@/lib/store';

/** What the reminders depend on: the routines and which routine tasks are done. */
function signature(): string {
  const s = getState();
  const done = s.tasks.filter((t) => t.routineId && t.done).map((t) => t.id);
  return JSON.stringify([s.routines, done]);
}

/** Schedules the reminders now; `ask` may show the notification permission prompt. */
export function syncRoutinesNow(ask = false): Promise<void> {
  const s = getState();
  return syncRoutineReminders(s.routines, s.tasks, ask);
}

export function startRoutineSync(): () => void {
  let day = dayKey();
  let last = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    const sig = signature();
    if (sig === last) return;
    last = sig;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncRoutinesNow(), 1500);
  };
  const refresh = () => {
    day = dayKey();
    ensureRoutines(day);
    // The week of reminders moves forward each day even when nothing else changed.
    last = '';
    schedule();
  };
  refresh();
  const unsub = subscribe(schedule);
  const app = RNAppState.addEventListener('change', (st) => st === 'active' && refresh());
  const tick = setInterval(() => {
    if (dayKey() !== day) refresh();
  }, 60_000);
  return () => {
    unsub();
    app.remove();
    clearInterval(tick);
    if (timer) clearTimeout(timer);
  };
}
