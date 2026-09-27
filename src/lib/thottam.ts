/** Thottam helpers: which festival is near, starter designs, and a "surprise me" Poo Kolam. */
import type { Pookalam, PookalamRing } from '@/lib/store';

export type Festival = Pookalam['festival'];

export const FESTIVALS: { id: Festival; label: string; blurb: string }[] = [
  { id: 'onam', label: 'Onam', blurb: 'Petals and leaves' },
  { id: 'diwali', label: 'Diwali', blurb: 'A ring of diyas' },
  { id: 'pongal', label: 'Pongal', blurb: 'Kolam dots and loops' },
];

export const PATTERNS: { id: PookalamRing['pattern']; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'alternate', label: 'Alternate' },
  { id: 'petals', label: 'Petals' },
  { id: 'dots', label: 'Dots' },
];

/**
 * The festival season around a date, if any. Festival dates move with the calendars they follow,
 * so these are generous windows rather than exact days: Onam in the Malayalam month of Chingam
 * (mid-August to mid-September), Diwali from mid-October to late November, Pongal in mid-January.
 */
export function festivalNear(d: Date): Festival | null {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const md = m * 100 + day;
  if (md >= 810 && md <= 920) return 'onam';
  if (md >= 1015 && md <= 1125) return 'diwali';
  if (md >= 110 && md <= 120) return 'pongal';
  return null;
}

/** A pleasing design from the flowers the user has grown. `rand` is injectable for tests. */
export function surprise(kinds: string[], festival: Festival, rand: () => number = Math.random): Omit<Pookalam, 'id' | 'createdAt' | 'name'> {
  const pick = () => kinds[Math.floor(rand() * kinds.length)];
  const patterns: PookalamRing['pattern'][] = ['petals', 'solid', 'alternate', 'dots'];
  const n = 3 + Math.floor(rand() * 3);
  return {
    center: pick(),
    rings: Array.from({ length: n }, (_, i) => ({ flower: pick(), pattern: patterns[(i + Math.floor(rand() * 4)) % 4] })),
    festival,
  };
}
