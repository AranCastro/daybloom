/**
 * App state: a tiny external store persisted to on-device storage.
 * Everything (moods, tasks, settings) stays on the phone. The buddy nudge is a message the
 * user sends themselves with one tap (SMS or WhatsApp); the app sends nothing on its own.
 */
import { useSyncExternalStore } from 'react';
import { AppState as RNAppState, Platform } from 'react-native';

import { dayKey } from '@/lib/dates';
import { readItem, removeItem, writeItem } from '@/lib/kv';
import { Badge, newlyEarned } from '@/lib/badges';
import { FlowerKind, flowerOf, pickFlower } from '@/lib/flowers';
import type { ActiveTimer, FocusSession } from '@/lib/focus';
import { MoodValue } from '@/lib/moods';
import { sortOpen } from '@/lib/quadrants';
import { isLowStreak } from '@/lib/nudge-rule';
import { rewardFor } from '@/lib/effort';
import { instanceId, normaliseTimes, occursOn, Routine } from '@/lib/routines';
import { sanitise } from '@/lib/sanitise';

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
  /** How much it takes (lib/effort): the day's energy decides which levels the matrix shows. */
  effort?: 'quick' | 'light' | 'moderate' | 'deep';
  /** Smaller steps for a task that takes more than one sitting. */
  steps?: TaskStep[];
  /** Days (YYYY-MM-DD) with progress on this task: a step ticked or "Worked on it today". */
  workedOn?: string[];
  /** Set on a task added by a routine (lib/routines): the routine, which time slot, and its time. */
  routineId?: string;
  slot?: number;
  at?: string;
};

export type { Routine } from '@/lib/routines';

export type TaskStep = { id: string; title: string; done: boolean };

/** Morning energy: 1 low, 2 medium, 3 high. */
export type EnergyLevel = 1 | 2 | 3;

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
  /** YYYY-MM-DD -> optional feeling tags chosen after the check-in (ids from lib/mood-tags). */
  moodTags: Record<string, string[]>;
  /** Jar of good days: YYYY-MM-DD -> one line about what went well (bright days). */
  goodNotes: Record<string, string>;
  /** Places the user named (Home, Office…), optionally with coordinates from the phone's GPS. */
  places: Place[];
  /** YYYY-MM-DD -> id of the place where that day's check-in was made. */
  checkinPlace: Record<string, string>;
  /** Thottam: poo kolam designs made from the flowers grown. */
  pookalams: Pookalam[];
  /** YYYY-MM-DD -> energy that morning. */
  energy: Record<string, EnergyLevel>;
  nudges: NudgeLog[];
  /** False after a nudge fires; re-armed by a later day that is Okay or better. */
  armed: boolean;
  /** Day (YYYY-MM-DD) of the last automatic nudge, so changing an answer that day cannot re-arm it. */
  lastNudgeDay?: string;
  /** Flowers in the garden, counting past the newest 2,000 the list keeps (unticking a task takes its flower back). */
  bloomCount: number;
  /** Every flower ever grown, never taken back: drives the Golden Lotus, so untick and tick cannot earn it twice. */
  bloomsEver: number;
  /** Tasks finished per day that were later cleared, so the calendar keeps their shading. */
  clearedWork: Record<string, number>;
  /** Focus sessions per day that fell off the 500-session list, so shading and streaks keep them. */
  clearedFocus: Record<string, { sessions: number; minutes: number }>;
  /** Routine tasks (every day, weekly, every few days), from which each day's tasks are added. */
  routines: Routine[];
  /** The last day each routine added its tasks, so a task deleted for today does not come back. */
  routineMade: Record<string, string>;
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
  widgetPrefs: Record<WidgetKey, WidgetPrefs>;
  /** Home-screen task widgets that are locked: taps open the app instead of ticking tasks off. */
  widgetLocks: Partial<Record<TaskWidget, boolean>>;
  /** The last task ticked off from a widget, so the widget can offer Undo for a few minutes. */
  /** `stepId` when the widget tap ticked a step of a big task rather than the whole task. */
  widgetUndo: { taskId: string; stepId?: string; widget: TaskWidget; at: number } | null;
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
  /** Background sound during focus sessions (an id from lib/sounds), or "off". */
  focusSound: string;
  /** Focus sound volume, 0–1. */
  focusVolume: number;
  /** Live weather and day/night in the garden, from the phone's approximate location (open-meteo.com). */
  liveWeather: boolean;
};

