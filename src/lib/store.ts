/**
 * App state: a tiny external store persisted to on-device storage.
 * Everything (moods, tasks, settings) stays on the phone. The only thing that
 * ever leaves it is the one-line nudge sent to the buddy's ntfy topic.
 */
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { dayKey } from '@/lib/dates';
import { readItem, removeItem, writeItem } from '@/lib/kv';
import { Badge, newlyEarned } from '@/lib/badges';
import { FlowerKind, flowerOf, pickFlower } from '@/lib/flowers';
import type { ActiveTimer, FocusSession } from '@/lib/focus';
import { MoodValue } from '@/lib/moods';
import { sortOpen } from '@/lib/quadrants';
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
  /** queued: waiting for the internet; expired: too old to send ("call me today" would be wrong). */
  status: 'sent' | 'queued' | 'expired';
};

/** A nudge that could not be sent within this time is dropped rather than sent late. */
const NUDGE_TTL = 36 * 60 * 60 * 1000;

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
  /** Position set by hand (Arrange); tasks without one follow, in the automatic order. */
  order?: number;
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

/** Everything the user does can grow a flower. */
export type BloomSource = 'checkin' | 'task' | 'focus' | 'game' | 'reach' | 'badge';

export type Bloom = {
  id: string;
  at: number;
  flower: string;
  source: BloomSource;
  /** Task id, game id, person id or badge id that earned it. */
  ref?: string;
  /** Short human note, e.g. the task title. */
  note?: string;
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
  /** False after a nudge fires; re-armed by a later day that is Okay or better. */
  armed: boolean;
  /** Day (YYYY-MM-DD) of the last automatic nudge, so changing an answer that day cannot re-arm it. */
  lastNudgeDay?: string;
  /** Every flower ever grown (the garden list keeps the newest 2,000); drives the Golden Lotus. */
  bloomCount: number;
  /** Tasks finished per day that were later cleared, so the calendar keeps their shading. */
  clearedWork: Record<string, number>;
  tasks: Task[];
  people: Person[];
  /** Best scores and play counts per game id. */
  games: { best: Record<string, number>; plays: Record<string, number> };
  /** The unified garden, newest first. */
  garden: Bloom[];
  /** Badge id -> epoch ms when earned. Kept even if a streak later ends. */
  badges: Record<string, number>;
  /** Pomodoro: completed sessions (newest first) and the running timer. */
  focus: { sessions: FocusSession[]; active: ActiveTimer | null };
  /** Look of the matrix-style home-screen widgets, set in Settings → Home screen widgets. */
  widgetPrefs: Record<'Matrix' | 'Circle', WidgetPrefs>;
  /** App-wide preferences from Settings. */
  settings: Settings;
  /** When backups were last made (kept on this phone; not replaced by a restore). */
  backup: { lastManual?: number; lastAuto?: number; lastRestore?: number; pendingSave?: boolean };
};

export type Settings = {
  /** Light or dark look; "system" follows the phone. */
  appearance: 'system' | 'light' | 'dark';
  /** Vibration on taps, check-ins and games. */
  haptics: boolean;
  /** Turns off decorative animation (breathing orb, screen transitions' flourishes). */
  reduceMotion: boolean;
  /** First day of the week in the calendar: 0 Sunday, 1 Monday. */
  weekStart: 0 | 1;
  /** Session the focus timer suggests (a low day still suggests Gentle). */
  focusPreset: 'gentle' | 'classic' | 'deep';
  /** Keep a fresh backup file on the phone every week and offer to save it to Drive. */
  autoBackup: boolean;
};

export const DEFAULT_SETTINGS: Settings = { appearance: 'system', haptics: true, reduceMotion: false, weekStart: 0, focusPreset: 'classic', autoBackup: true };

