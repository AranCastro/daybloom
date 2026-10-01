/**
 * Merging two phones' Daybloom data for device sync (lib/device-sync). Pure functions only, so the
 * rules can be tested without a network.
 *
 * Rules:
 * - Lists of things with ids (tasks, people, garden, routines…) are joined by id. When both phones
 *   have the same item, the copy from the phone changed most recently wins. An id deleted on either
 *   phone (`deletedIds`) stays deleted.
 * - Day-by-day records (check-ins, feelings, notes, energy…) are joined day by day; the same day on
 *   both phones takes the most recently changed phone's value. Notes are joined note by note.
 * - Single values (name, settings, section names…) come from the most recently changed phone.
 * - Things that belong to one phone stay on it: home-screen widget settings, backup dates, the
 *   timer running right now, and a profile photo (the file lives on that phone).
 */
import type { AppState } from '@/lib/store';

/** Lists whose items carry an `id`; deletions in them are remembered for sync. */
export const ID_LISTS = ['tasks', 'people', 'places', 'pookalams', 'routines', 'customMoods', 'garden'] as const;
type IdList = (typeof ID_LISTS)[number];

/** Day-keyed records, joined day by day. */
const DAY_MAPS = ['checkins', 'moodTags', 'goodNotes', 'energy', 'checkinPlace', 'clearedWork', 'clearedFocus'] as const;

/** Deletions are remembered this long; after that a stale phone could bring an item back. */
export const TOMBSTONE_DAYS = 180;

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

/** Drops deletions older than TOMBSTONE_DAYS. */
export function pruneDeleted(deleted: Record<string, number>, now: number): Record<string, number> {
  const cutoff = now - TOMBSTONE_DAYS * 86_400_000;
  return Object.fromEntries(Object.entries(deleted).filter(([, at]) => at >= cutoff));
}

function joinById<T extends { id: string }>(newer: readonly T[], older: readonly T[], deleted: Record<string, number>): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...newer, ...older]) {
    if (seen.has(item.id) || deleted[item.id]) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function joinDays<V>(newer: Record<string, V> | undefined, older: Record<string, V> | undefined): Record<string, V> {
  return { ...older, ...newer };
}

/**
 * Joins this phone's data (`local`) with the copy from the other phones (`remote`, already cleaned
 * by the store). `modifiedAt` on each says which was changed last.
 */
export function mergeStates(local: AppState, remote: AppState, now = Date.now()): AppState {
  const localNewer = (local.modifiedAt ?? 0) >= (remote.modifiedAt ?? 0);
  const newer = localNewer ? local : remote;
  const older = localNewer ? remote : local;

  const deleted: Record<string, number> = { ...older.deletedIds };
  for (const [id, at] of Object.entries(newer.deletedIds ?? {})) deleted[id] = Math.max(at, deleted[id] ?? 0);
  const deletedIds = pruneDeleted(deleted, now);

  const lists = {} as Pick<AppState, IdList>;
  for (const key of ID_LISTS) {
    (lists as Record<IdList, unknown>)[key] = joinById(
      (newer[key] ?? []) as { id: string }[],
      (older[key] ?? []) as { id: string }[],
      deletedIds,
    );
  }
  // The garden list is newest first; keep it that way after joining.
  lists.garden = [...lists.garden].sort((a, b) => b.at - a.at);

  const days = {} as Pick<AppState, (typeof DAY_MAPS)[number]>;
  for (const key of DAY_MAPS) {
    (days as Record<string, unknown>)[key] = joinDays(newer[key] as Record<string, unknown>, older[key] as Record<string, unknown>);
  }

  const dayNotes: AppState['dayNotes'] = {};
  for (const day of new Set([...Object.keys(newer.dayNotes ?? {}), ...Object.keys(older.dayNotes ?? {})])) {
    const notes = joinById(newer.dayNotes?.[day] ?? [], older.dayNotes?.[day] ?? [], deletedIds).sort((a, b) => a.at - b.at);
    if (notes.length) dayNotes[day] = notes;
  }

  const sessions = new Map<number, AppState['focus']['sessions'][number]>();
  for (const s of [...older.focus.sessions, ...newer.focus.sessions]) sessions.set(s.at, s);

  const badges: Record<string, number> = { ...newer.badges };
  for (const [id, at] of Object.entries(older.badges ?? {})) badges[id] = Math.min(at, badges[id] ?? at);

  const best: Record<string, number> = { ...older.games.best };
  for (const [id, v] of Object.entries(newer.games.best ?? {})) best[id] = Math.max(v, best[id] ?? v);
  const plays: Record<string, number> = { ...older.games.plays };
  for (const [id, v] of Object.entries(newer.games.plays ?? {})) plays[id] = Math.max(v, plays[id] ?? 0);

  const routineMade: Record<string, string> = { ...older.routineMade };
  for (const [id, v] of Object.entries(newer.routineMade ?? {})) routineMade[id] = (routineMade[id] ?? '') > v ? routineMade[id] : v;

  // Routine history: joined day by day per routine; a deleted routine's history goes with it.
  const routineLog: AppState['routineLog'] = {};
  for (const id of new Set([...Object.keys(older.routineLog ?? {}), ...Object.keys(newer.routineLog ?? {})])) {
    if (deletedIds[id]) continue;
    routineLog[id] = joinDays(newer.routineLog?.[id], older.routineLog?.[id]);
  }

  return {
    ...newer,
    routineLog,
    ...lists,
    ...days,
    dayNotes,
    deletedIds,
    badges,
    games: { best, plays },
    routineMade,
    focus: { sessions: [...sessions.values()].sort((a, b) => a.at - b.at), active: local.focus.active },
    bloomCount: Math.max(newer.bloomCount, lists.garden.length),
    bloomsEver: Math.max(local.bloomsEver, remote.bloomsEver),
    onboarded: local.onboarded || remote.onboarded,
    modifiedAt: Math.max(local.modifiedAt ?? 0, remote.modifiedAt ?? 0),
    // This phone's own: widgets, backup dates, and a photo that only exists here.
    widgetPrefs: local.widgetPrefs,
    widgetLocks: local.widgetLocks,
    widgetUndo: local.widgetUndo,
    backup: local.backup,
    avatar: local.avatar?.kind === 'photo' ? local.avatar : newer.avatar?.kind === 'photo' ? local.avatar : newer.avatar,
  };
}

/** What goes up to Drive: everything except this phone's own settings and its photo path. */
export function forUpload(s: AppState): Partial<AppState> {
  const { widgetPrefs: _w, widgetLocks: _l, widgetUndo: _u, backup: _b, ...rest } = s;
  return { ...rest, avatar: s.avatar?.kind === 'photo' ? null : s.avatar, focus: { ...s.focus, active: null } };
}