export type Place = { id: string; name: string; emoji: string; lat?: number; lon?: number; createdAt: number };

export type PookalamRing = { flower: string; pattern: 'solid' | 'alternate' | 'petals' | 'dots' };
export type Pookalam = {
  id: string;
  name: string;
  /** Centre first, then rings outward. */
  center: string;
  rings: PookalamRing[];
  /** Border decoration: Onam (plain petals), Diwali (diyas), Pongal (kolam dots). */
  festival: 'onam' | 'diwali' | 'pongal';
  createdAt: number;
};

export const DEFAULT_SETTINGS: Settings = { appearance: 'system', haptics: true, reduceMotion: false, weekStart: 0, focusPreset: 'classic', autoBackup: true, widgetTheme: 'system', focusSound: 'off', focusVolume: 0.6, liveWeather: false };

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

/** Every home-screen widget; names match the widget plugin entry in app.json. */
export type WidgetKey = 'Matrix' | 'Circle' | 'CheckIn' | 'Tasks' | 'Garden' | 'Focus' | 'Streak' | 'Reach';
export const WIDGET_KEYS: readonly WidgetKey[] = ['Matrix', 'Circle', 'CheckIn', 'Tasks', 'Garden', 'Focus', 'Streak', 'Reach'];

/** Widgets that can tick tasks off from the home screen. */
export type TaskWidget = 'Tasks' | 'Matrix';

/** How long a widget offers Undo after a task is ticked off. */
export const WIDGET_UNDO_MS = 10 * 60_000;

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
  moodTags: {},
  goodNotes: {},
  places: [],
  checkinPlace: {},
  pookalams: [],
  energy: {},
  nudges: [],
  armed: true,
  tasks: [],
  people: [],
  games: { best: {}, plays: {} },
  focus: { sessions: [], active: null },
  badges: {},
  garden: [],
  widgetPrefs: Object.fromEntries(WIDGET_KEYS.map((k) => [k, DEFAULT_WIDGET_PREFS])) as Record<WidgetKey, WidgetPrefs>,
  widgetLocks: {},
  widgetUndo: null,
  settings: DEFAULT_SETTINGS,
  backup: {},
  bloomCount: 0,
  bloomsEver: 0,
  clearedWork: {},
  clearedFocus: {},
  routines: [],
  routineMade: {},
  labels: { matrix: {}, circle: {} },
  avatar: null,
};

/**
 * Fills in anything a saved (or restored) state is missing, so older data keeps working. The single
 * way in for both launch and restore, so everything is cleaned first (lib/sanitise).
 */
function mergeSaved(raw: Partial<AppState>): AppState {
  const saved = sanitise(raw);
  const merged = { ...initial, ...saved };
  merged.widgetPrefs = Object.fromEntries(
    WIDGET_KEYS.map((k) => [k, { ...DEFAULT_WIDGET_PREFS, ...saved.widgetPrefs?.[k] }]),
  ) as Record<WidgetKey, WidgetPrefs>;
  merged.moodTags = { ...saved.moodTags };
  merged.goodNotes = { ...saved.goodNotes };
  merged.places = [...(saved.places ?? [])];
  merged.checkinPlace = { ...saved.checkinPlace };
  merged.pookalams = [...(saved.pookalams ?? [])];
  merged.energy = { ...saved.energy };
  // 2.2 had a single "Quick and easy" flag; it is now the Quick effort level.
  merged.tasks = (merged.tasks ?? []).map((t) => {
    const { easy, ...rest } = t as Task & { easy?: boolean };
    return easy && !rest.effort ? { ...rest, effort: 'quick' as const } : rest;
  });
  merged.settings = { ...DEFAULT_SETTINGS, ...saved.settings };
  merged.backup = { ...initial.backup, ...saved.backup };
  // Nested objects are merged too, so fields added in later versions get their defaults.
  merged.reminder = { ...initial.reminder, ...saved.reminder };
  merged.games = { best: { ...saved.games?.best }, plays: { ...saved.games?.plays } };
  merged.focus = { ...initial.focus, ...saved.focus };
  // Gardens began with focus sessions only: carry those flowers over once (before they are counted).
  if (!saved.garden && saved.focus?.sessions?.length) {
    merged.garden = saved.focus.sessions.map((f, i) => ({ id: `m${i}-${f.at}`, at: f.at, flower: f.flower, source: 'focus' as const, ref: f.taskId }));
  }
  if (saved.bloomCount === undefined) merged.bloomCount = merged.garden.length;
  merged.bloomsEver = Math.max(saved.bloomsEver ?? 0, merged.bloomCount);
  merged.clearedWork = { ...saved.clearedWork };
  merged.clearedFocus = { ...saved.clearedFocus };
  merged.routines = [...(saved.routines ?? [])];
  merged.routineMade = { ...saved.routineMade };
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
  return merged;
}

