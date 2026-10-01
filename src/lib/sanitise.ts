/**
 * Cleans saved or restored state before the app uses it. A damaged or hand-edited file must not
 * become a crash on every launch: anything with the wrong shape is dropped (or clamped into range)
 * here, and store.ts fills the gaps with defaults. Unknown keys pass through untouched, so fields
 * added by later versions survive a round trip.
 */
import type { AppState, Bloom, NudgeLog, Person, Place, Pookalam, PookalamRing, Settings, Task, TaskStep, WidgetKey, WidgetPrefs } from '@/lib/store';
import type { ActiveTimer, FocusSession } from '@/lib/focus';
import { cleanTime, MAX_EVERY, MAX_TIMES, MIN_EVERY, type Routine } from '@/lib/routines';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const oneOf = <T extends string | number>(v: unknown, allowed: readonly T[]): v is T => allowed.includes(v as T);

/** YYYY-MM-DD with a plausible month and day. */
export function isDayKey(v: unknown): v is string {
  if (!isStr(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const m = Number(v.slice(5, 7));
  const d = Number(v.slice(8, 10));
  return m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

/** A whole number clamped into [lo, hi], or undefined when it is not a number at all. */
function clampInt(v: unknown, lo: number, hi: number): number | undefined {
  return isNum(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : undefined;
}

/** Keeps the entries of a day-keyed map whose value passes `fix`. */
function dayMap<T>(v: unknown, fix: (x: unknown) => T | undefined): Record<string, T> | undefined {
  if (!isObj(v)) return undefined;
  const out: Record<string, T> = {};
  for (const [k, x] of Object.entries(v)) {
    const y = isDayKey(k) ? fix(x) : undefined;
    if (y !== undefined) out[k] = y;
  }
  return out;
}

function strMap<T>(v: unknown, fix: (x: unknown) => T | undefined): Record<string, T> | undefined {
  if (!isObj(v)) return undefined;
  const out: Record<string, T> = {};
  for (const [k, x] of Object.entries(v)) {
    const y = fix(x);
    if (y !== undefined) out[k] = y;
  }
  return out;
}

function list<T>(v: unknown, fix: (x: unknown) => T | undefined): T[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: T[] = [];
  for (const x of v) {
    const y = fix(x);
    if (y !== undefined) out.push(y);
  }
  return out;
}

/** Copies only the listed optional fields that pass their check. */
function pick(src: Obj, checks: Record<string, (x: unknown) => boolean>): Obj {
  const out: Obj = {};
  for (const [k, ok] of Object.entries(checks)) if (src[k] !== undefined && ok(src[k])) out[k] = src[k];
  return out;
}

const QUADS = [1, 2, 3, 4] as const;
const EFFORTS = ['quick', 'light', 'moderate', 'deep'] as const;
const SOURCES = ['checkin', 'task', 'focus', 'game', 'reach', 'badge'] as const;
const PRESETS = ['gentle', 'classic', 'deep'] as const;
const WIDGETS: readonly WidgetKey[] = ['Matrix', 'Circle', 'CheckIn', 'Tasks', 'Garden', 'Focus', 'Streak', 'Reach'];

function step(v: unknown): TaskStep | undefined {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.title)) return undefined;
  return { id: v.id, title: v.title, done: v.done === true };
}

function task(v: unknown): Task | undefined {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.title)) return undefined;
  const t: Task & { easy?: boolean } = {
    id: v.id,
    title: v.title,
    // A task in an unknown quadrant is kept (in Do first) rather than lost.
    quadrant: oneOf(v.quadrant, QUADS) ? v.quadrant : 1,
    done: v.done === true,
    createdAt: isNum(v.createdAt) ? v.createdAt : 0,
    ...pick(v, { doneAt: isNum, order: isNum, due: isDayKey, easy: isBool, effort: (x) => oneOf(x, EFFORTS), routineId: isStr, at: (x) => !!cleanTime(x) }),
    ...(clampInt(v.slot, 0, MAX_TIMES - 1) !== undefined ? { slot: clampInt(v.slot, 0, MAX_TIMES - 1) } : {}),
  };
  const steps = list(v.steps, step);
  if (steps?.length) t.steps = steps;
  const worked = list(v.workedOn, (x) => (isDayKey(x) ? x : undefined));
  if (worked?.length) t.workedOn = worked;
  return t;
}

