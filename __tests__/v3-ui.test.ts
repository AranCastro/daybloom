/** Version 3: design tokens and the Pair Up shuffle. */
import { describe, expect, it } from '@jest/globals';

import { shuffle } from '@/components/games/shuffle';
import { Colors, Radius, Spacing } from '@/constants/theme';

describe('shuffle', () => {
  it('keeps every item exactly once and leaves the input alone', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('gives every order of three items about the same share (Fisher–Yates is unbiased)', () => {
    // A small seeded generator, so the test is repeatable.
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 2 ** 32;
      return seed / 2 ** 32;
    };
    const counts = new Map<string, number>();
    const runs = 60_000;
    for (let i = 0; i < runs; i++) {
      const key = shuffle(['a', 'b', 'c'], random).join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const n of counts.values()) expect(Math.abs(n / runs - 1 / 6)).toBeLessThan(0.01);
  });
});

describe('theme tokens', () => {
  it('defines every colour for both schemes', () => {
    expect(Object.keys(Colors.dark).sort()).toEqual(Object.keys(Colors.light).sort());
  });

  it('has the status colours in both schemes', () => {
    for (const scheme of [Colors.light, Colors.dark]) {
      for (const k of ['success', 'warning', 'danger', 'rare', 'legendary', 'tagWarm', 'tagCool'] as const) {
        expect(scheme[k]).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
  });

  it('nests radii: a card holds tiles at its radius minus the compact padding', () => {
    expect(Radius.lg - Spacing.cardCompact).toBe(Radius.sm);
    expect(Radius.xs).toBeLessThan(Radius.sm);
    expect(Radius.xl).toBeGreaterThan(Radius.lg);
  });
});
