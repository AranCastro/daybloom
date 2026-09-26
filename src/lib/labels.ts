/** Section names: the user's own name for a matrix quadrant or circle section, or the default. */
import { circleOf } from '@/lib/circle';
import { quadrantOf } from '@/lib/quadrants';
import { AppState, CircleQuadrant, Quadrant, useAppState } from '@/lib/store';

export function quadrantName(labels: AppState['labels'] | undefined, q: Quadrant): string {
  return labels?.matrix?.[q] || quadrantOf(q).action;
}

export function circleName(labels: AppState['labels'] | undefined, q: CircleQuadrant): string {
  return labels?.circle?.[q] || circleOf(q).title;
}

/** For components: returns a lookup that re-renders when names change. */
export function useQuadrantNames(): (q: Quadrant) => string {
  const labels = useAppState((s) => s.labels);
  return (q) => quadrantName(labels, q);
}

export function useCircleNames(): (q: CircleQuadrant) => string {
  const labels = useAppState((s) => s.labels);
  return (q) => circleName(labels, q);
}
