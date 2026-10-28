/**
 * Merging two phones' Daybloom data for device sync (lib/device-sync). Pure functions only, so the
 * rules can be tested without a network.
 *
 * Every change the user makes is stamped with its time, piece by piece (`stamps`): each task,
 * person, routine or note by its id, each day of a day-by-day record, each routine time on each
 * day, and each single value such as the name or the settings. Joining two copies then takes, for
 * every piece, the copy changed most recently, so an edit on one phone never undoes a different
 * edit made meanwhile on the other.
 *
 * - Lists of things with ids are joined by id. A deletion (`deletedIds`) wins over a copy that was
 *   last changed before it, and loses to one changed (or brought back) after it.
 * - Day-by-day records are joined day by day; a day cleared on one phone stays cleared if that was
 *   the later change. Routine history is joined per time of day, so two phones ticking different
 *   times on the same day keep both.
 * - Pieces with no stamp on either side (data from before 4.0, or added by the app itself, such as
 *   a routine's task for the day) fall back to the phone changed most recently overall.
 * - Things that belong to one phone stay on it: home-screen widget settings, backup dates, the
 *   daily reminder time (its alarm is on that phone), the timer running right now, and a profile
 *   photo (the file lives on that phone).
 */
import type { AppState } from '@/lib/store';

/** Lists whose items carry an `id`; deletions in them are remembered for sync. */
export const ID_LISTS = ['tasks', 'people', 'places', 'pookalams', 'routines', 'customMoods', 'garden'] as const;
type IdList = (typeof ID_LISTS)[number];

/** Day-keyed records, joined day by day. */
const DAY_MAPS = ['checkins', 'moodTags', 'goodNotes', 'energy', 'checkinPlace', 'clearedWork', 'clearedFocus'] as const;

/** Routine history: routine id → day → time slots. Joined per slot. */
const SLOT_LOGS = ['routineLog', 'routineMissed'] as const;

/** Single values, each taken whole from the phone that changed it last. */
const FIELDS = ['onboarded', 'name', 'buddyId', 'streak', 'armed', 'lastNudgeDay', 'labels', 'avatar', 'settings', 'nudges'] as const;

/** Deletions and stamps are remembered this long; after that a stale phone could bring an item back. */
export const TOMBSTONE_DAYS = 180;

/** Caps the lists keep on one phone (store.ts, sanitise.ts, focus.ts), applied again after joining. */
const GARDEN_MAX = 2000;
const SESSIONS_MAX = 500;
const NOTES_PER_DAY = 20;
const CUSTOM_MOODS_MAX = 30;
const POOKALAMS_MAX = 60;

type Stamps = Record<string, number>;

/** Ids present in `before` but not in `after`. */
export function removedIds<T extends { id: string }>(before: readonly T[], after: readonly T[]): string[] {
  if (before === after) return [];
  const kept = new Set(after.map((x) => x.id));
  return before.filter((x) => !kept.has(x.id)).map((x) => x.id);
}

/**
 * The ids a change removed, across every synced list and the day notes. Cheap when nothing was
 * removed: lists that are the same object are skipped.
 */
export function deletionsBetween(prev: AppState, next: AppState): string[] {
  const out: string[] = [];
  for (const key of ID_LISTS) {
    const a = prev[key] as { id: string }[] | undefined;
    const b = next[key] as { id: string }[] | undefined;
    if (a && b && a !== b) out.push(...removedIds(a, b));
  }
  if (prev.dayNotes !== next.dayNotes) {
    for (const [day, notes] of Object.entries(prev.dayNotes ?? {})) out.push(...removedIds(notes, next.dayNotes?.[day] ?? []));
  }
  return out;
}

const keysOf = (...objs: (object | undefined)[]) => new Set(objs.flatMap((o) => (o ? Object.keys(o) : [])));

/**
 * Stamps every piece a change touched with `now`. Returns `next.stamps` itself when nothing synced
 * changed. Lists, maps and values that are the same object as before are skipped, so this stays
 * cheap for the usual one-field change.
 */
