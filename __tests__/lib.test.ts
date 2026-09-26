/** Pure helpers: flowers (audit M1), streaks, backups, productivity and quadrant clearing (M3). */
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

import { streakInfo } from '@/lib/badges';
import { makeBackup, parseBackup } from '@/lib/backup-core';
import { FLOWERS, pickFlower } from '@/lib/flowers';
import { levelOf, workByDay } from '@/lib/productivity';
import { whatsappNumber } from '@/lib/reach';
import * as store from '@/lib/store';

/** Small seeded generator so the odds test is repeatable. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('flowers', () => {
  it('rare odds match rareChance and a flower is always returned', () => {
    const rand = seeded(42);
    let rare = 0;
    const n = 50_000;
    for (let i = 0; i < n; i++) {
      const f = pickFlower(1, 'marigold', 0.15, rand);
      expect(f).toBeDefined();
      if (f.rarity === 'rare') rare++;
    }
    expect(rare / n).toBeGreaterThan(0.13);
    expect(rare / n).toBeLessThan(0.17);
  });

  it('every 20th bloom is the Golden Lotus and never repeats the last flower otherwise', () => {
    expect(pickFlower(20).id).toBe('golden-lotus');
    const rand = seeded(7);
    for (const f of FLOWERS.filter((x) => x.rarity !== 'legendary')) {
      expect(pickFlower(3, f.id, 0.5, rand).id).not.toBe(f.id);
    }
  });
});

describe('streaks', () => {
  it('counts consecutive days and forgives one missed day after seven', () => {
    const days: Record<string, number> = {};
    for (let d = 1; d <= 8; d++) days[`2026-09-${String(d).padStart(2, '0')}`] = 3;
    // 9 Sep missed, 10 Sep checked in.
    days['2026-09-10'] = 3;
    expect(streakInfo(days, '2026-09-10').current).toBe(9);
    expect(streakInfo({ '2026-09-01': 3, '2026-09-03': 3 }, '2026-09-03').current).toBe(1);
  });
});

describe('backups', () => {
  it('round-trips and refuses other files', () => {
    const s = store.getState();
    const text = makeBackup({ ...s, name: 'Aran', tasks: [{ id: 't', title: 'A', quadrant: 1, done: false, createdAt: 1 }] });
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.summary.tasks).toBe(1);
      expect('backup' in parsed.backup.state).toBe(false);
    }
    expect(parseBackup('{"hello":1}').ok).toBe(false);
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'daybloom', format: 1, state: { tasks: 'oops' } })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'daybloom', format: 99, state: {} })).ok).toBe(false);
  });
});

describe('tasks and calendar', () => {
  beforeEach(() => store.resetAll());

  it('clearing one quadrant keeps the others and keeps calendar shading', () => {
    store.addTask('Do', 1);
    store.addTask('Plan', 2);
    const [a, b] = store.getState().tasks;
    store.toggleTask(a.id);
    store.toggleTask(b.id);
    store.clearCompleted(1);
    const left = store.getState().tasks;
    expect(left.map((t) => t.title)).toEqual(['Plan']);
    const work = workByDay(left, [], store.getState().clearedWork);
    expect(Object.values(work).reduce((n, d) => n + d.tasks, 0)).toBe(2);
  });

  it('heat levels', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 9].map(levelOf)).toEqual([0, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('keeps counting blooms past the garden cap', () => {
    store.update({ bloomCount: 2000 });
    store.bloom('task', { silent: true });
    expect(store.getState().bloomCount).toBe(2001);
  });
});

describe('WhatsApp numbers', () => {
  it('adds a country code only when the region is known', () => {
    expect(whatsappNumber('98765 43210', '91')).toBe('919876543210');
    expect(whatsappNumber('+44 7700 900123', '91')).toBe('447700900123');
    expect(whatsappNumber('9876543210', null)).toBe('9876543210');
  });
});

describe('section names and avatars', () => {
  beforeEach(() => store.resetAll());

  it('renames a quadrant and restores the default when cleared', () => {
    const { quadrantName, circleName } = require('@/lib/labels');
    store.setLabel('matrix', 1, '  Today, urgent  ');
    expect(quadrantName(store.getState().labels, 1)).toBe('Today, urgent');
    store.setLabel('matrix', 1, '');
    expect(quadrantName(store.getState().labels, 1)).toBe('Do first');
    store.setLabel('circle', 3, 'Text first');
    expect(circleName(store.getState().labels, 3)).toBe('Text first');
  });

  it('keeps photos out of backups but keeps chosen avatars', () => {
    const photo = parseBackup(makeBackup({ ...store.getState(), avatar: { kind: 'photo', uri: 'file:///x.jpg' } }));
    const preset = parseBackup(makeBackup({ ...store.getState(), avatar: { kind: 'preset', id: 'flower:lotus' } }));
    expect(photo.ok && photo.backup.state.avatar).toBeNull();
    expect(preset.ok && preset.backup.state.avatar).toEqual({ kind: 'preset', id: 'flower:lotus' });
  });
});
