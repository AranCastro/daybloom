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

/** Tasks the day's energy can carry; finished ones always stay. */
export function fitEnergy<T extends Pick<Task, 'effort' | 'done'>>(tasks: T[], energy: EnergyLevel | undefined): T[] {
  const ok = allowedEfforts(energy);
  return tasks.filter((t) => t.done || ok.includes(effortOf(t)));
}

/** Heaviest effort first, keeping the given order within each level (the sort is stable). */
export function deepFirst<T extends Pick<Task, 'effort'>>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => RANK[effortOf(b)] - RANK[effortOf(a)]);
}