export function stampChanges(prev: AppState, next: AppState, now: number): Stamps {
  const base = next.stamps ?? {};
  let out: Stamps | null = null;
  const mark = (key: string) => {
    out ??= { ...base };
    out[key] = now;
  };
  for (const key of ID_LISTS) {
    const a = prev[key] as { id: string }[];
    const b = next[key] as { id: string }[];
    if (a === b) continue;
    const before = new Map(a.map((x) => [x.id, x]));
    for (const x of b) if (before.get(x.id) !== x) mark(x.id);
  }
  if (prev.dayNotes !== next.dayNotes) {
    for (const day of keysOf(prev.dayNotes, next.dayNotes)) {
      const a = prev.dayNotes[day] ?? [];
      const b = next.dayNotes[day] ?? [];
      if (a === b) continue;
      const before = new Map(a.map((x) => [x.id, x]));
      for (const x of b) if (before.get(x.id) !== x) mark(x.id);
    }
  }
  for (const key of DAY_MAPS) {
    const a = prev[key] as Record<string, unknown>;
    const b = next[key] as Record<string, unknown>;
    if (a === b) continue;
    for (const day of keysOf(a, b)) if (a?.[day] !== b?.[day]) mark(`${key}:${day}`);
  }
  for (const key of SLOT_LOGS) {
    const a = prev[key] ?? {};
    const b = next[key] ?? {};
    if (a === b) continue;
    for (const rid of keysOf(a, b)) {
      if (a[rid] === b[rid]) continue;
      for (const day of keysOf(a[rid], b[rid])) {
        const sa = a[rid]?.[day] ?? [];
        const sb = b[rid]?.[day] ?? [];
        if (sa === sb) continue;
        for (const slot of new Set([...sa, ...sb])) if (sa.includes(slot) !== sb.includes(slot)) mark(`${key}:${rid}:${day}:${slot}`);
      }
    }
  }
  if (prev.routineMade !== next.routineMade) {
    for (const rid of keysOf(prev.routineMade, next.routineMade)) if (prev.routineMade[rid] !== next.routineMade[rid]) mark(`routineMade:${rid}`);
  }
  for (const key of FIELDS) if (prev[key] !== next[key]) mark(key);
  return out ?? base;
}

/** Drops deletions (or stamps) older than TOMBSTONE_DAYS. */
export function pruneDeleted(deleted: Record<string, number>, now: number): Record<string, number> {
  const cutoff = now - TOMBSTONE_DAYS * 86_400_000;
  return Object.fromEntries(Object.entries(deleted).filter(([, at]) => at >= cutoff));
}

function joinMax(a: Record<string, number> | undefined, b: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) out[k] = Math.max(v, out[k] ?? 0);
  return out;
}

