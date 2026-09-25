/**
 * What each home-screen widget shows, worked out from the app state.
 * Pure functions, so widgets, the in-app gallery and tests all read the same numbers.
 */
import { streakInfo } from '@/lib/badges';
import { circleOf } from '@/lib/circle';
import { dayKey, fromKey, shortDate } from '@/lib/dates';
import { FlowerKind, flowerOf, GOLDEN_EVERY } from '@/lib/flowers';
import { isLow, moodOf, MoodValue } from '@/lib/moods';
import { sortOpen } from '@/lib/quadrants';
import type { AppState, Person, Task } from '@/lib/store';

export type Snapshot = ReturnType<typeof snapshot>;

export function snapshot(s: AppState, now: Date = new Date()) {
  const today = dayKey(now);
  const mood = s.checkins[today] as MoodValue | undefined;
  const streak = streakInfo(s.checkins, today);
  const low = isLow(mood);

  const bloomsToday = s.garden.filter((b) => dayKey(new Date(b.at)) === today).length;
  const latest: FlowerKind | null = s.garden[0] ? flowerOf(s.garden[0].flower) : null;
  const total = s.garden.length;
  const toGolden = GOLDEN_EVERY - (total % GOLDEN_EVERY);

  return {
    onboarded: s.onboarded,
    name: s.name,
    today,
    mood,
    moodLabel: moodOf(mood)?.label,
    low,
    streak: streak.current,
    best: streak.best,
    checkedToday: streak.checkedToday,
    garden: { total, today: bloomsToday, latest, toGolden, recent: s.garden.slice(0, 5).map((b) => flowerOf(b.flower)) },
    tasks: focusList(s.tasks, today, low),
    focus: focusState(s, now),
    reach: reachPicks(s.people),
    matrix: matrixCells(s.tasks, today, s.widgetPrefs.Matrix.completed),
    circle: circleCells(s.people),
  };
}

/** Each Eisenhower quadrant: open tasks (dated first, soonest due), then finished ones if asked for. */
function matrixCells(tasks: Task[], today: string, withDone: boolean) {
  return ([1, 2, 3, 4] as const).map((q) => {
    const open = sortOpen(tasks.filter((t) => t.quadrant === q && !t.done));
    const done = withDone ? tasks.filter((t) => t.quadrant === q && t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)) : [];
    return {
      q,
      tasks: [...open, ...done].map((t) => ({ id: t.id, title: t.title, done: t.done, due: t.done ? null : dueText(t.due, today) })),
    };
  });
}

/** Each circle quadrant, least recently reached first, with the link that reaches them. */
function circleCells(people: Person[]) {
  return ([1, 2, 3, 4] as const).map((q) => {
    const info = circleOf(q);
    const list = people
      .filter((p) => p.quadrant === q)
      .sort((a, b) => (a.lastReachedAt ?? 0) - (b.lastReachedAt ?? 0) || a.createdAt - b.createdAt)
      .map((p) => ({ id: p.id, name: p.name, uri: reachUri(p.phone, info.mode, info.opener) }));
    return { q, mode: info.mode, people: list };
  });
}

/** tel: or sms: link for a person; without a number, the circle screen. */
export function reachUri(phone: string | undefined, mode: 'call' | 'message', opener: string): string {
  if (!phone) return 'daybloom://circle';
  const n = phone.replace(/[^\d+]/g, '');
  return mode === 'call' ? `tel:${n}` : `sms:${n}?body=${encodeURIComponent(opener)}`;
}

/** Today's short list, as on the Today screen: due or late first, then "Do first". One task on a low day. */
function focusList(tasks: Task[], today: string, low: boolean) {
  const dueNow = tasks
    .filter((t) => !t.done && t.due && t.due <= today)
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '') || a.quadrant - b.quadrant);
  const doFirst = tasks.filter((t) => t.quadrant === 1 && !t.done && !dueNow.includes(t)).sort((a, b) => a.createdAt - b.createdAt);
  const all = [...dueNow, ...doFirst];
  const limit = low ? 1 : 4;
  const doneToday = tasks.filter((t) => t.done && t.doneAt && dayKey(new Date(t.doneAt)) === today).length;
  return {
    items: all.slice(0, limit).map((t) => ({ id: t.id, title: t.title, due: dueText(t.due, today) })),
    more: Math.max(0, all.length - limit),
    doneToday,
  };
}

function dueText(due: string | undefined, today: string): { text: string; late: boolean } | null {
  if (!due) return null;
  if (due < today) return { text: 'Late', late: true };
  if (due === today) return { text: 'Today', late: false };
  return { text: shortDate(fromKey(due)), late: false };
}

function focusState(s: AppState, now: Date) {
  const a = s.focus.active;
  const today = dayKey(now);
  const sessionsToday = s.focus.sessions.filter((f) => dayKey(new Date(f.at)) === today).length;
  if (!a) return { running: false as const, sessionsToday };
  const paused = a.endAt === null;
  const endAt = a.endAt ?? now.getTime() + (a.pausedLeft ?? 0);
  const end = new Date(endAt);
  const until = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
  const leftMin = Math.max(0, Math.ceil(((a.endAt ?? now.getTime() + (a.pausedLeft ?? 0)) - now.getTime()) / 60_000));
  const task = a.taskId ? s.tasks.find((t) => t.id === a.taskId)?.title : undefined;
  return { running: true as const, kind: a.kind, paused, until, leftMin, task, sessionsToday };
}

/** One person to call and one to message, least recently reached first (as on Today). */
function reachPicks(people: Person[]) {
  const inQ = (q: Person['quadrant']) =>
    people.filter((p) => p.quadrant === q).sort((a, b) => (a.lastReachedAt ?? 0) - (b.lastReachedAt ?? 0) || a.createdAt - b.createdAt);
  const caller = inQ(1)[0] ?? inQ(2)[0];
  const texter = inQ(3)[0] ?? inQ(4)[0];
  return [caller, texter]
    .filter((p): p is Person => !!p)
    .map((p) => ({ id: p.id, name: p.name, mode: circleOf(p.quadrant).mode, uri: reachUri(p.phone, circleOf(p.quadrant).mode, circleOf(p.quadrant).opener) }));
}
