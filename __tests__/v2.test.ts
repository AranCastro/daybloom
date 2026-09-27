/** Version 2: mood tags, widget looks for every widget, Pomodoro widget buttons, focus sounds, app lock. */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  return {
    readItem: (k: string) => mem.get(k) ?? null,
    writeItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});
jest.mock('@/widgets/sync', () => ({ refreshWidgets: jest.fn(async () => undefined) }));
jest.mock('@/lib/reminders', () => ({ scheduleFocusAlarm: jest.fn(), cancelFocusAlarm: jest.fn() }));
jest.mock('expo-audio', () => {
  const player = { play: jest.fn(), pause: jest.fn(), replace: jest.fn(), setActiveForLockScreen: jest.fn(), clearLockScreenControls: jest.fn(), loop: false, volume: 1 };
  return { createAudioPlayer: jest.fn(() => player), setAudioModeAsync: jest.fn(async () => undefined), __player: player };
});
jest.mock('expo-crypto', () => {
  const { createHash, randomUUID } = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_a: string, data: string) => createHash('sha256').update(data).digest('hex'),
    randomUUID: () => randomUUID(),
  };
});
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: async () => false,
  isEnrolledAsync: async () => false,
  authenticateAsync: async () => ({ success: false }),
}));

import * as lock from '@/lib/app-lock';
import { startFocusSoundSync } from '@/lib/focus-sound';
import { MAX_TAGS_PER_DAY, MOOD_TAGS, topTags } from '@/lib/mood-tags';
import * as store from '@/lib/store';
import { snapshot } from '@/widgets/data';
import { widgetTaskHandler } from '@/widgets/task-handler';

function click(widgetName: string, clickAction: string, clickActionData: Record<string, string> = {}) {
  return widgetTaskHandler({
    widgetInfo: { widgetName, widgetId: 1, width: 164, height: 164, screenInfo: {} as never },
    widgetAction: 'WIDGET_CLICK',
    clickAction,
    clickActionData,
    renderWidget: jest.fn(),
  } as never);
}

describe('mood tags', () => {
  beforeEach(() => store.update({ moodTags: {} }));

  it('offers twenty tags with unique ids', () => {
    expect(MOOD_TAGS).toHaveLength(20);
    expect(new Set(MOOD_TAGS.map((t) => t.id)).size).toBe(20);
  });

  it('adds and removes tags, at most five a day, and drops empty days', () => {
    const day = '2026-09-27';
    for (const t of MOOD_TAGS.slice(0, 7)) store.toggleMoodTag(day, t.id, MAX_TAGS_PER_DAY);
    expect(store.getState().moodTags[day]).toHaveLength(5);
    for (const id of [...store.getState().moodTags[day]]) store.toggleMoodTag(day, id);
    expect(store.getState().moodTags[day]).toBeUndefined();
  });

  it('ranks the most used tags', () => {
    const top = topTags({ a: ['tension', 'tired'], b: ['tension'], c: ['happy'] }, ['a', 'b', 'c'], 2);
    expect(top.map((x) => [x.tag.id, x.count])).toEqual([
      ['tension', 2],
      ['tired', 1],
    ]);
  });
});

describe('widget looks', () => {
  it('an older backup with only Matrix and Circle looks gives every widget a look', () => {
    store.replaceState({ onboarded: true, widgetPrefs: { Matrix: { ...store.DEFAULT_WIDGET_PREFS, opacity: 60 } } as never });
    const prefs = store.getState().widgetPrefs;
    expect(Object.keys(prefs).sort()).toEqual([...store.WIDGET_KEYS].sort());
    expect(prefs.Matrix.opacity).toBe(60);
    expect(prefs.Garden.opacity).toBe(100);
  });
});

describe('Pomodoro widget', () => {
  beforeEach(() => store.update({ onboarded: true, focus: { sessions: [], active: null } }));

  it('starts, pauses, resumes and stops from the home screen', async () => {
    await click('Focus', 'FOCUS_START', { preset: 'classic' });
    expect(store.getState().focus.active?.total).toBe(25 * 60_000);
    expect(snapshot(store.getState()).focus.running).toBe(true);
    await click('Focus', 'FOCUS_PAUSE');
    expect(store.getState().focus.active?.endAt).toBeNull();
    await click('Focus', 'FOCUS_RESUME');
    expect(store.getState().focus.active?.endAt).not.toBeNull();
    await click('Focus', 'FOCUS_STOP');
    expect(store.getState().focus.active).toBeNull();
  });

  it('ignores an unknown preset', async () => {
    await click('Focus', 'FOCUS_START', { preset: 'forever' });
    expect(store.getState().focus.active).toBeNull();
  });
});

describe('focus sounds', () => {
  it('play during a focus session and stop on pause', async () => {
    const player = (jest.requireMock('expo-audio') as { __player: { play: jest.Mock; pause: jest.Mock } }).__player;
    store.update({ focus: { sessions: [], active: null }, settings: { ...store.getState().settings, focusSound: 'rain', focusVolume: 0.6 } });
    const stop = startFocusSoundSync(store.getState, store.subscribe);
    await click('Focus', 'FOCUS_START', { preset: 'gentle' });
    await Promise.resolve();
    await Promise.resolve();
    expect(player.play).toHaveBeenCalled();
    await click('Focus', 'FOCUS_PAUSE');
    expect(player.pause).toHaveBeenCalled();
    await click('Focus', 'FOCUS_STOP');
    stop();
  });
});

describe('app lock', () => {
  it('locks with a PIN, refuses a wrong one and makes you wait after five', async () => {
    await lock.setPin('2468');
    expect(await lock.checkPin('2468')).toBe(true);
    expect(await lock.checkPin('1111')).toBe(false);
    for (let i = 0; i < 4; i++) expect(await lock.unlockWithPin('0000')).toBe('wrong');
    expect(await lock.unlockWithPin('0000')).toBe('wait');
    expect(lock.waitSeconds()).toBeGreaterThan(0);
    expect(await lock.unlockWithPin('2468')).toBe('wait');
  });

  it('never stores the PIN itself, and turning it off removes it', async () => {
    await lock.setPin('1357');
    const kv = jest.requireMock('@/lib/kv') as { readItem: (k: string) => string | null };
    const raw = kv.readItem('daybloom.lock.v1') ?? '';
    expect(raw).not.toContain('1357');
    lock.disableLock();
    expect(kv.readItem('daybloom.lock.v1')).toBeNull();
    expect(await lock.checkPin('9999')).toBe(true);
  });
});
