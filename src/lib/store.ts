/**
 * App state: a tiny external store persisted to on-device storage.
 * Everything (moods, tasks, settings) stays on the phone. The only thing that
 * ever leaves it is the one-line nudge sent to the buddy's ntfy topic.
 */
import { useSyncExternalStore } from 'react';

import { dayKey } from '@/lib/dates';
import { readItem, removeItem, writeItem } from '@/lib/kv';
import type { ActiveTimer, FocusSession } from '@/lib/focus';
import { MoodValue } from '@/lib/moods';
import { buddyHasJoined, sendNudge, sendTest } from '@/lib/ntfy';
import { isLowStreak } from '@/lib/nudge-rule';

export type Buddy = {
  name: string;
  topic: string;
  joined: boolean;
};

export type NudgeLog = {
  at: number;
  kind: 'auto' | 'test';
  status: 'sent' | 'queued';
};

/** Eisenhower quadrant: 1 do first, 2 schedule, 3 delegate, 4 drop. */
export type Quadrant = 1 | 2 | 3 | 4;

export type Task = {
  id: string;
  title: string;
  quadrant: Quadrant;
  /** YYYY-MM-DD, optional. */
  due?: string;
  done: boolean;
  doneAt?: number;
  createdAt: number;
};

/** Circle quadrant: 1 call anytime, 2 quick call, 3 message first, 4 light chat. */
export type CircleQuadrant = 1 | 2 | 3 | 4;

export type Person = {
  id: string;
  name: string;
  /** As stored in the phone book or typed; digits and a leading + are kept for dialling. */
  phone?: string;
  quadrant: CircleQuadrant;
  lastReachedAt?: number;
  createdAt: number;
};

export type AppState = {
  version: 1;
  onboarded: boolean;
  name: string;
  buddy: Buddy | null;
  /** Consecutive low days that trigger a nudge. */
  streak: 2 | 3 | 4;
  reminder: { enabled: boolean; hour: number; minute: number };
  /** YYYY-MM-DD -> mood value (1..5). One entry per day, last tap wins. */
  checkins: Record<string, MoodValue>;
  nudges: NudgeLog[];
  /** False after a nudge fires; re-armed by the next day that is not low. */
  armed: boolean;
  tasks: Task[];
  people: Person[];
  /** Best scores and play counts per game id. */
  games: { best: Record<string, number>; plays: Record<string, number> };
  /** Pomodoro: completed sessions (newest first) and the running timer. */
  focus: { sessions: FocusSession[]; active: ActiveTimer | null };
};

const KEY = 'nudge.state.v1';

const initial: AppState = {
  version: 1,
  onboarded: false,
  name: '',
  buddy: null,
  streak: 3,
  reminder: { enabled: true, hour: 21, minute: 0 },
  checkins: {},
  nudges: [],
  armed: true,
  tasks: [],
  people: [],
  games: { best: {}, plays: {} },
  focus: { sessions: [], active: null },
};

