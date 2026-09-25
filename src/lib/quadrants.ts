import { daysBetween } from '@/lib/dates';
import type { Quadrant, Task } from '@/lib/store';

export type QuadrantInfo = {
  id: Quadrant;
  numeral: string;
  /** What to do with tasks here. */
  action: string;
  /** The Eisenhower definition. */
  meaning: string;
  hint: string;
  color: { light: string; dark: string };
  soft: { light: string; dark: string };
};

export const QUADRANTS: readonly QuadrantInfo[] = [
  {
    id: 1,
    numeral: 'I',
    action: 'Do first',
    meaning: 'Urgent · Important',
    hint: 'Deadlines and crises. Handle these today.',
    color: { light: '#D65A45', dark: '#F08A74' },
    soft: { light: '#FBE5DF', dark: '#3A221C' },
  },
  {
    id: 2,
    numeral: 'II',
    action: 'Schedule',
    meaning: 'Not urgent · Important',
    hint: 'Growth and long-term goals. Give them a time.',
    color: { light: '#C98A1E', dark: '#EDB65A' },
    soft: { light: '#FAEDD3', dark: '#372A16' },
  },
  {
    id: 3,
    numeral: 'III',
    action: 'Delegate',
    meaning: 'Urgent · Not important',
    hint: 'Interruptions. Hand off or keep short.',
    color: { light: '#5566D0', dark: '#8D9BEA' },
    soft: { light: '#E4E7FA', dark: '#1F2340' },
  },
  {
    id: 4,
    numeral: 'IV',
    action: 'Later',
    meaning: 'Not urgent · Not important',
    hint: 'Nice-to-haves. Drop or park them.',
    color: { light: '#3A9477', dark: '#6CC4A6' },
    soft: { light: '#DDEFE7', dark: '#17302A' },
  },
];

/** Arranged tasks first (by hand), then dated ones (soonest due), then by creation. */
export function sortOpen<T extends Pick<Task, 'order' | 'due' | 'createdAt'>>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const oa = a.order ?? Infinity;
    const ob = b.order ?? Infinity;
    if (oa !== ob) return oa - ob;
    if (a.due && b.due && a.due !== b.due) return a.due.localeCompare(b.due);
    if (a.due && !b.due) return -1;
    if (b.due && !a.due) return 1;
    return a.createdAt - b.createdAt;
  });
}

export function quadrantOf(q: Quadrant): QuadrantInfo {
  return QUADRANTS[q - 1];
}

export type DueTone = 'late' | 'today' | 'soon' | 'later';

/** Short due badge like the reference design: "Today", "1D", "15D", "2D late". */
export function dueBadge(due: string | undefined, today: string): { text: string; tone: DueTone } | null {
  if (!due) return null;
  const d = daysBetween(today, due);
  if (d < 0) return { text: `${-d}D late`, tone: 'late' };
  if (d === 0) return { text: 'Today', tone: 'today' };
  return { text: `${d}D`, tone: d <= 2 ? 'soon' : 'later' };
}
