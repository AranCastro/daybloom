/**
 * How productive each day was: tasks finished plus focus sessions completed.
 * Used to shade past days in the calendar, like a contribution heatmap.
 */
import { dayKey } from '@/lib/dates';
import type { FocusSession } from '@/lib/focus';
import type { Task } from '@/lib/store';

export type DayWork = { tasks: number; focus: number; score: number };
export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export function workByDay(tasks: Task[], sessions: FocusSession[]): Record<string, DayWork> {
  const out: Record<string, DayWork> = {};
  const add = (at: number, kind: 'tasks' | 'focus') => {
    const k = dayKey(new Date(at));
    const d = (out[k] ??= { tasks: 0, focus: 0, score: 0 });
    d[kind] += 1;
    d.score += 1;
  };
  for (const t of tasks) if (t.done && t.doneAt) add(t.doneAt, 'tasks');
  for (const s of sessions) add(s.at, 'focus');
  return out;
}

/** 0 nothing · 1 one thing · 2 two or three · 3 four or five · 4 six or more. */
export function levelOf(score: number): HeatLevel {
  if (score <= 0) return 0;
  if (score === 1) return 1;
  if (score <= 3) return 2;
  if (score <= 5) return 3;
  return 4;
}

/** Heat colours: soft to deep garden green. Index 0 is "nothing" (no fill). */
export const HEAT = {
  light: ['transparent', '#E3EFE3', '#BFDCC5', '#8EC29D', '#5E9E6E'],
  dark: ['transparent', '#1E3027', '#28483A', '#3A6A51', '#5E9E6E'],
} as const;

export function workLine(w: DayWork | undefined): string {
  if (!w || w.score === 0) return 'Nothing finished';
  const parts = [];
  if (w.tasks) parts.push(`${w.tasks} ${w.tasks === 1 ? 'task' : 'tasks'} finished`);
  if (w.focus) parts.push(`${w.focus} focus ${w.focus === 1 ? 'session' : 'sessions'}`);
  return parts.join(' · ');
}