function load(): AppState {
  const raw = readItem(KEY);
  if (!raw) return initial;
  try {
    return { ...initial, ...(JSON.parse(raw) as Partial<AppState>) };
  } catch {
    return initial;
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function set(next: AppState) {
  state = next;
  writeItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

export function update(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
  const p = typeof patch === 'function' ? patch(state) : patch;
  set({ ...state, ...p });
}

export function getState(): AppState {
  return state;
}

export function useAppState<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => select(state),
    () => select(state),
  );
}

export function resetAll() {
  removeItem(KEY);
  set(initial);
}

/**
 * Records today's mood and, when the low-streak rule is met, nudges the buddy.
 * Returns true when a nudge was triggered by this check-in.
 */
export async function recordMood(mood: MoodValue): Promise<boolean> {
  const today = dayKey();
  const checkins = { ...state.checkins, [today]: mood };
  const armed = mood > 2 ? true : state.armed;
  update({ checkins, armed });

  const { buddy, streak } = state;
  if (!buddy || !armed || !isLowStreak(checkins, streak, today)) return false;

  const ok = await sendNudge(buddy.topic, state.name || 'Your friend');
  const entry: NudgeLog = { at: Date.now(), kind: 'auto', status: ok ? 'sent' : 'queued' };
  update((s) => ({ armed: false, nudges: [entry, ...s.nudges].slice(0, 50) }));
  return true;
}

/** Retries a nudge that could not be delivered earlier (for example, offline). */
export async function flushQueued() {
  const { buddy, nudges, name } = state;
  if (!buddy || !nudges.some((n) => n.status === 'queued')) return;
  const ok = await sendNudge(buddy.topic, name || 'Your friend');
  if (ok) update((s) => ({ nudges: s.nudges.map((n): NudgeLog => (n.status === 'queued' ? { ...n, status: 'sent' } : n)) }));
}

export async function testNudge(): Promise<boolean> {
  const { buddy, name } = state;
  if (!buddy) return false;
  const ok = await sendTest(buddy.topic, name || 'Your friend');
  const entry: NudgeLog = { at: Date.now(), kind: 'test', status: 'sent' };
  if (ok) update((s) => ({ nudges: [entry, ...s.nudges].slice(0, 50) }));
  return ok;
}

export async function refreshBuddyJoined() {
  const { buddy } = state;
  if (!buddy || buddy.joined) return;
  if (await buddyHasJoined(buddy.topic)) {
    update((s) => ({ buddy: s.buddy ? { ...s.buddy, joined: true } : null }));
  }
}

// ── Tasks (Eisenhower matrix) ────────────────────────────────────────────────

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function addTask(title: string, quadrant: Quadrant, due?: string) {
  const task: Task = { id: newId(), title: title.trim(), quadrant, due, done: false, createdAt: Date.now() };
  update((s) => ({ tasks: [...s.tasks, task] }));
}

export function editTask(id: string, patch: Partial<Pick<Task, 'title' | 'quadrant' | 'due'>>) {
  update((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
}

export function toggleTask(id: string) {
  update((s) => ({
    tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: t.done ? undefined : Date.now() } : t)),
  }));
}

export function deleteTask(id: string) {
  update((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
}

export function clearCompleted() {
  update((s) => ({ tasks: s.tasks.filter((t) => !t.done) }));
}

/** Open tasks in a quadrant: dated tasks first (soonest due), then undated by creation. */
export function openTasks(tasks: Task[], quadrant: Quadrant): Task[] {
  return tasks
    .filter((t) => t.quadrant === quadrant && !t.done)
    .sort((a, b) => {
      if (a.due && b.due) return a.due.localeCompare(b.due);
      if (a.due) return -1;
      if (b.due) return 1;
      return a.createdAt - b.createdAt;
    });
}

// ── People (support circle matrix) ───────────────────────────────────────────

export function addPerson(name: string, quadrant: CircleQuadrant, phone?: string) {
  const person: Person = { id: newId(), name: name.trim(), phone: phone?.trim() || undefined, quadrant, createdAt: Date.now() };
  update((s) => ({ people: [...s.people, person] }));
}

export function editPerson(id: string, patch: Partial<Pick<Person, 'name' | 'phone' | 'quadrant'>>) {
  update((s) => ({ people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
}

export function deletePerson(id: string) {
  update((s) => ({ people: s.people.filter((p) => p.id !== id) }));
}

export function markReached(id: string) {
  update((s) => ({ people: s.people.map((p) => (p.id === id ? { ...p, lastReachedAt: Date.now() } : p)) }));
}

/** People in a quadrant, least recently reached first, so suggestions rotate around the circle. */
export function peopleIn(people: Person[], quadrant: CircleQuadrant): Person[] {
  return people
    .filter((p) => p.quadrant === quadrant)
    .sort((a, b) => (a.lastReachedAt ?? 0) - (b.lastReachedAt ?? 0) || a.createdAt - b.createdAt);
}

// ── Games ────────────────────────────────────────────────────────────────────

/** Records a finished round. Returns true when it beats the previous best. */
export function recordGame(id: string, score: number, lowerIsBetter = false): boolean {
  const prev = state.games.best[id];
  const isBest = prev === undefined || (lowerIsBetter ? score < prev : score > prev);
  update((s) => ({
    games: {
      best: isBest ? { ...s.games.best, [id]: score } : s.games.best,
      plays: { ...s.games.plays, [id]: (s.games.plays[id] ?? 0) + 1 },
    },
  }));
  return isBest;
}
