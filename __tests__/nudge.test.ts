/**
 * The buddy nudge must go out once per rough patch (audit H1, H4), and the rule itself must hold.
 * Storage and the network are replaced with in-memory fakes.
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

let mockOnline = true;
let mockDelay = 0;
const mockSent: string[] = [];
jest.mock('@/lib/ntfy', () => ({
  sendNudge: jest.fn(
    (topic: string) =>
      new Promise<boolean>((resolve) =>
        setTimeout(() => {
          if (mockOnline) mockSent.push(topic);
          resolve(mockOnline);
        }, mockDelay),
      ),
  ),
  sendTest: jest.fn(async () => true),
  buddyHasJoined: jest.fn(async () => false),
}));

import { isLowStreak } from '@/lib/nudge-rule';

type Store = typeof import('@/lib/store');

function freshStore(): Store {
  let store!: Store;
  jest.isolateModules(() => {
    store = require('@/lib/store');
  });
  store.update({ onboarded: true, name: 'Aran', streak: 2, buddy: { name: 'Anu', topic: 'nudge-test', joined: true } });
  return store;
}

/** Puts a low day yesterday so that one more low answer today meets the 2-day rule. */
function lowYesterday(store: Store) {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const key = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  store.update({ checkins: { [key]: 2 } });
}

beforeEach(() => {
  (require('@/lib/kv') as { clear: () => void }).clear();
  mockSent.length = 0;
  mockOnline = true;
  mockDelay = 0;
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

describe('one nudge per rough patch', () => {
  it('Low then Heavy while the first request is still open sends one nudge', async () => {
    const store = freshStore();
    lowYesterday(store);
    mockDelay = 50;
    const a = store.recordMood(2);
    const b = store.recordMood(1);
    await Promise.all([a, b]);
    expect(mockSent).toHaveLength(1);
    expect(store.getState().nudges.filter((n) => n.kind === 'auto')).toHaveLength(1);
  });

  it('Low, Okay, Low on the same day sends one nudge', async () => {
    const store = freshStore();
    lowYesterday(store);
    await store.recordMood(2);
    await store.recordMood(3);
    await store.recordMood(2);
    expect(mockSent).toHaveLength(1);
  });

  it('two quick retries of a queued nudge send it once', async () => {
    const store = freshStore();
    lowYesterday(store);
    mockOnline = false;
    await store.recordMood(2);
    expect(store.getState().nudges[0].status).toBe('queued');
    mockOnline = true;
    mockDelay = 30;
    await Promise.all([store.flushQueued(), store.flushQueued()]);
    expect(mockSent).toHaveLength(1);
    expect(store.getState().nudges[0].status).toBe('sent');
  });

  it('a nudge that could not go out for 36 hours is dropped, not sent late', async () => {
    const store = freshStore();
    store.update({ nudges: [{ at: Date.now() - 40 * 60 * 60 * 1000, kind: 'auto', status: 'queued' }] });
    await store.flushQueued();
    expect(mockSent).toHaveLength(0);
    expect(store.getState().nudges[0].status).toBe('expired');
  });
});
