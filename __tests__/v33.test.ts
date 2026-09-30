/** 3.3: any open task can be focused on, and Do Not Disturb follows the focus timer when asked for. */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  return {
    readItem: (k: string) => mem.get(k) ?? null,
    writeItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 4, LOW: 2 },
  AndroidNotificationVisibility: { PRIVATE: 2 },
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  deleteNotificationChannelAsync: jest.fn(async () => undefined),
  setNotificationCategoryAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
}));

import { pauseTimer, resumeTimer, startFocus, stopTimer } from '@/lib/focus';
import { DndModule, syncFocusDnd } from '@/lib/focus-dnd';
import { sanitise } from '@/lib/sanitise';
import * as store from '@/lib/store';

function fakeDnd() {
  let on = false;
  const mod: DndModule & { calls: string[] } = {
    calls: [],
    hasAccess: () => true,
    isActive: () => on,
    openAccessSettings: () => undefined,
    start: (until: number) => {
      mod.calls.push(`start:${until}`);
      on = true;
      return true;
    },
    stop: () => {
      mod.calls.push('stop');
      on = false;
    },
  };
  return mod;
}

beforeEach(() => store.replaceState({ onboarded: true }));

describe('Do Not Disturb during focus', () => {
  it('on while a focus session that asked for it runs; off on pause, back on resume, off on stop', async () => {
    const dnd = fakeDnd();
    await startFocus('classic', undefined, true);
    const a = store.getState().focus.active!;
    expect(a.dnd).toBe(true);
    syncFocusDnd(store.getState(), Date.now(), dnd);
    expect(dnd.calls).toEqual([`start:${a.endAt}`]);
    await pauseTimer();
    syncFocusDnd(store.getState(), Date.now(), dnd);
    expect(dnd.calls.at(-1)).toBe('stop');
    await resumeTimer();
    syncFocusDnd(store.getState(), Date.now(), dnd);
    expect(dnd.calls.at(-1)).toMatch(/^start:/);
    await stopTimer();
    syncFocusDnd(store.getState(), Date.now(), dnd);
    expect(dnd.calls.at(-1)).toBe('stop');
  });

  it('left alone when the session did not ask for it', async () => {
    const dnd = fakeDnd();
    await startFocus('classic', undefined, false);
    syncFocusDnd(store.getState(), Date.now(), dnd);
    expect(dnd.calls).toEqual([]);
  });

  it('a widget start follows Settings: only "Always" turns it on without asking', async () => {
    await startFocus('gentle');
    expect(store.getState().focus.active?.dnd).toBeUndefined();
    store.setSettings({ focusDnd: 'always' });
    await startFocus('gentle');
    expect(store.getState().focus.active?.dnd).toBe(true);
  });

  it('the choice and the session flag survive a backup round trip; bad values are dropped', () => {
    const out = sanitise({
      settings: { focusDnd: 'always' },
      focus: { sessions: [], active: { kind: 'focus', preset: 'classic', total: 1500000, endAt: 5, pausedLeft: null, dnd: true } },
    });
    expect(out.settings?.focusDnd).toBe('always');
    expect(out.focus?.active?.dnd).toBe(true);
    expect(sanitise({ settings: { focusDnd: 'loud' } }).settings?.focusDnd).toBeUndefined();
  });
});
