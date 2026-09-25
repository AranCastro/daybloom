/**
 * Daily check-in streaks and badges.
 *
 * Streak rule (kind by design): a day counts when you check in. After 7 checked-in days, one
 * missed day is forgiven as a "rest day" and the streak carries on; the next rest day becomes
 * available after another 7 checked-in days. Today never breaks a streak, since there is
 * still time to check in.
 */
import { addDays, dayKey, daysBetween, fromKey } from '@/lib/dates';
import type { IconName } from '@/components/icons';

export const REST_DAY_AFTER = 7;

export type StreakInfo = { current: number; best: number; restDaysUsed: number; checkedToday: boolean; total: number };

export function streakInfo(checkins: Record<string, number>, today: string = dayKey()): StreakInfo {
  const keys = Object.keys(checkins).sort();
  const total = keys.length;
  const checkedToday = checkins[today] !== undefined;
  if (!total) return { current: 0, best: 0, restDaysUsed: 0, checkedToday, total };

  const has = (k: string) => checkins[k] !== undefined;
  let run = 0;
  let sinceRest = 0;
  let best = 0;
  let restInRun = 0;
  let d = fromKey(keys[0]);
  const end = fromKey(today);
  while (d <= end) {
    const k = dayKey(d);
    const next = dayKey(addDays(d, 1));
    if (has(k)) {
      run += 1;
      sinceRest += 1;
      best = Math.max(best, run);
    } else if (k === today) {
      // Not yet checked in today: the streak is still alive.
    } else if (run > 0 && sinceRest >= REST_DAY_AFTER && (has(next) || next === today)) {
      sinceRest = 0; // forgiven rest day: streak continues, the day itself does not count
      restInRun += 1;
    } else {
      run = 0;
      sinceRest = 0;
      restInRun = 0;
    }
    d = addDays(d, 1);
  }
  return { current: run, best, restDaysUsed: restInRun, checkedToday, total };
}

export type BadgeTier = 'bronze' | 'silver' | 'gold';

export type Badge = {
  id: string;
  title: string;
  /** How it is earned, shown on locked badges too. */
  goal: string;
  /** Shown when it is earned. */
  cheer: string;
  icon: IconName;
  tier: BadgeTier;
  earned: (s: StreakInfo, ctx: BadgeContext) => boolean;
};

export type BadgeContext = {
  /** Mood recorded today, if any. */
  todayMood?: number;
  /** Days since the previous check-in before today (undefined if none). */
  gapBeforeToday?: number;
};

export const BADGES: readonly Badge[] = [
  { id: 'first', title: 'First step', goal: 'Check in for the first time', cheer: 'The first tap is the hardest. Well done.', icon: 'leaf', tier: 'bronze', earned: (s) => s.total >= 1 },
  { id: 'streak-3', title: 'Three in a row', goal: 'Reach a 3-day streak', cheer: 'Three days of showing up for yourself.', icon: 'spark', tier: 'bronze', earned: (s) => s.best >= 3 },
  { id: 'streak-7', title: 'One week', goal: 'Reach a 7-day streak', cheer: 'A full week. Rest days are now unlocked.', icon: 'sun', tier: 'silver', earned: (s) => s.best >= 7 },
  { id: 'streak-14', title: 'Two weeks', goal: 'Reach a 14-day streak', cheer: 'Two weeks of steady check-ins.', icon: 'flag', tier: 'silver', earned: (s) => s.best >= 14 },
  { id: 'streak-30', title: 'A month', goal: 'Reach a 30-day streak', cheer: 'Thirty days. This is a habit now.', icon: 'moon', tier: 'gold', earned: (s) => s.best >= 30 },
  { id: 'streak-60', title: 'Two months', goal: 'Reach a 60-day streak', cheer: 'Sixty days of knowing yourself a little better.', icon: 'star', tier: 'gold', earned: (s) => s.best >= 60 },
  { id: 'streak-100', title: 'One hundred', goal: 'Reach a 100-day streak', cheer: 'One hundred days. Remarkable consistency.', icon: 'flame', tier: 'gold', earned: (s) => s.best >= 100 },
  { id: 'total-10', title: 'Ten days noted', goal: 'Check in on 10 days', cheer: 'Ten days on record.', icon: 'heart', tier: 'bronze', earned: (s) => s.total >= 10 },
  { id: 'total-50', title: 'Fifty days noted', goal: 'Check in on 50 days', cheer: 'Fifty honest answers.', icon: 'calendar', tier: 'silver', earned: (s) => s.total >= 50 },
  { id: 'total-100', title: 'Hundred club', goal: 'Check in on 100 days', cheer: 'A hundred days, streak or not.', icon: 'shield', tier: 'gold', earned: (s) => s.total >= 100 },
  { id: 'honest', title: 'Honest day', goal: 'Check in on a Low or Heavy day', cheer: 'Showing up on a hard day counts double.', icon: 'heart', tier: 'silver', earned: (_s, c) => c.todayMood !== undefined && c.todayMood <= 2 },
  { id: 'comeback', title: 'Welcome back', goal: 'Check in again after 3 or more days away', cheer: 'No guilt, no catching up. Just glad you are here.', icon: 'arrow', tier: 'silver', earned: (_s, c) => (c.gapBeforeToday ?? 0) >= 4 },
];

export function badgeOf(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id);
}

export function contextFor(checkins: Record<string, number>, today: string = dayKey()): BadgeContext {
  const before = Object.keys(checkins)
    .filter((k) => k < today)
    .sort();
  const prev = before[before.length - 1];
  return { todayMood: checkins[today], gapBeforeToday: prev && checkins[today] !== undefined ? daysBetween(prev, today) : undefined };
}

/** Badges whose condition holds now but are not yet in `earned`. */
export function newlyEarned(checkins: Record<string, number>, earned: Record<string, number>, today: string = dayKey()): Badge[] {
  const s = streakInfo(checkins, today);
  const ctx = contextFor(checkins, today);
  return BADGES.filter((b) => !earned[b.id] && b.earned(s, ctx));
}
