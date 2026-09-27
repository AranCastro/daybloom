/** Version 3 audit fixes: app lock storage, grace and returns; reminder buttons handled once; focus alarm races. */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  return {
    readItem: (k: string) => mem.get(k) ?? null,
    writeItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    __mem: mem,
  };
});
jest.mock('expo-secure-store', () => {
  const mem = new Map<string, string>();
  return {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    deleteItemAsync: async (k: string) => void mem.delete(k),
    __mem: mem,
  };
});
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(async () => undefined),
  allowScreenCaptureAsync: jest.fn(async () => undefined),
  enableAppSwitcherProtectionAsync: jest.fn(async () => undefined),
  disableAppSwitcherProtectionAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-crypto', () => {
  const { createHash, randomUUID } = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_a: string, data: string) => createHash('sha256').update(data).digest('hex'),
    digest: async (_a: string, data: Uint8Array) => new Uint8Array(createHash('sha256').update(data).digest()).buffer,
    randomUUID: () => randomUUID(),
  };
});
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: async () => false,
  isEnrolledAsync: async () => false,
  authenticateAsync: async () => ({ success: false }),
}));
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
  dismissNotificationAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), pause: jest.fn(), replace: jest.fn(), setActiveForLockScreen: jest.fn(), clearLockScreenControls: jest.fn(), loop: false, volume: 1 })),
  setAudioModeAsync: jest.fn(),
}));

import { createHash } from 'crypto';

import { addDays, dayKey } from '@/lib/dates';
import type * as LockModule from '@/lib/app-lock';

type Mem = { __mem: Map<string, string> };
const kvMem = () => (jest.requireMock('@/lib/kv') as Mem).__mem;
const secureMem = () => (jest.requireMock('expo-secure-store') as Mem).__mem;
const notifications = () =>
  jest.requireMock('expo-notifications') as Record<'scheduleNotificationAsync' | 'cancelScheduledNotificationAsync', jest.Mock>;

/** A fresh copy of the lock module, as after an app restart (storage is kept). */
function freshLock(): typeof LockModule {
  let mod!: typeof LockModule;
  jest.isolateModules(() => {
    mod = jest.requireActual<typeof LockModule>('@/lib/app-lock');
  });
  return mod;
}

describe('app lock storage', () => {
  beforeEach(() => {
    kvMem().clear();
    secureMem().clear();
  });

  it('moves an old kv record into the secure store, and upgrades its hash on unlock', async () => {
    const salt = 'old-salt';
    const old = { hash: createHash('sha256').update(`${salt}:2468`).digest('hex'), salt, biometric: false, after: 60 };
    kvMem().set('daybloom.lock.v1', JSON.stringify(old));
    const lock = freshLock();
    expect(kvMem().has('daybloom.lock.v1')).toBe(false);
    expect(await lock.unlockWithPin('1111')).toBe('wrong');
    expect(await lock.unlockWithPin('2468')).toBe('ok');
    const saved = JSON.parse(secureMem().get('daybloom.lock.v1')!) as { rounds?: number; hash: string; after: number };
    expect(saved.rounds).toBeGreaterThanOrEqual(1000);
    expect(saved.hash).not.toBe(old.hash);
    expect(saved.after).toBe(60);
    // The upgraded record still opens with the same PIN, after a restart too.
    expect(await freshLock().checkPin('2468')).toBe(true);
    expect(await freshLock().checkPin('2469')).toBe(false);
  });

  it('keeps wrong tries across a restart, with longer waits each time', async () => {
    let now = 1_000_000;
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    let lock = freshLock();
    await lock.setPin('1357');
    for (let i = 0; i < 4; i++) expect(await lock.unlockWithPin('0000')).toBe('wrong');
    lock = freshLock(); // force-stopped and opened again
    expect(await lock.unlockWithPin('0000')).toBe('wait');
    expect(lock.waitSeconds()).toBe(30);
    lock = freshLock();
    expect(await lock.unlockWithPin('1357')).toBe('wait');
    now += 31_000;
    for (let i = 0; i < 4; i++) expect(await lock.unlockWithPin('0000')).toBe('wrong');
    expect(await lock.unlockWithPin('0000')).toBe('wait');
    expect(lock.waitSeconds()).toBe(60);
    expect(lock.waitLabel()).toBe('1 minute');
    now += 61_000;
    expect(await lock.unlockWithPin('1357')).toBe('ok');
    expect(secureMem().get('daybloom.lock-attempts.v1') || null).toBeNull();
    spy.mockRestore();
  });

  it('secures the screen while the lock is on', async () => {
    const sc = jest.requireMock('expo-screen-capture') as Record<string, jest.Mock>;
    sc.preventScreenCaptureAsync.mockClear();
    sc.allowScreenCaptureAsync.mockClear();
    const lock = freshLock();
    await lock.setPin('1357');
    expect(sc.preventScreenCaptureAsync).toHaveBeenCalled();
    lock.disableLock();
    expect(sc.allowScreenCaptureAsync).toHaveBeenCalled();
  });
});

