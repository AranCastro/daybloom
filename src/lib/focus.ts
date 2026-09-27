/**
 * Pomodoro focus timer. The running timer is stored as an absolute end time, so it stays
 * correct when the app is backgrounded or closed; an alarm notification fires at the end.
 * Every completed focus session grows one flower in the shared garden.
 */
import { addDays, dayKey } from '@/lib/dates';
import { FlowerKind } from '@/lib/flowers';
import { cancelFocusAlarm, scheduleFocusAlarm } from '@/lib/reminders';
import { bloom, getState, logProgress, update } from '@/lib/store';

export type FocusPreset = 'gentle' | 'classic' | 'deep';

export const PRESETS: Record<FocusPreset, { label: string; focus: number; rest: number }> = {
  gentle: { label: 'Gentle', focus: 15, rest: 3 },
  classic: { label: 'Classic', focus: 25, rest: 5 },
  deep: { label: 'Deep', focus: 50, rest: 10 },
};

export type ActiveTimer = {
  kind: 'focus' | 'break';
  preset: FocusPreset;
  /** Full length in ms. */
  total: number;
  /** Epoch ms when it ends; null while paused. */
  endAt: number | null;
  /** Remaining ms while paused. */
  pausedLeft: number | null;
  taskId?: string;
};

export type FocusSession = { at: number; minutes: number; flower: string; taskId?: string };

export function remaining(a: ActiveTimer, now = Date.now()): number {
  return a.endAt !== null ? Math.max(0, a.endAt - now) : (a.pausedLeft ?? a.total);
}

function setActive(active: ActiveTimer | null) {
  update((s) => ({ focus: { ...s.focus, active } }));
}

/** Resolves once the end alarm is scheduled (the widget handler waits for it before returning). */
export function startFocus(preset: FocusPreset, taskId?: string): Promise<void> {
  const total = PRESETS[preset].focus * 60_000;
  const endAt = Date.now() + total;
  setActive({ kind: 'focus', preset, total, endAt, pausedLeft: null, taskId });
  return scheduleFocusAlarm(endAt, 'Focus session complete', 'A new flower is waiting in your garden.');
}

export function startBreak(preset: FocusPreset): Promise<void> {
  const total = PRESETS[preset].rest * 60_000;
  const endAt = Date.now() + total;
  setActive({ kind: 'break', preset, total, endAt, pausedLeft: null });
  return scheduleFocusAlarm(endAt, 'Break over', 'Ready for another focus session?');
}

export function pauseTimer(): Promise<void> {
  const a = getState().focus.active;
  if (!a || a.endAt === null) return Promise.resolve();
  setActive({ ...a, endAt: null, pausedLeft: remaining(a) });
  return cancelFocusAlarm();
}

export function resumeTimer(): Promise<void> {
  const a = getState().focus.active;
  if (!a || a.endAt !== null) return Promise.resolve();
  const endAt = Date.now() + (a.pausedLeft ?? a.total);
  setActive({ ...a, endAt, pausedLeft: null });
  return scheduleFocusAlarm(endAt, a.kind === 'focus' ? 'Focus session complete' : 'Break over', a.kind === 'focus' ? 'A new flower is waiting in your garden.' : 'Ready for another focus session?');
}

export function stopTimer(): Promise<void> {
  setActive(null);
  return cancelFocusAlarm();
}

/**
 * Completes a finished focus session exactly once: records it, grows a flower, clears the timer.
 * Returns the flower, or null if there was nothing to complete.
 */
export function completeFocus(): { flower: FlowerKind; session: FocusSession } | null {
  const { focus } = getState();
  const a = focus.active;
  if (!a || a.kind !== 'focus' || remaining(a) > 0) return null;
  const minutes = Math.round(a.total / 60_000);
  // The flower goes into the shared garden; the focus screen shows its own reveal, so no toast.
  const flower = bloom('focus', { ref: a.taskId, note: `${minutes}-minute focus`, rareChance: 0.15, silent: true });
  // Dated when it ended, not when the flower was collected (it may be collected the next day).
  const session: FocusSession = { at: a.endAt ?? Date.now(), minutes, flower: flower.id, taskId: a.taskId };
  update((s) => {
    const all = [session, ...s.focus.sessions];
    return { focus: { sessions: all.slice(0, MAX_SESSIONS), active: null }, clearedFocus: foldFocus(s.clearedFocus, all.slice(MAX_SESSIONS)) };
  });
  // A session spent on a task counts as a day of progress on it.
  if (a.taskId) logProgress(a.taskId);
  return { flower, session };
}

/** Ends a break that has run out. */
export function completeBreak(): boolean {
  const a = getState().focus.active;
  if (!a || a.kind !== 'break' || remaining(a) > 0) return false;
  setActive(null);
  return true;
}

/** Sessions kept in full; older ones are folded into per-day totals (AppState.clearedFocus). */
export const MAX_SESSIONS = 500;

export type FocusDay = { sessions: number; minutes: number };

/** Adds dropped sessions to the per-day totals, so the calendar and focus streak keep them. */
export function foldFocus(cleared: Record<string, FocusDay>, dropped: FocusSession[]): Record<string, FocusDay> {
  if (!dropped.length) return cleared;
  const out = { ...cleared };
  for (const f of dropped) {
    const k = dayKey(new Date(f.at));
    const d = out[k] ?? { sessions: 0, minutes: 0 };
    out[k] = { sessions: d.sessions + 1, minutes: d.minutes + f.minutes };
  }
  return out;
}

export function sessionsOn(sessions: FocusSession[], day: string): FocusSession[] {
  return sessions.filter((s) => dayKey(new Date(s.at)) === day);
}

/** Consecutive days (ending today or yesterday) with at least one completed session. */
export function focusStreak(sessions: FocusSession[], today = new Date(), cleared: Record<string, FocusDay> = {}): number {
  const days = new Set([...sessions.map((s) => dayKey(new Date(s.at))), ...Object.keys(cleared).filter((k) => cleared[k].sessions > 0)]);
  let cursor = days.has(dayKey(today)) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(dayKey(cursor))) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function fmtClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