/** Folds sessions beyond the cap into per-day totals (as foldFocus in focus.ts). */
function fold(cleared: AppState['clearedFocus'], dropped: AppState['focus']['sessions']): AppState['clearedFocus'] {
  if (!dropped.length) return cleared;
  const out = { ...cleared };
  for (const f of dropped) {
    const d = new Date(f.at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const was = out[k] ?? { sessions: 0, minutes: 0 };
    out[k] = { sessions: was.sessions + 1, minutes: was.minutes + f.minutes };
  }
  return out;
}

/**
 * Joins this phone's data (`local`) with the copy from the other phones (`remote`, already cleaned
 * by the store). `preferRemote` is for a phone joining sync for the first time: its own name and
 * settings (just set up during onboarding) give way to the ones already in Drive.
 */
export function mergeStates(local: AppState, remote: AppState, now = Date.now(), opts: { preferRemote?: boolean } = {}): AppState {
  const localNewer = !opts.preferRemote && (local.modifiedAt ?? 0) >= (remote.modifiedAt ?? 0);
  const tie = localNewer ? 'L' : 'R';
  const newer = localNewer ? local : remote;
  const older = localNewer ? remote : local;
  const sL = local.stamps ?? {};
  const sR = remote.stamps ?? {};
  /** Which side changed `key` last; equal stamps (usually none at all) go to the newer phone. */
  const pick = (key: string, ignoreLocal = false): 'L' | 'R' => {
    const a = ignoreLocal ? 0 : (sL[key] ?? 0);
    const b = sR[key] ?? 0;
    return a > b ? 'L' : b > a ? 'R' : tie;
  };
  const deletedIds = pruneDeleted(joinMax(local.deletedIds, remote.deletedIds), now);

  function joinById<T extends { id: string }>(L: readonly T[], R: readonly T[]): T[] {
    const left = new Map(L.map((x) => [x.id, x]));
    const right = new Map(R.map((x) => [x.id, x]));
    const order = tie === 'L' ? [...L, ...R] : [...R, ...L];
    const seen = new Set<string>();
    const out: T[] = [];
    for (const { id } of order) {
      if (seen.has(id)) continue;
      seen.add(id);
      const a = left.get(id);
      const b = right.get(id);
      const changed = Math.max(a ? (sL[id] ?? 0) : 0, b ? (sR[id] ?? 0) : 0);
      // Deleted after its last change: stays deleted. Changed (or brought back) after: stays.
      if (deletedIds[id] !== undefined && deletedIds[id] >= changed) continue;
      out.push(a && b ? (pick(id) === 'L' ? a : b) : (a ?? b)!);
    }
    return out;
  }

  const lists = {} as Pick<AppState, IdList>;
  for (const key of ID_LISTS) {
    (lists as Record<IdList, unknown>)[key] = joinById((local[key] ?? []) as { id: string }[], (remote[key] ?? []) as { id: string }[]);
  }
  // The garden list is newest first; keep it that way after joining, within its cap.
  lists.garden = [...lists.garden].sort((a, b) => b.at - a.at).slice(0, GARDEN_MAX);
  lists.customMoods = lists.customMoods.slice(0, CUSTOM_MOODS_MAX);
  lists.pookalams = lists.pookalams.slice(0, POOKALAMS_MAX);

  const days = {} as Pick<AppState, (typeof DAY_MAPS)[number]>;
  for (const key of DAY_MAPS) {
    const L = (local[key] ?? {}) as Record<string, unknown>;
    const R = (remote[key] ?? {}) as Record<string, unknown>;
    const N = (newer[key] ?? {}) as Record<string, unknown>;
    const O = (older[key] ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const day of keysOf(L, R)) {
      const k = `${key}:${day}`;
      const a = sL[k] ?? 0;
      const b = sR[k] ?? 0;
      // A later stamp decides, even when that side cleared the day; no stamps: either side's value.
      const v = a > b ? L[day] : b > a ? R[day] : (N[day] ?? O[day]);
      if (v !== undefined) out[day] = v;
    }
    (days as Record<string, unknown>)[key] = out;
  }

  const dayNotes: AppState['dayNotes'] = {};
  for (const day of keysOf(local.dayNotes, remote.dayNotes)) {
    const notes = joinById(local.dayNotes?.[day] ?? [], remote.dayNotes?.[day] ?? [])
      .sort((a, b) => a.at - b.at)
      .slice(-NOTES_PER_DAY);
    if (notes.length) dayNotes[day] = notes;
  }

  const slotLogs = {} as Pick<AppState, (typeof SLOT_LOGS)[number]>;
  for (const key of SLOT_LOGS) {
    const L = local[key] ?? {};
    const R = remote[key] ?? {};
    const out: AppState['routineLog'] = {};
    for (const rid of keysOf(L, R)) {
      // A deleted routine's history goes with it.
      if (deletedIds[rid] !== undefined && !lists.routines.some((r) => r.id === rid)) continue;
      const byDay: Record<string, number[]> = {};
      for (const day of keysOf(L[rid], R[rid])) {
        const inL = L[rid]?.[day] ?? [];
        const inR = R[rid]?.[day] ?? [];
        const slots = [...new Set([...inL, ...inR])].filter((slot) => {
          const k = `${key}:${rid}:${day}:${slot}`;
          const a = sL[k] ?? 0;
          const b = sR[k] ?? 0;
          // Each time of day on its own; no stamps: a tick on either phone counts.
          return a > b ? inL.includes(slot) : b > a ? inR.includes(slot) : true;
        });
        if (slots.length) byDay[day] = slots.sort((x, y) => x - y);
      }
      out[rid] = byDay;
    }
    (slotLogs as Record<string, unknown>)[key] = out;
  }

  const routineMade: Record<string, string> = {};
  for (const rid of keysOf(local.routineMade, remote.routineMade)) {
    const a = local.routineMade?.[rid];
    const b = remote.routineMade?.[rid];
    const k = `routineMade:${rid}`;
    // A stamped change (Skip today, an edit) decides; otherwise the later day and time.
    const v = (sL[k] ?? 0) !== (sR[k] ?? 0) ? (pick(k) === 'L' ? a : b) : (a ?? '') > (b ?? '') ? a : b;
    if (v) routineMade[rid] = v;
  }

  const fields = {} as Pick<AppState, (typeof FIELDS)[number]>;
  for (const key of FIELDS) {
    (fields as Record<string, unknown>)[key] = pick(key, opts.preferRemote) === 'L' ? local[key] : remote[key];
  }
  fields.onboarded = local.onboarded || remote.onboarded;
  // A profile photo exists only on the phone it was taken on: never take another phone's photo, and
  // keep this phone's photo unless a picture was chosen on another phone after it.
  if (fields.avatar?.kind === 'photo' && fields.avatar !== local.avatar) fields.avatar = local.avatar;
  if (local.avatar?.kind === 'photo' && (sR.avatar ?? 0) <= (sL.avatar ?? 0)) fields.avatar = local.avatar;

  // Focus sessions joined by time. A phone with a full list has folded its older sessions into
  // clearedFocus; the other phone's copies of those are dropped so they are not counted twice.
  const cutoff = Math.max(
    ...[local, remote].map((s) => (s.focus.sessions.length >= SESSIONS_MAX ? Math.min(...s.focus.sessions.map((f) => f.at)) : -Infinity)),
  );
  const byAt = new Map<number, AppState['focus']['sessions'][number]>();
  for (const f of [...older.focus.sessions, ...newer.focus.sessions]) if (f.at >= cutoff) byAt.set(f.at, f);
  const allSessions = [...byAt.values()].sort((a, b) => b.at - a.at);
  const sessions = allSessions.slice(0, SESSIONS_MAX).sort((a, b) => a.at - b.at);
  days.clearedFocus = fold(days.clearedFocus, allSessions.slice(SESSIONS_MAX));

  const badges: Record<string, number> = { ...newer.badges };
  for (const [id, at] of Object.entries(older.badges ?? {})) badges[id] = Math.min(at, badges[id] ?? at);

  const best: Record<string, number> = { ...older.games.best };
  for (const [id, v] of Object.entries(newer.games.best ?? {})) best[id] = Math.max(v, best[id] ?? v);
  const plays: Record<string, number> = { ...older.games.plays };
  for (const [id, v] of Object.entries(newer.games.plays ?? {})) plays[id] = Math.max(v, plays[id] ?? 0);

  const bloomCount = Math.max(newer.bloomCount, lists.garden.length);
  return {
    ...newer,
    ...lists,
    ...days,
    ...slotLogs,
    ...fields,
    dayNotes,
    routineMade,
    deletedIds,
    stamps: pruneDeleted(joinMax(sL, sR), now),
    badges,
    games: { best, plays },
    focus: { sessions, active: local.focus.active },
    bloomCount,
    bloomsEver: Math.max(local.bloomsEver, remote.bloomsEver, bloomCount),
    modifiedAt: Math.max(local.modifiedAt ?? 0, remote.modifiedAt ?? 0),
    // This phone's own: widgets, backup dates and its daily reminder.
    widgetPrefs: local.widgetPrefs,
    widgetLocks: local.widgetLocks,
    widgetUndo: local.widgetUndo,
    backup: local.backup,
    reminder: local.reminder,
  };
}

/** What goes up to Drive: everything except this phone's own settings and its photo path. */
export function forUpload(s: AppState): Partial<AppState> {
  const { widgetPrefs: _w, widgetLocks: _l, widgetUndo: _u, backup: _b, reminder: _r, ...rest } = s;
  const photo = s.avatar?.kind === 'photo';
  const stamps = { ...s.stamps };
  // The photo stays here, so it must not look like a newer "no picture" on the other phones.
  if (photo) delete stamps.avatar;
  return { ...rest, stamps, avatar: photo ? null : s.avatar, focus: { ...s.focus, active: null } };
}