export type WidgetPrefs = {
  theme: 'auto' | 'light' | 'dark';
  /** Background opacity, 40–100 (%). */
  opacity: number;
  font: 'small' | 'default' | 'large';
  /** Matrix: tick circles next to tasks. Circle: call and message buttons. */
  checkbox: boolean;
  /** Matrix only: also list finished tasks. */
  completed: boolean;
};

export const DEFAULT_WIDGET_PREFS: WidgetPrefs = { theme: 'auto', opacity: 100, font: 'default', checkbox: true, completed: false };

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
  badges: {},
  garden: [],
  widgetPrefs: { Matrix: DEFAULT_WIDGET_PREFS, Circle: DEFAULT_WIDGET_PREFS },
  settings: DEFAULT_SETTINGS,
  backup: {},
  bloomCount: 0,
  clearedWork: {},
};

/** Fills in anything a saved (or restored) state is missing, so older data keeps working. */
function mergeSaved(saved: Partial<AppState>): AppState {
  const merged = { ...initial, ...saved };
  merged.widgetPrefs = { ...initial.widgetPrefs, ...saved.widgetPrefs };
  merged.settings = { ...DEFAULT_SETTINGS, ...saved.settings };
  merged.backup = { ...initial.backup, ...saved.backup };
  // Nested objects are merged too, so fields added in later versions get their defaults.
  merged.reminder = { ...initial.reminder, ...saved.reminder };
  merged.games = { best: { ...saved.games?.best }, plays: { ...saved.games?.plays } };
  merged.focus = { ...initial.focus, ...saved.focus };
  if (saved.bloomCount === undefined) merged.bloomCount = merged.garden.length;
  merged.clearedWork = { ...saved.clearedWork };
  // Older data has no lastNudgeDay: take it from the newest automatic nudge.
  if (!merged.lastNudgeDay) {
    const last = (merged.nudges ?? []).find((n) => n.kind === 'auto');
    if (last) merged.lastNudgeDay = dayKey(new Date(last.at));
  }
  // Gardens began with focus sessions only: carry those flowers over once.
  if (!saved.garden && saved.focus?.sessions?.length) {
    merged.garden = saved.focus.sessions.map((f, i) => ({ id: `m${i}-${f.at}`, at: f.at, flower: f.flower, source: 'focus' as const, ref: f.taskId }));
  }
  return merged;
}

