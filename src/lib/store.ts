/**
 * App state: a tiny external store persisted to on-device storage.
 * Everything stays on the phone. The only thing that ever leaves it is the
 * one-line nudge sent to the buddy's ntfy topic.
 */
import { useSyncExternalStore } from 'react';

import { dayKey } from '@/lib/dates';
import { readItem, removeItem, writeItem } from '@/lib/kv';
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
