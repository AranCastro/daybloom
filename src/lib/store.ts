/**
 * App state: a tiny external store persisted to on-device storage.
 * Everything (moods, tasks, settings) stays on the phone. The buddy nudge is a message the
 * user sends themselves with one tap (SMS or WhatsApp); the app sends nothing on its own.
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
import { isLowStreak } from '@/lib/nudge-rule';

export type NudgeLog = {
  at: number;
  kind: 'auto' | 'test';
  /**
   * ready: waiting for the user's one tap; opened: the message was opened in SMS or WhatsApp;
   * dismissed: "Not now". (sent / queued / expired come from older versions that used ntfy.)
   */
  status: 'ready' | 'opened' | 'dismissed' | 'sent' | 'queued' | 'expired';
  /** Who it was for, as named at the time. */
  to?: string;
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
  /** The nudge buddy: a person in the circle, or null for "automatic" (the first person in Call anytime). */
  buddyId: string | null;
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
  /** The user's own names for the matrix quadrants and circle sections (empty = the default name). */
  labels: { matrix: Partial<Record<Quadrant, string>>; circle: Partial<Record<CircleQuadrant, string>> };
  /** Profile picture: a photo saved in the app's storage, or one of the built-in avatars. */
  avatar: { kind: 'photo'; uri: string } | { kind: 'preset'; id: string } | null;
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
  /** Light or dark for every home-screen widget; "system" follows the phone. */
  widgetTheme: 'system' | 'light' | 'dark';
};

export const DEFAULT_SETTINGS: Settings = { appearance: 'system', haptics: true, reduceMotion: false, weekStart: 0, focusPreset: 'classic', autoBackup: true, widgetTheme: 'system' };

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
  buddyId: null,
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
  labels: { matrix: {}, circle: {} },
  avatar: null,
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
  merged.labels = { matrix: { ...saved.labels?.matrix }, circle: { ...saved.labels?.circle } };
  // Older versions kept a separate ntfy buddy; now the buddy is a person in the circle.
  const legacy = (saved as { buddy?: { name?: string } | null }).buddy;
  if (saved.buddyId === undefined) {
    const match = legacy?.name ? merged.people.find((p) => p.name.trim().toLowerCase() === legacy.name!.trim().toLowerCase()) : undefined;
    merged.buddyId = match?.id ?? null;
  }
  delete (merged as { buddy?: unknown }).buddy;
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
  // Backups carry no photo: keep this phone's profile photo if the backup has no avatar of its own.
  if (!next.avatar && state.avatar?.kind === 'photo') next.avatar = state.avatar;
  set(next);
}

/** Renames a matrix quadrant or circle section; an empty name brings back the default. */
export function setLabel(kind: 'matrix' | 'circle', q: Quadrant, name: string) {
  const clean = name.trim().slice(0, 24);
  update((s) => {
    const next = { ...s.labels[kind] };
    if (clean) next[q] = clean;
    else delete next[q];
    return { labels: { ...s.labels, [kind]: next } };
  });
}

export function setBackupInfo(patch: Partial<AppState['backup']>) {
  update((s) => ({ backup: { ...s.backup, ...patch } }));
}

export function resetAll() {
  removeItem(KEY);
  set(initial);
}

/**
 * The buddy: the person chosen in the circle, or automatically the first person added to
 * "Call anytime" (preferring someone with a phone number).
 */
export function resolveBuddy(s: Pick<AppState, 'people' | 'buddyId'> = state): Person | null {
  if (s.buddyId) {
    const chosen = s.people.find((p) => p.id === s.buddyId);
    if (chosen) return chosen;
  }
  const close = s.people.filter((p) => p.quadrant === 1).sort((a, b) => a.createdAt - b.createdAt);
  return close.find((p) => p.phone) ?? close[0] ?? null;
}

export function setBuddy(id: string | null) {
  update({ buddyId: id });
}

let nudgeListener: ((name: string) => void) | null = null;

/** The app shell registers a notifier (a local notification) for when a nudge is ready. */
export function onNudgeReady(fn: (name: string) => void) {
  nudgeListener = fn;
}

/**
 * Records today's mood. When the low-streak rule is met, a nudge becomes "ready": the user is
 * offered one tap to message their buddy. It is logged and disarmed at once, so changing the
 * answer the same day cannot offer it again; only a later day that is Okay or better re-arms it.
 * Returns true when this check-in made a nudge ready.
 */
export async function recordMood(mood: MoodValue): Promise<boolean> {
  const today = dayKey();
  const firstToday = state.checkins[today] === undefined;
  const checkins = { ...state.checkins, [today]: mood };
  const rearm = mood > 2 && (!state.lastNudgeDay || today > state.lastNudgeDay);
  const armed = rearm ? true : state.armed;
  update({ checkins, armed });
  if (firstToday) bloom('checkin', { note: 'Daily check-in' });

  const buddy = resolveBuddy();
  if (!buddy || !armed || !isLowStreak(checkins, state.streak, today)) return false;

  const entry: NudgeLog = { at: Date.now(), kind: 'auto', status: 'ready', to: buddy.name };
  update((s) => ({ armed: false, lastNudgeDay: today, nudges: [entry, ...s.nudges].slice(0, 50) }));
  nudgeListener?.(buddy.name);
  return true;
}

/** Today's ready (or opened) nudge, if any. */
export function todaysNudge(s: Pick<AppState, 'nudges'> = state): NudgeLog | undefined {
  const today = dayKey();
  return s.nudges.find((n) => n.kind === 'auto' && dayKey(new Date(n.at)) === today && (n.status === 'ready' || n.status === 'opened'));
}

/** Marks today's nudge as opened in SMS / WhatsApp (and counts it as reaching out). */
export function markNudgeOpened() {
  const buddy = resolveBuddy();
  const n = todaysNudge();
  if (n) update((s) => ({ nudges: s.nudges.map((x): NudgeLog => (x === n ? { ...x, status: 'opened' } : x)) }));
  if (buddy) markReached(buddy.id);
}

export function dismissNudge() {
  const n = todaysNudge();
  if (n) update((s) => ({ nudges: s.nudges.map((x): NudgeLog => (x === n ? { ...x, status: 'dismissed' } : x)) }));
}

/** The message the user sends. It says nothing about mood. */
export function nudgeMessage(buddyName: string, myName: string): string {
  return `Hi ${buddyName}, could you give me a call today when you have a moment?${myName ? ` – ${myName}` : ''}`;
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

export function addPerson(name: string, quadrant: CircleQuadrant, phone?: string): Person {
  const person: Person = { id: newId(), name: name.trim(), phone: phone?.trim() || undefined, quadrant, createdAt: Date.now() };
  update((s) => ({ people: [...s.people, person] }));
  return person;
}

export function editPerson(id: string, patch: Partial<Pick<Person, 'name' | 'phone' | 'quadrant'>>) {
  update((s) => ({ people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
}

export function deletePerson(id: string) {
  if (state.buddyId === id) update({ buddyId: null });
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
