/**
 * Pomodoro focus timer. The running timer is stored as an absolute end time, so it stays
 * correct when the app is backgrounded or closed; an alarm notification fires at the end.
 * Every completed focus session grows one flower in the shared garden.
 */
import { addDays, dayKey } from '@/lib/dates';
import { FlowerKind } from '@/lib/flowers';
import { cancelFocusAlarm, scheduleFocusAlarm } from '@/lib/reminders';
import { bloom, getState, update } from '@/lib/store';

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

export function startFocus(preset: FocusPreset, taskId?: string) {
  const total = PRESETS[preset].focus * 60_000;
  const endAt = Date.now() + total;
  setActive({ kind: 'focus', preset, total, endAt, pausedLeft: null, taskId });
  scheduleFocusAlarm(endAt, 'Focus session complete', 'A new flower is waiting in your garden.');
}

export function startBreak(preset: FocusPreset) {
  const total = PRESETS[preset].rest * 60_000;
  const endAt = Date.now() + total;
  setActive({ kind: 'break', preset, total, endAt, pausedLeft: null });
  scheduleFocusAlarm(endAt, 'Break over', 'Ready for another focus session?');
}

export function pauseTimer() {
  const a = getState().focus.active;
  if (!a || a.endAt === null) return;
  setActive({ ...a, endAt: null, pausedLeft: remaining(a) });
  cancelFocusAlarm();
}

export function resumeTimer() {
  const a = getState().focus.active;
  if (!a || a.endAt !== null) return;
  const endAt = Date.now() + (a.pausedLeft ?? a.total);
  setActive({ ...a, endAt, pausedLeft: null });
  scheduleFocusAlarm(endAt, a.kind === 'focus' ? 'Focus session complete' : 'Break over', a.kind === 'focus' ? 'A new flower is waiting in your garden.' : 'Ready for another focus session?');
}

export function stopTimer() {
  setActive(null);
  cancelFocusAlarm();
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
  const session: FocusSession = { at: Date.now(), minutes, flower: flower.id, taskId: a.taskId };
  update((s) => ({ focus: { sessions: [session, ...s.focus.sessions].slice(0, 500), active: null } }));
  return { flower, session };
}

/** Ends a break that has run out. */
export function completeBreak(): boolean {
  const a = getState().focus.active;
  if (!a || a.kind !== 'break' || remaining(a) > 0) return false;
  setActive(null);
  return true;
}

export function sessionsOn(sessions: FocusSession[], day: string): FocusSession[] {
  return sessions.filter((s) => dayKey(new Date(s.at)) === day);
}

/** Consecutive days (ending today or yesterday) with at least one completed session. */
export function focusStreak(sessions: FocusSession[], today = new Date()): number {
  const days = new Set(sessions.map((s) => dayKey(new Date(s.at))));
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