function routine(v: unknown): Routine | undefined {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.title) || !oneOf(v.kind, ['daily', 'weekly', 'interval'] as const)) return undefined;
  const times = [...new Set(list(v.times, (x) => cleanTime(x)) ?? [])].sort().slice(0, MAX_TIMES);
  const weekdays = [...new Set(list(v.weekdays, (x) => clampInt(x, 0, 6)) ?? [])];
  if (v.kind === 'weekly' && !weekdays.length) return undefined;
  return {
    id: v.id,
    title: v.title,
    quadrant: oneOf(v.quadrant, QUADS) ? v.quadrant : 1,
    kind: v.kind,
    start: isDayKey(v.start) ? v.start : '2000-01-01',
    times: times.length ? times : ['08:00'],
    remind: v.remind !== false,
    createdAt: isNum(v.createdAt) ? v.createdAt : 0,
    ...(v.kind === 'weekly' ? { weekdays } : {}),
    ...(v.kind === 'interval' ? { every: clampInt(v.every, MIN_EVERY, MAX_EVERY) ?? MIN_EVERY } : {}),
    ...pick(v, { effort: (x) => oneOf(x, EFFORTS) }),
  };
}

function person(v: unknown): Person | undefined {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.name)) return undefined;
  return {
    id: v.id,
    name: v.name,
    quadrant: oneOf(v.quadrant, QUADS) ? v.quadrant : 1,
    createdAt: isNum(v.createdAt) ? v.createdAt : 0,
    ...pick(v, { phone: isStr, lastReachedAt: isNum }),
  };
}

function bloom(v: unknown): Bloom | undefined {
  if (!isObj(v) || !isStr(v.id) || !isNum(v.at) || !isStr(v.flower) || !oneOf(v.source, SOURCES)) return undefined;
  return { id: v.id, at: v.at, flower: v.flower, source: v.source, ...pick(v, { ref: isStr, note: isStr }) };
}

function place(v: unknown): Place | undefined {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.name)) return undefined;
  const p: Place = { id: v.id, name: v.name, emoji: isStr(v.emoji) ? v.emoji : '📍', createdAt: isNum(v.createdAt) ? v.createdAt : 0 };
  // Coordinates only count as a pair.
  if (isNum(v.lat) && isNum(v.lon) && Math.abs(v.lat) <= 90 && Math.abs(v.lon) <= 180) Object.assign(p, { lat: v.lat, lon: v.lon });
  return p;
}

function ring(v: unknown): PookalamRing | undefined {
  if (!isObj(v) || !isStr(v.flower) || !oneOf(v.pattern, ['solid', 'alternate', 'petals', 'dots'] as const)) return undefined;
  return { flower: v.flower, pattern: v.pattern };
}

function pookalam(v: unknown): Pookalam | undefined {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.center)) return undefined;
  return {
    id: v.id,
    name: isStr(v.name) ? v.name : '',
    center: v.center,
    rings: list(v.rings, ring) ?? [],
    festival: oneOf(v.festival, ['onam', 'diwali', 'pongal'] as const) ? v.festival : 'onam',
    createdAt: isNum(v.createdAt) ? v.createdAt : 0,
  };
}

function nudge(v: unknown): NudgeLog | undefined {
  if (!isObj(v) || !isNum(v.at) || !oneOf(v.kind, ['auto', 'test'] as const)) return undefined;
  if (!oneOf(v.status, ['ready', 'opened', 'dismissed', 'sent', 'queued', 'expired'] as const)) return undefined;
  return { at: v.at, kind: v.kind, status: v.status, ...pick(v, { to: isStr }) };
}

function session(v: unknown): FocusSession | undefined {
  if (!isObj(v) || !isNum(v.at) || !isNum(v.minutes) || !isStr(v.flower)) return undefined;
  return { at: v.at, minutes: v.minutes, flower: v.flower, ...pick(v, { taskId: isStr }) };
}

