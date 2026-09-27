/**
 * Routine tasks: a task that comes back on its own (every day, on chosen weekdays, or every few
 * days), up to three times a day. The routine itself is a template; on each day it is due the store
 * keeps exactly one task of it in its quadrant (see ensureRoutines in store.ts): the one for the
 * current time of day. When the next time arrives, that task replaces the earlier one, so a routine
 * never shows more than once. Ticking, flowers, widgets and the energy filter work as for any task.
 * Pure helpers only: no store or notification imports, so both can use this file.
 */
import { addDays, daysBetween, dayKey, fromKey } from '@/lib/dates';
import type { Quadrant, Task } from '@/lib/store';

export type RepeatKind = 'daily' | 'weekly' | 'interval';

export type Routine = {
  id: string;
  title: string;
  quadrant: Quadrant;
  effort?: Task['effort'];
  kind: RepeatKind;
  /** Weekly: the weekdays it is due (0 Sunday … 6 Saturday). */
  weekdays?: number[];
  /** Every few days: the gap in days (2–30), counted from `start`. */
  every?: number;
  /** First day (YYYY-MM-DD). */
  start: string;
  /** Times of day, "HH:MM", one to three. One task is added per time. */
  times: string[];
  /** A quiet notification at each time. */
  remind: boolean;
  createdAt: number;
};

export const MAX_TIMES = 3;
export const MIN_EVERY = 2;
export const MAX_EVERY = 30;

/** Sensible first times for 1, 2 or 3 times a day. */
export const DEFAULT_TIMES: Record<1 | 2 | 3, string[]> = {
  1: ['08:00'],
  2: ['08:00', '20:00'],
  3: ['08:00', '13:00', '20:00'],
};

export const REPEAT_CHOICES: { id: RepeatKind | 'once'; label: string }[] = [
  { id: 'once', label: 'One time' },
  { id: 'daily', label: 'Every day' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'interval', label: 'Every few days' },
];

export const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Is the routine due on this day? */
export function occursOn(r: Pick<Routine, 'kind' | 'weekdays' | 'every' | 'start'>, day: string): boolean {
  if (day < r.start) return false;
  if (r.kind === 'daily') return true;
  if (r.kind === 'weekly') return !!r.weekdays?.includes(fromKey(day).getDay());
  const every = Math.min(MAX_EVERY, Math.max(MIN_EVERY, r.every ?? MIN_EVERY));
  return daysBetween(r.start, day) % every === 0;
}

/** The next days (from `from`, inclusive, up to `days` ahead) on which the routine is due. */
export function nextDays(r: Routine, from: string, days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = dayKey(addDays(fromKey(from), i));
    if (occursOn(r, d)) out.push(d);
  }
  return out;
}

/** "HH:MM" → minutes after midnight. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Minutes after midnight → "HH:MM" (wraps around the day). */
export function fromMinutes(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** A valid "HH:MM", or undefined. */
export function cleanTime(v: unknown): string | undefined {
  if (typeof v !== 'string' || !/^\d{2}:\d{2}$/.test(v)) return undefined;
  const [h, m] = v.split(':').map(Number);
  return h <= 23 && m <= 59 ? v : undefined;
}

/** Times sorted, without repeats, at most three. */
export function normaliseTimes(times: string[]): string[] {
  const clean = [...new Set(times.map(cleanTime).filter((t): t is string => !!t))].sort();
  return clean.length ? clean.slice(0, MAX_TIMES) : ['08:00'];
}

/** A friendly name for a time: "8:00 am · Morning". */
export function timeLabel(time: string): string {
  const min = toMinutes(time);
  const h = Math.floor(min / 60);
  const part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(min % 60).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'} · ${part}`;
}

/** Short clock text for rows and widgets: "8:00 am". */
export function clockText(time: string): string {
  return timeLabel(time).split(' · ')[0];
}

/** "Every day", "Weekly on Mon, Thu", "Every 3 days", with "· twice a day" when needed. */
export function repeatLabel(r: Pick<Routine, 'kind' | 'weekdays' | 'every' | 'times'>): string {
  const base =
    r.kind === 'daily'
      ? 'Every day'
      : r.kind === 'weekly'
        ? `Weekly on ${(r.weekdays ?? []).slice().sort().map((d) => WEEKDAY_NAMES[d]).join(', ') || '—'}`
        : `Every ${r.every ?? MIN_EVERY} days`;
  const n = r.times.length;
  return n === 1 ? base : `${base} · ${n === 2 ? 'twice' : 'three times'} a day`;
}

/**
 * Which of the day's times is current at `minutes` after midnight: the latest one that has arrived,
 * or the first one before any has.
 */
export function currentSlot(times: string[], minutes: number): number {
  let slot = 0;
  times.forEach((t, i) => {
    if (toMinutes(t) <= minutes) slot = i;
  });
  return slot;
}

/** Slot number meaning "skipped for the rest of the day" in routineMade. */
export const SKIPPED_SLOT = 9;

/** routineMade holds "YYYY-MM-DD#slot": the day and the last slot added (older data: a bare day). */
export function parseMade(v: string | undefined): { day: string; slot: number } | null {
  if (!v) return null;
  const [day, slot] = v.split('#');
  return { day, slot: slot === undefined ? -1 : Number(slot) };
}

/** The id of the task a routine adds for one day and time slot. Stable, so adding is idempotent. */
export function instanceId(routineId: string, day: string, slot: number): string {
  return `${routineId}:${day}:${slot}`;
}

/** The notification identifier for one routine task (see lib/routine-reminders). */
export const REMINDER_PREFIX = 'routine:';
export function reminderId(taskId: string): string {
  return `${REMINDER_PREFIX}${taskId}`;
}
export function taskIdFromReminder(notificationId: string | undefined): string | null {
  return notificationId?.startsWith(REMINDER_PREFIX) ? notificationId.slice(REMINDER_PREFIX.length) : null;
}
