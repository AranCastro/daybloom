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