describe('when the app locks again', () => {
  let lock: typeof LockModule;
  const locked = () => lock.isLocked();

  beforeEach(async () => {
    kvMem().clear();
    secureMem().clear();
    lock = freshLock();
    await lock.setPin('1357');
    lock.setLockAfter(0);
  });

  it('"Immediately" locks on the way out, but not for a glance under five seconds', () => {
    lock.onAppStateChange('background', 10_000);
    expect(locked()).toBe(true);
    lock.onAppStateChange('active', 13_000);
    expect(locked()).toBe(false);
    lock.onAppStateChange('background', 20_000);
    lock.onAppStateChange('active', 26_000);
    expect(locked()).toBe(true);
  });

  it('a picker or share sheet does not lock on its return, for two minutes at most', () => {
    lock.expectReturn(10_000);
    lock.onAppStateChange('background', 10_000);
    expect(locked()).toBe(false);
    lock.onAppStateChange('active', 70_000);
    expect(locked()).toBe(false);
    // The expectation was used up: the next time away locks as usual.
    lock.onAppStateChange('background', 80_000);
    expect(locked()).toBe(true);
  });

  it('an expected return that takes too long still locks', () => {
    lock.expectReturn(10_000);
    lock.onAppStateChange('background', 10_000);
    lock.onAppStateChange('active', 10_000 + 3 * 60_000);
    expect(locked()).toBe(true);
  });

  it('"After 1 min" waits a minute', () => {
    lock.setLockAfter(60);
    lock.onAppStateChange('background', 10_000);
    expect(locked()).toBe(false);
    lock.onAppStateChange('active', 50_000);
    expect(locked()).toBe(false);
    lock.onAppStateChange('background', 60_000);
    lock.onAppStateChange('active', 125_000);
    expect(locked()).toBe(true);
  });
});

