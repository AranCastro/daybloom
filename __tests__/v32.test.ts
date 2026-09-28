/** 3.2: routines never hidden by the energy filter, small notes for every day, and the user's own moods. */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  return {
    readItem: (k: string) => mem.get(k) ?? null,
    writeItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});

import { fitEnergy } from '@/lib/effort';
import { cleanMoodWord, tagOf, topTags } from '@/lib/mood-tags';
import { sanitise } from '@/lib/sanitise';
import * as store from '@/lib/store';

const DAY = '2026-09-28';

beforeEach(() => store.replaceState({ onboarded: true }));

describe('routines and the energy filter', () => {
  it('a routine task shows on a low-energy day whatever its effort', () => {
    const tasks = [
      { effort: 'moderate' as const, done: false, routineId: 'r1' },
      { effort: 'moderate' as const, done: false },
      { effort: 'quick' as const, done: false },
    ];
    expect(fitEnergy(tasks, 1)).toEqual([tasks[0], tasks[2]]);
  });
});

describe('small notes for every day', () => {
  it('adds several notes a day, edits and deletes them', () => {
    store.addDayNote(DAY, '  Rain all morning ');
    store.addDayNote(DAY, 'Fought with my brother, felt low');
    store.addDayNote(DAY, '   ');
    let notes = store.getState().dayNotes[DAY];
    expect(notes.map((n) => n.text)).toEqual(['Rain all morning', 'Fought with my brother, felt low']);
    store.editDayNote(DAY, notes[1].id, 'Made up with my brother');
    notes = store.getState().dayNotes[DAY];
    expect(notes[1].text).toBe('Made up with my brother');
    store.deleteDayNote(DAY, notes[0].id);
    store.deleteDayNote(DAY, notes[1].id);
    expect(store.getState().dayNotes[DAY]).toBeUndefined();
  });

  it('keeps at most twenty a day and 280 characters each', () => {
    for (let i = 0; i < 25; i++) store.addDayNote(DAY, `note ${i}`);
    expect(store.getState().dayNotes[DAY]).toHaveLength(store.NOTES_PER_DAY);
    store.addDayNote('2026-09-29', 'x'.repeat(400));
    expect(store.getState().dayNotes['2026-09-29'][0].text).toHaveLength(store.NOTE_MAX);
  });

  it('a damaged backup keeps only good notes', () => {
    const out = sanitise({ dayNotes: { [DAY]: [{ id: 'a', text: 'ok', at: 1 }, { id: 'b' }, null], nope: [{ id: 'c', text: 'x' }], '2026-09-01': [] } });
    expect(out.dayNotes).toEqual({ [DAY]: [{ id: 'a', text: 'ok', at: 1 }] });
  });
});

describe('your own moods', () => {
  it('one word, any script, capitalised', () => {
    expect(cleanMoodWord('  so sleepy ')).toBe('So');
    expect(cleanMoodWord('sleepy!!')).toBe('Sleepy');
    expect(cleanMoodWord('ஆனந்தம்')).toBe('ஆனந்தம்');
    expect(cleanMoodWord('123')).toBe('');
  });

  it('adds a mood with its emoji, reuses the same word, tags a day with it', () => {
    const m = store.addCustomMood('sleepy', '😪', 'heavy')!;
    expect(m).toMatchObject({ label: 'Sleepy', emoji: '😪', tone: 'heavy' });
    expect(m.id.startsWith('my-')).toBe(true);
    expect(store.addCustomMood('SLEEPY', '🙂', 'light')?.id).toBe(m.id);
    expect(store.addCustomMood('   ', '🙂', 'light')).toBeNull();
    store.toggleMoodTag(DAY, m.id, 5);
    const custom = store.getState().customMoods;
    expect(tagOf(m.id, custom)?.label).toBe('Sleepy');
    expect(tagOf(m.id)).toBeUndefined(); // not a built-in
    expect(topTags(store.getState().moodTags, [DAY], 3, custom)[0].tag.label).toBe('Sleepy');
    store.deleteCustomMood(m.id);
    expect(store.getState().customMoods).toHaveLength(0);
    expect(store.getState().moodTags[DAY]).toEqual([m.id]); // the day keeps its tag
  });

  it('a damaged backup keeps only valid own moods', () => {
    const out = sanitise({
      customMoods: [
        { id: 'my-1', label: 'Sleepy', emoji: '😪', tone: 'heavy' },
        { id: 'happy', label: 'Clash', emoji: '🙂' },
        { id: 'my-2', label: '', emoji: '🙂' },
        { id: 'my-3', label: 'Calm', emoji: '', tone: 'odd' },
      ],
    });
    expect(out.customMoods).toEqual([
      { id: 'my-1', label: 'Sleepy', emoji: '😪', tone: 'heavy' },
      { id: 'my-3', label: 'Calm', emoji: '🙂', tone: 'light' },
    ]);
  });
});
