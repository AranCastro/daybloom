/**
 * Four effort levels for tasks, and which ones a day's energy can carry:
 * Low energy shows Quick only; Medium hides Deep work; High shows everything, Deep work first.
 * A task without a level counts as Moderate.
 */
import type { EnergyLevel, Task } from '@/lib/store';

export type Effort = 'quick' | 'light' | 'moderate' | 'deep';

export const EFFORTS: { id: Effort; label: string; emoji: string; hint: string; tint: string }[] = [
  { id: 'quick', label: 'Quick', emoji: '🪶', hint: 'Under 15 minutes', tint: '#3A9477' },
  { id: 'light', label: 'Light', emoji: '🌿', hint: 'Easy, a little time', tint: '#6FAE7C' },
  { id: 'moderate', label: 'Moderate', emoji: '🌳', hint: 'Needs steady attention', tint: '#D08A2E' },
  { id: 'deep', label: 'Deep work', emoji: '🏔️', hint: 'Hard thinking, best on high energy', tint: '#7E6FD0' },
];

/** What finishing a task grows: harder work, more flowers and better odds of a rare one. */
export const REWARD: Record<Effort, { flowers: number; rare: number }> = {
  quick: { flowers: 1, rare: 0.08 },
  light: { flowers: 1, rare: 0.12 },
  moderate: { flowers: 1, rare: 0.18 },
  deep: { flowers: 2, rare: 0.3 },
};

/** The reward for one task. Do first adds 5 points of rare chance; a task with no level keeps the old odds. */
export function rewardFor(task: Pick<Task, 'effort' | 'quadrant'>): { flowers: number; rare: number } {
  const bonus = task.quadrant === 1 ? 0.05 : 0;
  if (!task.effort) return { flowers: 1, rare: 0.1 + bonus };
  const r = REWARD[task.effort];
  return { flowers: r.flowers, rare: Math.min(0.5, r.rare + bonus) };
}

/** Short line for the task sheet, e.g. "2 flowers · 30% rare". */
export function rewardLine(e: Effort): string {
  const r = REWARD[e];
  return `${r.flowers} ${r.flowers === 1 ? 'flower' : 'flowers'} · ${Math.round(r.rare * 100)}% rare`;
}

const RANK: Record<Effort, number> = { quick: 0, light: 1, moderate: 2, deep: 3 };

export function effortOf(task: Pick<Task, 'effort'>): Effort {
  return task.effort ?? 'moderate';
}

export function effortInfo(e: Effort) {
  return EFFORTS.find((x) => x.id === e)!;
}

/** Which effort levels suit a day's energy (all of them when energy is not set). */
export function allowedEfforts(energy: EnergyLevel | undefined): Effort[] {
  if (energy === 1) return ['quick'];
  if (energy === 2) return ['quick', 'light', 'moderate'];
  return ['quick', 'light', 'moderate', 'deep'];
}

/** A task split into steps with some still open: on a tired day its next small step can still be done. */
export function hasOpenSteps(t: Pick<Task, 'steps'>): boolean {
  return !!t.steps?.some((x) => !x.done);
}

/**
 * Tasks the day's energy can carry; finished ones always stay. A big task that has open steps stays
 * too, because only its next step is asked of you (the task row shows it).
 */
export function fitEnergy<T extends Pick<Task, 'effort' | 'done' | 'steps' | 'routineId'>>(tasks: T[], energy: EnergyLevel | undefined): T[] {
  const ok = allowedEfforts(energy);
  // Routine tasks (medicines, a walk, a bath) are part of every day, whatever the energy: never hidden.
  return tasks.filter((t) => t.done || !!t.routineId || ok.includes(effortOf(t)) || hasOpenSteps(t));
}

/** "2 of 5 steps" progress, or null for a task without steps. */
export function stepProgress(t: Pick<Task, 'steps'>): { done: number; total: number; next: string | null } | null {
  if (!t.steps?.length) return null;
  const done = t.steps.filter((x) => x.done).length;
  return { done, total: t.steps.length, next: t.steps.find((x) => !x.done)?.title ?? null };
}

/** Heaviest effort first, keeping the given order within each level (the sort is stable). */
export function deepFirst<T extends Pick<Task, 'effort'>>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => RANK[effortOf(b)] - RANK[effortOf(a)]);
}