describe('reminder buttons', () => {
  it('handles one press once, even when both the background task and the app see it', async () => {
    const { handleCheckinAction } = jest.requireActual<typeof import('@/lib/notification-checkin')>('@/lib/notification-checkin');
    const store = jest.requireActual<typeof import('@/lib/store')>('@/lib/store');
    store.replaceState({ onboarded: true });
    notifications().scheduleNotificationAsync.mockClear();
    expect(await handleCheckinAction('mood-4', 'daily-checkin', 111)).toBe(true);
    expect(await handleCheckinAction('mood-4', 'daily-checkin', 111)).toBe(false);
    expect(notifications().scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    // The next day's reminder has the same identifier but a new delivery time.
    expect(await handleCheckinAction('mood-3', 'daily-checkin', 222)).toBe(true);
  });

  it('keeps only a short list of handled presses', async () => {
    const { claimAction } = jest.requireActual<typeof import('@/lib/notification-checkin')>('@/lib/notification-checkin');
    for (let i = 0; i < 50; i++) claimAction('mood-4', 'daily-checkin', i);
    expect((JSON.parse(kvMem().get('daybloom.checkin-actions.v1')!) as string[]).length).toBeLessThanOrEqual(20);
  });
});

describe('focus alarm', () => {
  it('Start then Stop at once leaves no alarm behind', async () => {
    const { cancelFocusAlarm, scheduleFocusAlarm } = jest.requireActual<typeof import('@/lib/reminders')>('@/lib/reminders');
    const n = notifications();
    n.scheduleNotificationAsync.mockClear();
    const start = scheduleFocusAlarm(Date.now() + 25 * 60_000, 'Focus session complete', 'x');
    const stop = cancelFocusAlarm();
    await Promise.all([start, stop]);
    expect(n.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(n.cancelScheduledNotificationAsync).toHaveBeenCalledWith('focus-timer');
  });

  it('schedules when left alone, and sets up the channels only once', async () => {
    const { scheduleFocusAlarm } = jest.requireActual<typeof import('@/lib/reminders')>('@/lib/reminders');
    const n = notifications();
    n.scheduleNotificationAsync.mockClear();
    const category = (jest.requireMock('expo-notifications') as { setNotificationCategoryAsync: jest.Mock }).setNotificationCategoryAsync;
    category.mockClear();
    await scheduleFocusAlarm(Date.now() + 60_000, 'a', 'b');
    await scheduleFocusAlarm(Date.now() + 60_000, 'a', 'b');
    expect(n.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    // Each category (check-in buttons, routine Done) is set up at most once, not per alarm.
    const ids = category.mock.calls.map((c) => c[0]);
    expect(ids.length).toBe(new Set(ids).size);
  });
});

describe('focus history beyond 500 sessions', () => {
  it('folds dropped sessions into day totals that shading and the streak still count', async () => {
    const focus = jest.requireActual<typeof import('@/lib/focus')>('@/lib/focus');
    const { workByDay } = jest.requireActual<typeof import('@/lib/productivity')>('@/lib/productivity');
    const store = jest.requireActual<typeof import('@/lib/store')>('@/lib/store');
    const today = new Date();
    const old = dayKey(addDays(today, -300));
    const sessions = Array.from({ length: focus.MAX_SESSIONS }, (_, i) => ({ at: addDays(today, -300).getTime() + i, minutes: 25, flower: 'f' }));
    store.replaceState({ onboarded: true, focus: { sessions: sessions.reverse(), active: null } });
    store.update((st) => ({ focus: { ...st.focus, active: { kind: 'focus', preset: 'classic', total: 25 * 60_000, endAt: Date.now() - 1, pausedLeft: null } } }));
    expect(focus.completeFocus()).not.toBeNull();
    const s = store.getState();
    expect(s.focus.sessions).toHaveLength(focus.MAX_SESSIONS);
    expect(s.clearedFocus[old]).toEqual({ sessions: 1, minutes: 25 });
    expect(workByDay([], s.focus.sessions, {}, s.clearedFocus)[old].focus).toBe(focus.MAX_SESSIONS);
    // A day known only from the totals still counts towards the streak.
    const yesterday = dayKey(addDays(today, -1));
    expect(focus.focusStreak([], today, { [yesterday]: { sessions: 2, minutes: 50 } })).toBe(1);
  });
});

describe('focus sound', () => {
  it('tries the background audio mode again after a failure', async () => {
    const audio = jest.requireMock('expo-audio') as { setAudioModeAsync: jest.Mock };
    audio.setAudioModeAsync.mockImplementationOnce(async () => {
      throw new Error('busy');
    });
    audio.setAudioModeAsync.mockImplementation(async () => undefined);
    const { playSound } = jest.requireActual<typeof import('@/lib/focus-sound')>('@/lib/focus-sound');
    await playSound('rain', 0.5, false);
    await playSound('rain', 0.5, false);
    await playSound('rain', 0.5, false);
    expect(audio.setAudioModeAsync).toHaveBeenCalledTimes(2);
  });
});
