import { daysBetween } from '@/lib/dates';
import { isLow } from '@/lib/moods';

/**
 * Decides whether the latest check-ins form a low streak that should nudge the buddy.
 *
 * Rule: the most recent `streak` check-ins are all low, the newest one is today,
 * and together they cover no more than `streak + 1` calendar days (one skipped
 * day is tolerated so a missed tap does not reset a genuine low stretch).
 */
export function isLowStreak(
  checkins: Record<string, number>,
  streak: number,
  today: string,
): boolean {
  const keys = Object.keys(checkins).sort().reverse();
  if (keys.length < streak || keys[0] !== today) return false;

  const recent = keys.slice(0, streak);
  if (!recent.every((k) => isLow(checkins[k]))) return false;

  const oldest = recent[recent.length - 1];
  return daysBetween(oldest, today) <= streak;
}

/** Count of consecutive calendar days with a check-in, ending today or yesterday. */
export function checkinStreak(checkins: Record<string, number>, today: string): number {
  const keys = new Set(Object.keys(checkins));
  const cursor = new Date(today + 'T12:00:00');
  if (!keys.has(today)) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  for (;;) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    if (!keys.has(`${y}-${m}-${d}`)) return count;
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
}
