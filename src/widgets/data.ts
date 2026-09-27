/**
 * What each home-screen widget shows, worked out from the app state.
 * Pure functions, so widgets, the in-app gallery and tests all read the same numbers.
 */
import { circleName, quadrantName } from '@/lib/labels';
import { streakInfo } from '@/lib/badges';
import { circleOf } from '@/lib/circle';
import { dayKey, fromKey, shortDate } from '@/lib/dates';
import { FlowerKind, flowerOf, GOLDEN_EVERY } from '@/lib/flowers';
import { isLow, moodOf, MoodValue } from '@/lib/moods';
import { sortOpen } from '@/lib/quadrants';
import { cleanNumber, whatsappNumber } from '@/lib/reach';
import { effortInfo, stepProgress } from '@/lib/effort';
import { widgetUndoFor } from '@/lib/store';
import type { AppState, Person, Task } from '@/lib/store';

export type Snapshot = ReturnType<typeof snapshot>;

export function snapshot(s: AppState, now: Date = new Date()) {
  const today = dayKey(now);
  const mood = s.checkins[today] as MoodValue | undefined;
  const streak = streakInfo(s.checkins, today);
  const low = isLow(mood);

  const bloomsToday = s.garden.filter((b) => dayKey(new Date(b.at)) === today).length;
  const latest: FlowerKind | null = s.garden[0] ? flowerOf(s.garden[0].flower) : null;
  const total = s.bloomCount ?? s.garden.length;
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
    week: weekDots(s.checkins, now),
    garden: { total, today: bloomsToday, latest, toGolden, golden: GOLDEN_EVERY, recent: s.garden.slice(0, 5).map((b) => flowerOf(b.flower)) },
    tasks: focusList(s.tasks, today, low),
    focus: focusState(s, now),
    reach: reachPicks(s.people),
    matrix: matrixCells(s.tasks, today, s.widgetPrefs.Matrix.completed),
    names: {
      matrix: ([1, 2, 3, 4] as const).map((q) => quadrantName(s.labels, q)),
      circle: ([1, 2, 3, 4] as const).map((q) => circleName(s.labels, q)),
    },
    circle: circleCells(s.people),
    locks: { Tasks: !!s.widgetLocks?.Tasks, Matrix: !!s.widgetLocks?.Matrix },
    undo: {
      Tasks: undoLabel(widgetUndoFor({ widgetUndo: s.widgetUndo ?? null, tasks: s.tasks }, 'Tasks', now.getTime())),
      Matrix: undoLabel(widgetUndoFor({ widgetUndo: s.widgetUndo ?? null, tasks: s.tasks }, 'Matrix', now.getTime())),
    },
  };
}

/** Each Eisenhower quadrant: open tasks (dated first, soonest due), then finished ones if asked for. */
function matrixCells(tasks: Task[], today: string, withDone: boolean) {
  return ([1, 2, 3, 4] as const).map((q) => {
    const open = sortOpen(tasks.filter((t) => t.quadrant === q && !t.done));
    const done = withDone ? tasks.filter((t) => t.quadrant === q && t.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0)) : [];
    return {
      q,
      tasks: [...open, ...done].map((t) => ({ id: t.id, title: t.title, done: t.done, due: t.done ? null : dueText(t.due, today), effort: effortMark(t), steps: stepsText(t), next: t.done ? null : (stepProgress(t)?.next ?? null) })),
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
      .map((p) => ({
        id: p.id,
        name: p.name,
        uri: reachUri(p.phone, info.mode, info.opener),
        tel: p.phone ? `tel:${cleanNumber(p.phone)}` : null,
        whatsapp: p.phone ? `https://wa.me/${whatsappNumber(p.phone)}?text=${encodeURIComponent(info.opener)}` : null,
      }));
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
  const doFirst = sortOpen(tasks.filter((t) => t.quadrant === 1 && !t.done && !dueNow.includes(t)));
  const all = [...dueNow, ...doFirst];
  const limit = low ? 1 : 4;
  const doneToday = tasks.filter((t) => t.done && t.doneAt && dayKey(new Date(t.doneAt)) === today).length;
  return {
    items: all.slice(0, limit).map((t) => ({ id: t.id, title: t.title, quadrant: t.quadrant, due: dueText(t.due, today), effort: effortMark(t), steps: stepsText(t), next: t.done ? null : (stepProgress(t)?.next ?? null) })),
    more: Math.max(0, all.length - limit),
    doneToday,
  };
}

/** What Undo would put back: the step's name when a step was ticked, else the task's. */
function undoLabel(hit: ReturnType<typeof widgetUndoFor>): string | null {
  return hit ? (hit.undoStep?.title ?? hit.title) : null;
}

/** The task's effort symbol (🪶 Quick, 🌿 Light, 🌳 Moderate, 🏔️ Deep work), or null when none is set. */
function effortMark(t: Task): string | null {
  return t.effort ? effortInfo(t.effort).emoji : null;
}

/** "2/5" for a task with steps still open, or null. */
function stepsText(t: Task): string | null {
  const p = stepProgress(t);
  return p && !t.done ? `${p.done}/${p.total}` : null;
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
  const todays = s.focus.sessions.filter((f) => dayKey(new Date(f.at)) === today);
  const sessionsToday = todays.length;
  const minutesToday = todays.reduce((n, f) => n + f.minutes, 0);
  if (!a) return { running: false as const, sessionsToday, minutesToday };
  const paused = a.endAt === null;
  const endAt = a.endAt ?? now.getTime() + (a.pausedLeft ?? 0);
  const end = new Date(endAt);
  const until = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
  const leftMin = Math.max(0, Math.ceil(((a.endAt ?? now.getTime() + (a.pausedLeft ?? 0)) - now.getTime()) / 60_000));
  const task = a.taskId ? s.tasks.find((t) => t.id === a.taskId)?.title : undefined;
  const leftMs = a.endAt !== null ? Math.max(0, a.endAt - now.getTime()) : (a.pausedLeft ?? a.total);
  const progress = a.total > 0 ? Math.min(1, Math.max(0, 1 - leftMs / a.total)) : 0;
  const totalMin = Math.round(a.total / 60_000);
  return { running: true as const, kind: a.kind, paused, until, leftMin, task, sessionsToday, minutesToday, progress, totalMin, sound: s.settings?.focusSound ?? 'off' };
}

/** The last seven days as mood colours (null when not checked in), oldest first. */
function weekDots(checkins: Record<string, number>, now: Date) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const m = moodOf(checkins[dayKey(d)] as MoodValue | undefined);
    return { letter: 'SMTWTFS'[d.getDay()], color: m ? m.colors[1] : null, today: i === 6 };
  });
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