function timer(v: unknown): ActiveTimer | null {
  if (!isObj(v) || !oneOf(v.kind, ['focus', 'break'] as const) || !oneOf(v.preset, PRESETS) || !isNum(v.total) || v.total <= 0) return null;
  const endAt = isNum(v.endAt) ? v.endAt : null;
  const pausedLeft = isNum(v.pausedLeft) ? Math.max(0, v.pausedLeft) : null;
  // Running needs an end time; paused needs what was left.
  if (endAt === null && pausedLeft === null) return null;
  return { kind: v.kind, preset: v.preset, total: v.total, endAt, pausedLeft, ...pick(v, { taskId: isStr, dnd: isBool }) };
}

function widgetPrefs(v: unknown): Partial<WidgetPrefs> | undefined {
  if (!isObj(v)) return undefined;
  const out: Partial<WidgetPrefs> = pick(v, {
    theme: (x) => oneOf(x, ['auto', 'light', 'dark'] as const),
    font: (x) => oneOf(x, ['small', 'default', 'large'] as const),
    checkbox: isBool,
    completed: isBool,
  });
  const opacity = clampInt(v.opacity, 40, 100);
  if (opacity !== undefined) out.opacity = opacity;
  return out;
}

function settings(v: unknown): Partial<Settings> | undefined {
  if (!isObj(v)) return undefined;
  const out: Partial<Settings> = pick(v, {
    appearance: (x) => oneOf(x, ['system', 'light', 'dark'] as const),
    haptics: isBool,
    reduceMotion: isBool,
    weekStart: (x) => oneOf(x, [0, 1] as const),
    focusPreset: (x) => oneOf(x, PRESETS),
    autoBackup: isBool,
    widgetTheme: (x) => oneOf(x, ['system', 'light', 'dark'] as const),
    focusSound: isStr,
    liveWeather: isBool,
    focusDnd: (x) => oneOf(x, ['ask', 'always', 'never'] as const),
  });
  if (isNum(v.focusVolume)) out.focusVolume = Math.min(1, Math.max(0, v.focusVolume));
  return out;
}

function labels(v: unknown): AppState['labels'] | undefined {
  if (!isObj(v)) return undefined;
  const side = (x: unknown) => {
    const out: Partial<Record<1 | 2 | 3 | 4, string>> = {};
    if (isObj(x)) for (const q of QUADS) if (isStr(x[q])) out[q] = x[q] as string;
    return out;
  };
  return { matrix: side(v.matrix), circle: side(v.circle) };
}

function avatar(v: unknown): AppState['avatar'] | undefined {
  if (v === null) return null;
  if (!isObj(v)) return undefined;
  if (v.kind === 'photo' && isStr(v.uri)) return { kind: 'photo', uri: v.uri };
  if (v.kind === 'preset' && isStr(v.id)) return { kind: 'preset', id: v.id };
  return undefined;
}