function load(): AppState {
  try {
    const raw = readItem(KEY);
    return raw ? mergeSaved(JSON.parse(raw) as Partial<AppState>) : initial;
  } catch {
    // Unreadable database or file: start from defaults rather than crash at launch.
    return initial;
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

// ── Saving ───────────────────────────────────────────────────────────────────
// Changes apply to memory (and the screen) at once; the write to storage is coalesced into one per
// burst of updates (a widget tap makes several) and runs after the current task, off the tap's path.

let dirty = false;
let queued = false;
let saveFailed = false;
const saveListeners = new Set<() => void>();

function setSaveFailed(failed: boolean) {
  if (saveFailed === failed) return;
  saveFailed = failed;
  saveListeners.forEach((l) => l());
}

/** Writes pending changes now. Called before the app goes to the background and before a background task returns. */
export function flushState(): void {
  queued = false;
  if (!dirty) return;
  try {
    writeItem(KEY, JSON.stringify(state));
    dirty = false;
    setSaveFailed(false);
  } catch {
    // Disk full or the database is unavailable: keep the change in memory, say so, and try again next time.
    setSaveFailed(true);
  }
}

function set(next: AppState) {
  state = next;
  dirty = true;
  if (!queued) {
    queued = true;
    queueMicrotask(flushState);
  }
  listeners.forEach((l) => l());
}

// Leaving the app (or the screen turning off) writes anything still pending.
try {
  RNAppState.addEventListener?.('change', (s) => {
    if (s !== 'active') flushState();
  });
} catch {
  // No app lifecycle here (tests, some headless contexts).
}

/** True while the last save failed (for a banner asking the user to free some space). */
export function useSaveFailed(): boolean {
  return useSyncExternalStore(
    (cb) => {
      saveListeners.add(cb);
      return () => saveListeners.delete(cb);
    },
    () => saveFailed,
    () => saveFailed,
  );
}

export function update(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
  const p = typeof patch === 'function' ? patch(state) : patch;
  set({ ...state, ...p });
}

export function getState(): AppState {
  return state;
}

/**
 * Re-reads saved state (a home-screen widget may have changed it while the app was closed).
 * `silent` skips telling subscribers: a widget tap redraws the widgets itself, and the changes it
 * then makes notify anyway.
 */
export function reloadState(opts: { silent?: boolean } = {}): void {
  // Anything not yet written would otherwise be lost by reading the older copy back.
  flushState();
  state = load();
  if (!opts.silent) listeners.forEach((l) => l());
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

/** Adds or removes one feeling tag on a day (at most `max` tags per day). */
export function toggleMoodTag(day: string, tag: string, max = 5) {
  update((s) => {
    const current = s.moodTags[day] ?? [];
    const next = current.includes(tag) ? current.filter((x) => x !== tag) : current.length >= max ? current : [...current, tag];
    const moodTags = { ...s.moodTags };
    if (next.length) moodTags[day] = next;
    else delete moodTags[day];
    return { moodTags };
  });
}

/** Records the morning's energy (tap the same level again to clear it). */
export function setEnergy(day: string, level: EnergyLevel | null) {
  update((s) => {
    const energy = { ...s.energy };
    if (level && energy[day] !== level) energy[day] = level;
    else delete energy[day];
    return { energy };
  });
}

/** Saves (or, when empty, removes) the good-day note for a day. */
export function setGoodNote(day: string, text: string) {
  const clean = text.trim().slice(0, 160);
  update((s) => {
    const goodNotes = { ...s.goodNotes };
    if (clean) goodNotes[day] = clean;
    else delete goodNotes[day];
    return { goodNotes };
  });
}

export function addPlace(name: string, emoji: string, coords?: { lat: number; lon: number }): Place {
  const place: Place = { id: newId(), name: name.trim().slice(0, 24), emoji, createdAt: Date.now(), ...(coords ? { lat: coords.lat, lon: coords.lon } : {}) };
  update((s) => ({ places: [...s.places, place] }));
  return place;
}

export function updatePlace(id: string, patch: Partial<Omit<Place, 'id'>>) {
  update((s) => ({ places: s.places.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
}

export function deletePlace(id: string) {
  update((s) => ({
    places: s.places.filter((p) => p.id !== id),
    checkinPlace: Object.fromEntries(Object.entries(s.checkinPlace).filter(([, v]) => v !== id)),
  }));
}

/** Where today's check-in was made (tap again to clear). */
export function setCheckinPlace(day: string, placeId: string | null) {
  update((s) => {
    const checkinPlace = { ...s.checkinPlace };
    if (placeId && checkinPlace[day] !== placeId) checkinPlace[day] = placeId;
    else delete checkinPlace[day];
    return { checkinPlace };
  });
}

export function savePookalam(p: Omit<Pookalam, 'id' | 'createdAt'> & { id?: string }): Pookalam {
  const existing = p.id ? state.pookalams.find((x) => x.id === p.id) : undefined;
  const next: Pookalam = { ...p, id: existing?.id ?? newId(), createdAt: existing?.createdAt ?? Date.now() };
  update((s) => ({ pookalams: existing ? s.pookalams.map((x) => (x.id === next.id ? next : x)) : [next, ...s.pookalams].slice(0, 60) }));
  return next;
}

export function deletePookalam(id: string) {
  update((s) => ({ pookalams: s.pookalams.filter((x) => x.id !== id) }));
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

const eraseHooks = new Set<() => void>();

/** Extra clean-up for "Erase everything" (the weekly backup files register here, from lib/backup). */
export function onErase(fn: () => void): () => void {
  eraseHooks.add(fn);
  return () => eraseHooks.delete(fn);
}

export function resetAll() {
  try {
    removeItem(KEY);
  } catch {
    // The write of the empty state below replaces it anyway.
  }
  eraseHooks.forEach((fn) => {
    try {
      fn();
    } catch {
      // Clean-up is best effort; the erase itself must still happen.
    }
  });
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

export function addTask(title: string, quadrant: Quadrant, due?: string, effort?: Task['effort']): Task {
  const task: Task = { id: newId(), title: title.trim(), quadrant, due, done: false, createdAt: Date.now(), ...(effort ? { effort } : {}) };
  update((s) => ({ tasks: [...s.tasks, task] }));
  return task;
}

export function editTask(id: string, patch: Partial<Pick<Task, 'title' | 'quadrant' | 'due' | 'effort'>>) {
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
  // Harder tasks grow more: a Deep work task grows two flowers, with better odds of a rare one (lib/effort).
  if (!task.done) {
    const reward = rewardFor(task);
    for (let i = 0; i < reward.flowers; i++) bloom('task', { ref: id, note: task.title, rareChance: reward.rare });
  }
  else
    update((s) => {
      const garden = s.garden.filter((b) => !(b.source === 'task' && b.ref === id));
      return { garden, bloomCount: Math.max(0, s.bloomCount - (s.garden.length - garden.length)) };
    });
}

// ── Steps and progress: big tasks done over several days ────────────────────

export function addStep(taskId: string, title: string) {
  const clean = title.trim().slice(0, 80);
  if (!clean) return;
  update((s) => ({
    tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, steps: [...(t.steps ?? []), { id: newId(), title: clean, done: false }] } : t)),
  }));
}

export function deleteStep(taskId: string, stepId: string) {
  update((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, steps: (t.steps ?? []).filter((x) => x.id !== stepId) } : t)) }));
}

/** Ticks a step on or off. Ticking one counts as working on the task today. */
export function toggleStep(taskId: string, stepId: string) {
  const step = state.tasks.find((t) => t.id === taskId)?.steps?.find((x) => x.id === stepId);
  if (!step) return;
  update((s) => ({
    tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, steps: (t.steps ?? []).map((x) => (x.id === stepId ? { ...x, done: !x.done } : x)) } : t)),
  }));
  if (!step.done) logProgress(taskId);
}

