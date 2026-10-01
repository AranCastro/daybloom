/**
 * Routine history in numbers, for the routine's own page and the Routines list: how often it was
 * done, streaks, and day-by-day cells for the charts. Pure functions over `routineLog` (store.ts),
 * so they can be tested without the app.
 *
 * A day "counts" only if the routine was due that day (lib/routines occursOn) and on or after its
 * first day. Today counts once it is complete; an unfinished today never breaks a streak, because
 * the day is not over.
 */
import { addDays, dayKey, fromKey } from '@/lib/dates';
import { occursOn, Routine } from '@/lib/routines';

export type RoutineLog = Record<string, number[]>;

export type DayCell = {
  day: string;
  /** Times it was due that day (0 when not due, before it started, or in the future). */
  due: number;
  /** Times ticked off that day. */
  done: number;
  future: boolean;
};

export type Tally = { done: number; due: number };

export type RoutineStats = {
  /** Every time it has been ticked off, ever. */
  total: number;
  /** Days with every time done. */
  perfectDays: number;
  last30: Tally;
  thisWeek: Tally;
  streak: number;
  best: number;
  /** The first day with history or the routine's start, whichever is earlier. */
  since: string;
  /** One cell per day, oldest first, whole weeks starting on `weekStart`. */
  heat: DayCell[];
  /** Weeks, oldest first, for the bar chart. */
  weeks: (Tally & { start: string })[];
  /** Each time of day over the last 30 days. */
  slots: (Tally & { time: string })[];
  /** Sunday … Saturday over the last 12 weeks. */
  weekdays: Tally[];
  /** Times marked "Not done" in the last 30 days. */
  notDone30: number;
  /** The most recent days it was due (newest first), each time done, marked not done, or not answered. */
  recent: { day: string; slots: ('done' | 'missed' | null)[] }[];
};

const rate = (x: Tally) => (x.due ? x.done / x.due : 0);
export const percent = (x: Tally) => Math.round(rate(x) * 100);

/** One day of a routine. A day with more ticks than times (the times were reduced later) counts them all. */
export function cellFor(r: Routine, log: RoutineLog | undefined, day: string, today: string): DayCell {
  const done = log?.[day]?.length ?? 0;
  if (day > today) return { day, due: 0, done: 0, future: true };
  const isDue = day >= r.start && occursOn(r, day);
  return { day, due: isDue || done ? Math.max(isDue ? r.times.length : 0, done) : 0, done, future: false };
}

function sum(cells: DayCell[]): Tally {
  return cells.reduce((a, c) => ({ done: a.done + Math.min(c.done, c.due), due: a.due + c.due }), { done: 0, due: 0 });
}

/** Days from `from` to `to` inclusive. */
function span(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = fromKey(from); dayKey(d) <= to; d = addDays(d, 1)) out.push(dayKey(d));
  return out;
}

/** Streaks over complete days; days not due are skipped, an unfinished today is not counted against it. */
function streaks(cells: DayCell[], today: string): { streak: number; best: number } {
  let run = 0;
  let best = 0;
  for (const c of cells) {
    if (!c.due) continue;
    if (c.done >= c.due) best = Math.max(best, ++run);
    else if (c.day !== today) run = 0;
  }
  return { streak: run, best };
}

export function routineStats(
  r: Routine,
  log: RoutineLog | undefined,
  today: string,
  weekStart: 0 | 1 = 0,
  heatWeeks = 16,
  missed?: RoutineLog,
): RoutineStats {
  const logged = Object.keys(log ?? {}).sort();
  const since = logged[0] && logged[0] < r.start ? logged[0] : r.start;
  const all = since <= today ? span(since, today).map((d) => cellFor(r, log, d, today)) : [];
  const { streak, best } = streaks(all, today);
  const back = (n: number) => dayKey(addDays(fromKey(today), -n));

  // Whole weeks ending with the current one.
  const t = fromKey(today);
  const offset = (t.getDay() - weekStart + 7) % 7;
  const weekOf = dayKey(addDays(t, -offset));
  const heatStart = dayKey(addDays(fromKey(weekOf), -7 * (heatWeeks - 1)));
  const heat = span(heatStart, dayKey(addDays(fromKey(weekOf), 6))).map((d) => cellFor(r, log, d, today));

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = dayKey(addDays(fromKey(weekOf), -7 * (7 - i)));
    const cells = span(start, dayKey(addDays(fromKey(start), 6))).map((d) => cellFor(r, log, d, today));
    return { start, ...sum(cells) };
  });

  const last30Cells = span(back(29), today).map((d) => cellFor(r, log, d, today));
  const slots = r.times.map((time, i) => ({
    time,
    done: last30Cells.filter((c) => c.due && log?.[c.day]?.includes(i)).length,
    due: last30Cells.filter((c) => c.due).length,
  }));

  const weekdays: Tally[] = Array.from({ length: 7 }, () => ({ done: 0, due: 0 }));
  for (const c of span(back(83), today).map((d) => cellFor(r, log, d, today))) {
    const w = weekdays[fromKey(c.day).getDay()];
    w.done += Math.min(c.done, c.due);
    w.due += c.due;
  }

  const recent = all
    .filter((c) => c.due)
    .slice(-10)
    .reverse()
    .map((c) => ({
      day: c.day,
      slots: Array.from({ length: c.due }, (_, i) => (log?.[c.day]?.includes(i) ? 'done' : missed?.[c.day]?.includes(i) ? 'missed' : null)),
    }));

  return {
    total: Object.values(log ?? {}).reduce((n, s) => n + s.length, 0),
    perfectDays: all.filter((c) => c.due && c.done >= c.due).length,
    last30: sum(last30Cells),
    notDone30: last30Cells.reduce((n, c) => n + (c.due ? (missed?.[c.day]?.length ?? 0) : 0), 0),
    thisWeek: sum(span(weekOf, today).map((d) => cellFor(r, log, d, today))),
    streak,
    best,
    since,
    heat,
    weeks,
    slots,
    weekdays,
    recent,
  };
}

/** Across every routine, for the summary at the top of the Routines list. */
export function allRoutinesWeek(routines: Routine[], logs: Record<string, RoutineLog>, today: string, weekStart: 0 | 1 = 0): Tally & { days: Tally[] } {
  const t = fromKey(today);
  const weekOf = addDays(t, -((t.getDay() - weekStart + 7) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = dayKey(addDays(weekOf, i));
    return sum(routines.map((r) => cellFor(r, logs[r.id], d, today)));
  });
  return { ...days.reduce((a, x) => ({ done: a.done + x.done, due: a.due + x.due }), { done: 0, due: 0 }), days };
}

/** The last `n` days (oldest first) of one routine, for the strip on each row. */
export function lastDays(r: Routine, log: RoutineLog | undefined, today: string, n = 14): DayCell[] {
  return Array.from({ length: n }, (_, i) => cellFor(r, log, dayKey(addDays(fromKey(today), i - n + 1)), today));
}