function load(): AppState {
  const raw = readItem(KEY);
  if (!raw) return initial;
  try {
    return mergeSaved(JSON.parse(raw) as Partial<AppState>);
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

/** Re-reads saved state (a home-screen widget may have changed it while the app was closed). */
export function reloadState(): void {
  state = load();
  listeners.forEach((l) => l());
}

/** Plain change subscription, for code outside React (home-screen widgets). */
export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
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

export function setSettings(patch: Partial<Settings>) {
  update((s) => ({ settings: { ...s.settings, ...patch } }));
}

/** Whether to vibrate (off on web and when switched off in Settings). */
export function hapticsOn(): boolean {
  return Platform.OS !== 'web' && state.settings.haptics;
}

export function setWidgetPrefs(name: keyof AppState['widgetPrefs'], patch: Partial<WidgetPrefs>) {
  update((s) => ({ widgetPrefs: { ...s.widgetPrefs, [name]: { ...s.widgetPrefs[name], ...patch } } }));
}

/**
 * Replaces everything with a restored backup. Backup bookkeeping stays as it is on this phone,
 * and a focus timer that was running when the backup was made is dropped.
 */
export function replaceState(saved: Partial<AppState>) {
  const next = mergeSaved(saved);
  next.backup = { ...state.backup, lastRestore: Date.now(), pendingSave: false };
  next.focus = { ...next.focus, active: null };
  set(next);
}

export function setBackupInfo(patch: Partial<AppState['backup']>) {
  update((s) => ({ backup: { ...s.backup, ...patch } }));
}

export function resetAll() {
  removeItem(KEY);
  set(initial);
}

/**
 * Records today's mood and, when the low-streak rule is met, nudges the buddy.
 * Returns true when a nudge was triggered by this check-in.
 *
 * The nudge is disarmed and logged before the network request, so a second answer while it is
 * being sent (or a widget tap) cannot send another. Only a later day that is Okay or better
 * re-arms it; changing today's answer back and forth does not.
 */
export async function recordMood(mood: MoodValue): Promise<boolean> {
  const today = dayKey();
  const firstToday = state.checkins[today] === undefined;
  const checkins = { ...state.checkins, [today]: mood };
  const rearm = mood > 2 && (!state.lastNudgeDay || today > state.lastNudgeDay);
  const armed = rearm ? true : state.armed;
  update({ checkins, armed });
  if (firstToday) bloom('checkin', { note: 'Daily check-in' });

  const { buddy, streak } = state;
  if (!buddy || !armed || !isLowStreak(checkins, streak, today)) return false;

  const entry: NudgeLog = { at: Date.now(), kind: 'auto', status: 'queued' };
  update((s) => ({ armed: false, lastNudgeDay: today, nudges: [entry, ...s.nudges].slice(0, 50) }));
  await flushQueued();
  return true;
}

let flushing: Promise<void> | null = null;

/**
 * Sends a nudge that is waiting for the internet (one at a time). Called after a check-in, when the
 * app opens or returns, and from the home-screen widget's background task.
 */
export function flushQueued(): Promise<void> {
  if (!flushing) {
    flushing = doFlush().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function doFlush() {
  const now = Date.now();
  // Too late to ask for a call "today": drop it instead of sending it days later.
  if (state.nudges.some((n) => n.status === 'queued' && now - n.at > NUDGE_TTL)) {
    update((s) => ({ nudges: s.nudges.map((n): NudgeLog => (n.status === 'queued' && now - n.at > NUDGE_TTL ? { ...n, status: 'expired' } : n)) }));
  }
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
  // A task moved to another quadrant joins it at the end of the arranged tasks.
  update((s) => ({
    tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch, order: patch.quadrant && patch.quadrant !== t.quadrant ? undefined : t.order } : t)),
  }));
}

export function toggleTask(id: string) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  update((s) => ({
    tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: t.done ? undefined : Date.now() } : t)),
  }));
  // A finished task grows a flower; un-finishing it takes that flower back.
  if (!task.done) bloom('task', { ref: id, note: task.title, rareChance: task.quadrant === 1 ? 0.15 : 0.1 });
  else
    update((s) => {
      const garden = s.garden.filter((b) => !(b.source === 'task' && b.ref === id));
      return { garden, bloomCount: Math.max(0, s.bloomCount - (s.garden.length - garden.length)) };
    });
}

