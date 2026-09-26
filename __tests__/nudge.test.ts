/**
 * The buddy nudge: offered once per rough patch (audit H1), the buddy is chosen or automatic,
 * and the rule itself holds. Storage is replaced with an in-memory fake.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  return {
    readItem: (k: string) => mem.get(k) ?? null,
    writeItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
  };
});

import { isLowStreak } from '@/lib/nudge-rule';
import * as store from '@/lib/store';

const ready: string[] = [];
store.onNudgeReady((name) => void ready.push(name));

/** A low day yesterday, so one more low answer today meets the 2-day rule. */
function lowYesterday() {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const key = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  store.update({ checkins: { [key]: 2 } });
}

beforeEach(() => {
  store.resetAll();
  ready.length = 0;
  store.update({ onboarded: true, name: 'Aran', streak: 2 });
});

describe('nudge rule', () => {
  it('needs N low days in a row ending today, allowing one missed tap', () => {
    expect(isLowStreak({ '2026-09-24': 2, '2026-09-25': 1 }, 2, '2026-09-25')).toBe(true);
    expect(isLowStreak({ '2026-09-24': 4, '2026-09-25': 1 }, 2, '2026-09-25')).toBe(false);
    expect(isLowStreak({ '2026-09-24': 2 }, 2, '2026-09-25')).toBe(false);
    expect(isLowStreak({ '2026-09-23': 2, '2026-09-25': 2 }, 2, '2026-09-25')).toBe(true);
    expect(isLowStreak({ '2026-09-21': 2, '2026-09-25': 2 }, 2, '2026-09-25')).toBe(false);
  });
});

describe('who the buddy is', () => {
  it('is automatically the first person added to Call anytime, preferring one with a number', () => {
    expect(store.resolveBuddy()).toBeNull();
    store.addPerson('Rahul', 3, '9000000001');
    store.addPerson('Amma', 1);
    const appa = store.addPerson('Appa', 1, '9000000002');
    expect(store.resolveBuddy()?.id).toBe(appa.id);
  });

  it('can be chosen, and falls back to automatic if that person is removed', () => {
    const amma = store.addPerson('Amma', 1, '9000000003');
    const rahul = store.addPerson('Rahul', 3, '9000000001');
    store.setBuddy(rahul.id);
    expect(store.resolveBuddy()?.id).toBe(rahul.id);
    store.deletePerson(rahul.id);
    expect(store.getState().buddyId).toBeNull();
    expect(store.resolveBuddy()?.id).toBe(amma.id);
  });
});

describe('one offer per rough patch', () => {
  beforeEach(() => {
    store.addPerson('Amma', 1, '9876543210');
    lowYesterday();
  });

  it('Low then Heavy on the same day offers once', async () => {
    await Promise.all([store.recordMood(2), store.recordMood(1)]);
    expect(ready).toEqual(['Amma']);
    expect(store.getState().nudges.filter((n) => n.kind === 'auto')).toHaveLength(1);
    expect(store.todaysNudge()?.status).toBe('ready');
  });

  it('Low, Okay, Low on the same day offers once', async () => {
    await store.recordMood(2);
    await store.recordMood(3);
    await store.recordMood(2);
    expect(ready).toHaveLength(1);
  });

  it('opening the message marks it and counts as reaching out; Not now hides it', async () => {
    await store.recordMood(2);
    store.markNudgeOpened();
    expect(store.todaysNudge()?.status).toBe('opened');
    expect(store.getState().people[0].lastReachedAt).toBeDefined();
    store.dismissNudge();
    expect(store.todaysNudge()).toBeUndefined();
  });

  it('the message never mentions mood', () => {
    const text = store.nudgeMessage('Amma', 'Aran');
    expect(text).toContain('call today');
    expect(text).not.toMatch(/low|heavy|mood|sad|hard/i);
  });

  it('is not offered without a buddy', async () => {
    store.resetAll();
    store.update({ onboarded: true, streak: 2 });
    lowYesterday();
    expect(await store.recordMood(2)).toBe(false);
    expect(ready).toHaveLength(0);
  });
});