/**
 * "Worked on it today": the first progress on a task each day grows one flower (at the task's rare
 * odds), so steady work on a long task is rewarded before it is finished. These flowers stay even if
 * the task is later unticked; the finishing reward still comes when the whole task is done.
 * Returns true when this was the first progress today.
 */
export function logProgress(taskId: string): boolean {
  const task = state.tasks.find((t) => t.id === taskId);
  const today = dayKey();
  if (!task || task.done || task.workedOn?.includes(today)) return false;
  update((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, workedOn: [...(t.workedOn ?? []), today] } : t)) }));
  bloom('task', { ref: `${taskId}:progress:${today}`, note: `Progress: ${task.title}`, rareChance: rewardFor(task).rare });
  return true;
}

/**
 * A tap on a task in a home-screen widget. `done` only finishes (Focus today); `toggle` also
 * un-finishes (Matrix). A task with open steps is not finished in one tap: the tap ticks its next
 * step (counting as progress today), and the last step finishes the task. Does nothing while the
 * widget is locked. Returns what changed, or null.
 */
export function widgetTickTask(widget: TaskWidget, id: string, mode: 'done' | 'toggle'): 'step' | 'task' | null {
  if (state.widgetLocks[widget]) return null;
  const task = state.tasks.find((t) => t.id === id);
  if (!task || (mode === 'done' && task.done)) return null;
  const open = task.done ? [] : (task.steps ?? []).filter((x) => !x.done);
  if (open.length > 0) {
    const step = open[0];
    toggleStep(id, step.id);
    if (open.length === 1) toggleTask(id);
    update({ widgetUndo: { taskId: id, stepId: step.id, widget, at: Date.now() } });
    return open.length === 1 ? 'task' : 'step';
  }
  toggleTask(id);
  update({ widgetUndo: task.done ? null : { taskId: id, widget, at: Date.now() } });
  return 'task';
}