export function deleteTask(id: string) {
  update((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
}

/** Removes the finished tasks of one quadrant. Their days keep their calendar shading. */
export function clearCompleted(quadrant: Quadrant) {
  update((s) => {
    const clearedWork = { ...s.clearedWork };
    for (const t of s.tasks) {
      if (t.quadrant === quadrant && t.done && t.doneAt) {
        const k = dayKey(new Date(t.doneAt));
        clearedWork[k] = (clearedWork[k] ?? 0) + 1;
      }
    }
    return { clearedWork, tasks: s.tasks.filter((t) => !(t.quadrant === quadrant && t.done)) };
  });
}

/** Open tasks in a quadrant: arranged ones first (by hand), then dated (soonest due), then by creation. */
export function openTasks(tasks: Task[], quadrant: Quadrant): Task[] {
  return sortOpen(tasks.filter((t) => t.quadrant === quadrant && !t.done));
}

/** Moves an open task within its quadrant. Fixes the order of the whole quadrant from then on. */
export function moveTask(id: string, to: 'up' | 'down' | 'top' | 'bottom') {
  const task = state.tasks.find((t) => t.id === id);
  if (!task || task.done) return;
  const list = openTasks(state.tasks, task.quadrant).map((t) => t.id);
  const from = list.indexOf(id);
  const target = to === 'up' ? from - 1 : to === 'down' ? from + 1 : to === 'top' ? 0 : list.length - 1;
  if (target < 0 || target >= list.length || target === from) return;
  list.splice(from, 1);
  list.splice(target, 0, id);
  const pos = new Map(list.map((x, i) => [x, i]));
  update((s) => ({ tasks: s.tasks.map((t) => (pos.has(t.id) ? { ...t, order: pos.get(t.id) } : t)) }));
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
  const person = state.people.find((p) => p.id === id);
  update((s) => ({ people: s.people.map((p) => (p.id === id ? { ...p, lastReachedAt: Date.now() } : p)) }));
  if (!bloomedToday('reach')) bloom('reach', { ref: id, note: person ? `Reached out to ${person.name}` : 'Reached out' });
}

/** People in a quadrant, least recently reached first, so suggestions rotate around the circle. */
export function peopleIn(people: Person[], quadrant: CircleQuadrant): Person[] {
  return people
    .filter((p) => p.quadrant === quadrant)
    .sort((a, b) => (a.lastReachedAt ?? 0) - (b.lastReachedAt ?? 0) || a.createdAt - b.createdAt);
}

// ── Games ────────────────────────────────────────────────────────────────────

/** Records a finished round. Returns true when it beats the previous best. */
const GAME_NAMES: Record<string, string> = { breathe: 'Breathe', bubbles: 'Bubble Pop', memory: 'Pair Up', colours: 'Colour Clash' };

export function recordGame(id: string, score: number, lowerIsBetter = false): boolean {
  // First finish of each game per day grows a flower.
  const game = id.startsWith('bubbles') ? 'bubbles' : id.split('-')[0];
  if (!bloomedToday('game', game)) bloom('game', { ref: game, note: GAME_NAMES[game] ?? 'Game' });
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

// ── Badges ───────────────────────────────────────────────────────────────────

/** Awards any badges now earned and returns the new ones (for the celebration). */
export function awardBadges(): Badge[] {
  const fresh = newlyEarned(state.checkins, state.badges);
  if (fresh.length) {
    const at = Date.now();
    update((s) => ({ badges: { ...s.badges, ...Object.fromEntries(fresh.map((b) => [b.id, at])) } }));
    // Every badge brings a rare flower.
    fresh.forEach((b) => bloom('badge', { ref: b.id, note: `Badge: ${b.title}`, rareChance: 1 }));
  }
  return fresh;
}

// ── Garden ───────────────────────────────────────────────────────────────────

type BloomListener = (b: Bloom, kind: FlowerKind) => void;
const bloomListeners = new Set<BloomListener>();

/** Subscribe to new blooms (used by the global "a flower bloomed" toast). */
export function onBloom(l: BloomListener): () => void {
  bloomListeners.add(l);
  return () => bloomListeners.delete(l);
}

export function bloomedToday(source: BloomSource, ref?: string): boolean {
  const today = dayKey();
  return state.garden.some((b) => b.source === source && (ref === undefined || b.ref === ref) && dayKey(new Date(b.at)) === today);
}

/** Grows one flower. `silent` skips the toast (the focus screen shows its own reveal). */
export function bloom(source: BloomSource, opts: { ref?: string; note?: string; rareChance?: number; silent?: boolean } = {}): FlowerKind {
  const kind = pickFlower(state.bloomCount + 1, state.garden[0]?.flower, opts.rareChance ?? 0.1);
  const b: Bloom = { id: newId(), at: Date.now(), flower: kind.id, source, ref: opts.ref, note: opts.note };
  update((s) => ({ garden: [b, ...s.garden].slice(0, 2000), bloomCount: s.bloomCount + 1 }));
  if (!opts.silent) bloomListeners.forEach((l) => l(b, kind));
  return kind;
}

export { flowerOf };
