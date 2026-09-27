/**
 * Patterns you might not notice, worked out on the phone from the last 90 days: weekdays,
 * reaching out, finished tasks, focus sessions against feeling tags, energy and places.
 * Each pattern needs enough days on both sides and a clear gap (in mood points on the 1–5 scale,
 * or sessions per day) before it is shown. They describe what happened, not what caused it.
 */
import { addDays, dayKey, fromKey } from '@/lib/dates';
import { tagOf } from '@/lib/mood-tags';
import { placeStats } from '@/lib/places';
import type { AppState } from '@/lib/store';

export type Pattern = { id: string; emoji: string; title: string; detail: string };

/** Check-ins needed before any pattern is shown. */
export const MIN_DAYS = 14;
const MIN_GROUP = 3;
const MOOD_GAP = 0.5;
const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const fmt = (x: number) => (Math.round(x * 10) / 10).toFixed(1);

type Input = Pick<AppState, 'checkins' | 'moodTags' | 'garden' | 'tasks' | 'focus' | 'energy' | 'places' | 'checkinPlace' | 'clearedWork'>;

export function checkinDays(s: Pick<AppState, 'checkins'>, today: string, window = 90): string[] {
  const from = dayKey(addDays(fromKey(today), -(window - 1)));
  return Object.keys(s.checkins).filter((d) => d >= from && d <= today);
}

/** Splits check-in days by a test and compares average mood. */
function compare(days: string[], s: Input, test: (d: string) => boolean) {
  const yes = days.filter(test).map((d) => s.checkins[d]);
  const no = days.filter((d) => !test(d)).map((d) => s.checkins[d]);
  if (yes.length < MIN_GROUP || no.length < MIN_GROUP) return null;
  return { yes: mean(yes), no: mean(no), n: yes.length };
}

export function findPatterns(s: Input, today: string): Pattern[] {
  const days = checkinDays(s, today);
  if (days.length < MIN_DAYS) return [];
  const out: Pattern[] = [];
  const overall = mean(days.map((d) => s.checkins[d]));

  // 1. Weekdays: the heaviest and the brightest, if they stand out.
  const byDay = Array.from({ length: 7 }, (_, w) => days.filter((d) => fromKey(d).getDay() === w).map((d) => s.checkins[d]));
  const means = byDay.map((xs) => (xs.length >= MIN_GROUP ? mean(xs) : null));
  const valid = means.map((m, w) => ({ m, w })).filter((x): x is { m: number; w: number } => x.m !== null);
  if (valid.length) {
    const low = valid.reduce((a, b) => (b.m < a.m ? b : a));
    const high = valid.reduce((a, b) => (b.m > a.m ? b : a));
    if (overall - low.m >= MOOD_GAP)
      out.push({ id: 'weekday-low', emoji: '📅', title: `Your ${WEEKDAYS[low.w]} are often heavier`, detail: `Average ${fmt(low.m)} on ${WEEKDAYS[low.w]} against ${fmt(overall)} overall (${byDay[low.w].length} days). A gentler plan for that day may help.` });
    if (high.m - overall >= MOOD_GAP && high.w !== low.w)
      out.push({ id: 'weekday-high', emoji: '🌤️', title: `${WEEKDAYS[high.w]} tend to be your brightest`, detail: `Average ${fmt(high.m)} against ${fmt(overall)} overall (${byDay[high.w].length} days).` });
  }

  // 2. Reaching out: days a reach-out flower grew (a call or message from the app).
  const reached = new Set(s.garden.filter((b) => b.source === 'reach').map((b) => dayKey(new Date(b.at))));
  const r = compare(days, s, (d) => reached.has(d));
  if (r && r.yes - r.no >= MOOD_GAP)
    out.push({ id: 'reach', emoji: '📞', title: 'You felt better on days you called someone', detail: `Average ${fmt(r.yes)} on ${r.n} days you reached out, against ${fmt(r.no)} on other days.` });

  // 3. Finished tasks: two or more done in a day, counting ones since cleared from the matrix.
  const doneBy = new Map<string, number>();
  for (const t of s.tasks) if (t.done && t.doneAt) doneBy.set(dayKey(new Date(t.doneAt)), (doneBy.get(dayKey(new Date(t.doneAt))) ?? 0) + 1);
  const tk = compare(days, s, (d) => (doneBy.get(d) ?? 0) + (s.clearedWork[d] ?? 0) >= 2);
  if (tk && tk.yes - tk.no >= MOOD_GAP)
    out.push({ id: 'tasks', emoji: '✅', title: 'Days with two finished tasks felt lighter', detail: `Average ${fmt(tk.yes)} on ${tk.n} such days, against ${fmt(tk.no)} otherwise.` });

  // 4. Focus sessions against heavy feeling tags (for example Tension).
  const focusBy = new Map<string, number>();
  for (const f of s.focus.sessions) focusBy.set(dayKey(new Date(f.at)), (focusBy.get(dayKey(new Date(f.at))) ?? 0) + 1);
  const heavyTags = new Map<string, string[]>();
  for (const d of days) for (const id of s.moodTags[d] ?? []) if (tagOf(id)?.tone === 'heavy') heavyTags.set(id, [...(heavyTags.get(id) ?? []), d]);
  let bestTag: { id: string; on: number; off: number; n: number } | null = null;
  for (const [id, tagged] of heavyTags) {
    const others = days.filter((d) => !tagged.includes(d));
    if (tagged.length < MIN_GROUP || others.length < MIN_GROUP) continue;
    const on = mean(tagged.map((d) => focusBy.get(d) ?? 0));
    const off = mean(others.map((d) => focusBy.get(d) ?? 0));
    if (off - on >= 0.5 && (!bestTag || off - on > bestTag.off - bestTag.on)) bestTag = { id, on, off, n: tagged.length };
  }
  if (bestTag) {
    const tag = tagOf(bestTag.id)!;
    out.push({ id: 'tag-focus', emoji: tag.emoji, title: `${tag.label} days had fewer focus sessions`, detail: `${fmt(bestTag.on)} sessions a day on ${bestTag.n} ${tag.label.toLowerCase()} days, against ${fmt(bestTag.off)} on other days.` });
  }

  // 5. Morning energy and the day's mood.
  const en = compare(days, s, (d) => (s.energy[d] ?? 0) >= 3);
  const enLow = compare(days, s, (d) => s.energy[d] === 1);
  if (en && enLow && en.yes - enLow.yes >= 1)
    out.push({ id: 'energy', emoji: '⚡', title: 'Your morning energy predicts the day', detail: `High-energy mornings averaged ${fmt(en.yes)}; low-energy mornings ${fmt(enLow.yes)}.` });

  // 6. Places: the brightest place, when at least two places have enough days.
  const since = days.length ? days.reduce((a, b) => (a < b ? a : b)) : undefined;
  const ps = placeStats(s, since).filter((x) => x.days >= MIN_GROUP && x.avg !== null);
  if (ps.length >= 2 && ps[0].avg! - ps[ps.length - 1].avg! >= MOOD_GAP)
    out.push({ id: 'place', emoji: ps[0].place.emoji, title: `You feel best at ${ps[0].place.name}`, detail: `Average ${fmt(ps[0].avg!)} there, against ${fmt(ps[ps.length - 1].avg!)} at ${ps[ps.length - 1].place.name}.` });

  return out;
}