/**
 * What a widget can still undo, if it was ticked there in the last few minutes and is still ticked:
 * the task, and the step when the tap ticked a step.
 */
export function widgetUndoFor(
  s: Pick<AppState, 'widgetUndo' | 'tasks'>,
  widget: TaskWidget,
  now = Date.now(),
): (Task & { undoStep?: TaskStep }) | null {
  const u = s.widgetUndo;
  if (!u || u.widget !== widget || now - u.at > WIDGET_UNDO_MS) return null;
  const task = s.tasks.find((t) => t.id === u.taskId);
  if (!task) return null;
  if (u.stepId) {
    const step = task.steps?.find((x) => x.id === u.stepId && x.done);
    return step ? { ...task, undoStep: step } : null;
  }
  return task.done ? task : null;
}

/**
 * Undo on a widget: puts back the last ticked task (and takes its flowers back), or unticks the
 * step it ticked. A day's progress flower stays, as in the app.
 */
export function widgetUndo(widget: TaskWidget): boolean {
  const hit = widgetUndoFor(state, widget);
  update({ widgetUndo: null });
  if (!hit) return false;
  if (hit.done) toggleTask(hit.id);
  if (hit.undoStep) toggleStep(hit.id, hit.undoStep.id);
  return true;
}

export function toggleWidgetLock(widget: TaskWidget) {
  update((s) => ({ widgetLocks: { ...s.widgetLocks, [widget]: !s.widgetLocks[widget] } }));
}