/** Each known field is checked; one that cannot be repaired is removed so its default applies. */
const FIELDS: Record<string, (v: unknown) => unknown> = {
  version: () => undefined,
  onboarded: (v) => (isBool(v) ? v : undefined),
  name: (v) => (isStr(v) ? v : undefined),
  buddyId: (v) => (v === null || isStr(v) ? v : undefined),
  streak: (v) => (oneOf(v, [2, 3, 4] as const) ? v : undefined),
  reminder: (v) =>
    isObj(v)
      ? {
          ...pick(v, { enabled: isBool }),
          ...(clampInt(v.hour, 0, 23) !== undefined ? { hour: clampInt(v.hour, 0, 23) } : {}),
          ...(clampInt(v.minute, 0, 59) !== undefined ? { minute: clampInt(v.minute, 0, 59) } : {}),
        }
      : undefined,
  checkins: (v) => dayMap(v, (x) => clampInt(x, 1, 5)),
  moodTags: (v) => dayMap(v, (x) => list(x, (t) => (isStr(t) ? t : undefined))),
  goodNotes: (v) => dayMap(v, (x) => (isStr(x) ? x.slice(0, 160) : undefined)),
  dayNotes: (v) =>
    dayMap(v, (x) => {
      const notes = list(x, (n) => (isObj(n) && isStr(n.id) && isStr(n.text) && n.text.trim() ? { id: n.id, text: n.text.slice(0, 280), at: isNum(n.at) ? n.at : 0 } : undefined));
      return notes?.length ? notes.slice(-20) : undefined;
    }),
  customMoods: (v) =>
    list(v, (m) =>
      isObj(m) && isStr(m.id) && m.id.startsWith('my-') && isStr(m.label) && m.label.trim()
        ? { id: m.id, label: m.label.slice(0, 16), emoji: isStr(m.emoji) && m.emoji.trim() ? m.emoji.slice(0, 8) : '🙂', tone: m.tone === 'heavy' ? ('heavy' as const) : ('light' as const) }
        : undefined,
    )?.slice(0, 30),
  places: (v) => list(v, place),
  checkinPlace: (v) => dayMap(v, (x) => (isStr(x) ? x : undefined)),
  pookalams: (v) => list(v, pookalam),
  energy: (v) => dayMap(v, (x) => clampInt(x, 1, 3)),
  nudges: (v) => list(v, nudge),
  armed: (v) => (isBool(v) ? v : undefined),
  lastNudgeDay: (v) => (isDayKey(v) ? v : undefined),
  bloomCount: (v) => clampInt(v, 0, Number.MAX_SAFE_INTEGER),
  bloomsEver: (v) => clampInt(v, 0, Number.MAX_SAFE_INTEGER),
  modifiedAt: (v) => clampInt(v, 0, Number.MAX_SAFE_INTEGER),
  deletedIds: (v) => strMap(v, (x) => clampInt(x, 0, Number.MAX_SAFE_INTEGER)),
  clearedWork: (v) => dayMap(v, (x) => clampInt(x, 0, 10_000)),
  clearedFocus: (v) =>
    dayMap(v, (x) => {
      const o = (x && typeof x === 'object' ? x : {}) as { sessions?: unknown; minutes?: unknown };
      return { sessions: clampInt(o.sessions, 0, 10_000) ?? 0, minutes: clampInt(o.minutes, 0, 1_000_000) ?? 0 };
    }),
  labels,
  avatar,
  tasks: (v) => list(v, task),
  routines: (v) => list(v, routine),
  routineMade: (v) => strMap(v, (x) => (isStr(x) && isDayKey(x.split('#')[0]) && /^[^#]+(#\d)?$/.test(x) ? x : undefined)),
  people: (v) => list(v, person),
  games: (v) =>
    isObj(v)
      ? { best: strMap(v.best, (x) => (isNum(x) ? x : undefined)) ?? {}, plays: strMap(v.plays, (x) => clampInt(x, 0, Number.MAX_SAFE_INTEGER)) ?? {} }
      : undefined,
  garden: (v) => list(v, bloom),
  badges: (v) => strMap(v, (x) => (isNum(x) ? x : undefined)),
  focus: (v) => (isObj(v) ? { sessions: list(v.sessions, session) ?? [], active: timer(v.active) } : undefined),
  widgetPrefs: (v) => {
    if (!isObj(v)) return undefined;
    const out: Partial<Record<WidgetKey, Partial<WidgetPrefs>>> = {};
    for (const k of WIDGETS) {
      const p = widgetPrefs(v[k]);
      if (p) out[k] = p;
    }
    return out;
  },
  widgetLocks: (v) => (isObj(v) ? pick(v, { Tasks: isBool, Matrix: isBool }) : undefined),
  widgetUndo: (v) =>
    isObj(v) && isStr(v.taskId) && isNum(v.at) && oneOf(v.widget, ['Tasks', 'Matrix'] as const)
      ? { taskId: v.taskId, widget: v.widget, at: v.at, ...pick(v, { stepId: isStr }) }
      : null,
  settings,
  backup: (v) => (isObj(v) ? pick(v, { lastManual: isNum, lastAuto: isNum, lastRestore: isNum, pendingSave: isBool }) : undefined),
  // Before 1.x the buddy was a separate contact; only its name is still read (to find them in the circle).
  buddy: (v) => (isObj(v) && isStr(v.name) ? { name: v.name } : undefined),
};

export function sanitise(input: unknown): Partial<AppState> {
  if (!isObj(input)) return {};
  const out: Obj = { ...input };
  for (const [key, fix] of Object.entries(FIELDS)) {
    if (!(key in out)) continue;
    const v = fix(out[key]);
    if (v === undefined) delete out[key];
    else out[key] = v;
  }
  return out as Partial<AppState>;
}