export function deleteTask(id: string) {
  update((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
}

// ── Routines: tasks that come back on their own ─────────────────────────────

export type RoutineInput = Omit<Routine, 'id' | 'createdAt' | 'start'> & { start?: string };

/**
 * Adds today's tasks for every routine due today, once a day. Also tidies up after earlier days:
 * a routine task left unfinished is removed rather than piling up (it will come round again), and
 * a finished one is cleared into `clearedWork`, so the calendar keeps its shading.
 * Cheap when nothing is due: returns false without writing. Safe to call often (app start, return to the
 * app, widget updates, notification buttons).
 */
export function ensureRoutines(today: string = dayKey()): boolean {
  const s = state;
  const stale = s.tasks.filter((t) => t.routineId && t.due && t.due < today);
  const dueNow = s.routines.filter((r) => s.routineMade[r.id] !== today);
  if (!stale.length && !dueNow.length) return false;
  update((cur) => {
    const clearedWork = { ...cur.clearedWork };
    let tasks = cur.tasks.filter((t) => {
      if (!(t.routineId && t.due && t.due < today)) return true;
      if (t.done && t.doneAt) {
        const k = dayKey(new Date(t.doneAt));
        clearedWork[k] = (clearedWork[k] ?? 0) + 1;
      }
      return false;
    });
    const routineMade = { ...cur.routineMade };
    for (const r of cur.routines) {
      if (routineMade[r.id] === today) continue;
      routineMade[r.id] = today;
      if (!occursOn(r, today)) continue;
      r.times.forEach((at, slot) => {
        const id = instanceId(r.id, today, slot);
        if (tasks.some((t) => t.id === id)) return;
        tasks = [
          ...tasks,
          { id, title: r.title, quadrant: r.quadrant, due: today, done: false, createdAt: Date.now(), routineId: r.id, slot, at, ...(r.effort ? { effort: r.effort } : {}) },
        ];
      });
    }
    return { tasks, clearedWork, routineMade };
  });
  return true;
}

export function addRoutine(input: RoutineInput): Routine {
  const r: Routine = { ...input, id: newId(), title: input.title.trim(), times: normaliseTimes(input.times), start: input.start ?? dayKey(), createdAt: Date.now() };
  update((s) => ({ routines: [...s.routines, r] }));
  ensureRoutines();
  return r;
}

export function getRoutine(id: string | undefined): Routine | undefined {
  return id ? state.routines.find((r) => r.id === id) : undefined;
}

/**
 * Changes a routine. Today's unfinished tasks from it follow the change: their title, quadrant and
 * effort are updated, and if the schedule or times changed they are added again to match.
 */
export function editRoutine(id: string, patch: Partial<RoutineInput>): void {
  const old = getRoutine(id);
  if (!old) return;
  const next: Routine = { ...old, ...patch, title: (patch.title ?? old.title).trim(), times: normaliseTimes(patch.times ?? old.times) };
  const today = dayKey();
  const reschedule =
    next.kind !== old.kind ||
    next.every !== old.every ||
    (next.weekdays ?? []).join() !== (old.weekdays ?? []).join() ||
    next.times.join() !== old.times.join() ||
    next.start !== old.start;
  update((s) => {
    const routines = s.routines.map((r) => (r.id === id ? next : r));
    const mine = (t: Task) => t.routineId === id && t.due === today && !t.done;
    if (reschedule) {
      const routineMade = { ...s.routineMade };
      delete routineMade[id];
      return { routines, routineMade, tasks: s.tasks.filter((t) => !mine(t)) };
    }
    return {
      routines,
      tasks: s.tasks.map((t) => (mine(t) ? { ...t, title: next.title, quadrant: next.quadrant, effort: next.effort } : t)),
    };
  });
  // A finished task for a slot stays finished: re-adding skips ids that already exist.
  if (reschedule) ensureRoutines(today);
}

/** Stops a routine. Today's unfinished tasks from it become ordinary tasks unless `removeToday`. */
export function deleteRoutine(id: string, removeToday = false): void {
  update((s) => {
    const routineMade = { ...s.routineMade };
    delete routineMade[id];
    const tasks = s.tasks
      .filter((t) => !(removeToday && t.routineId === id && !t.done))
      .map((t) => {
        if (t.routineId !== id) return t;
        const { routineId: _r, slot: _s, ...rest } = t;
        return rest;
      });
    return { routines: s.routines.filter((r) => r.id !== id), routineMade, tasks };
  });
}

/** Turns an existing one-time task into a routine: the routine takes its place from today. */
export function makeRoutineFrom(taskId: string, input: RoutineInput): Routine {
  const task = state.tasks.find((t) => t.id === taskId);
  if (task && !task.done) update((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }));
  return addRoutine(input);
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
  // The Golden Lotus follows every flower ever grown, so a flower taken back cannot bring it round again.
  const kind = pickFlower(state.bloomsEver + 1, state.garden[0]?.flower, opts.rareChance ?? 0.1);
  const b: Bloom = { id: newId(), at: Date.now(), flower: kind.id, source, ref: opts.ref, note: opts.note };
  update((s) => ({ garden: [b, ...s.garden].slice(0, 2000), bloomCount: s.bloomCount + 1, bloomsEver: s.bloomsEver + 1 }));
  if (!opts.silent) bloomListeners.forEach((l) => l(b, kind));
  return kind;
}

export { flowerOf };
