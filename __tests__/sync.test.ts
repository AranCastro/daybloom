/** 3.4 (GitHub build): joining two phones' data for device sync. */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  return {
    readItem: (k: string) => mem.get(k) ?? null,
    writeItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});

import * as store from '@/lib/store';
import { forUpload, mergeStates, pruneDeleted, TOMBSTONE_DAYS } from '@/lib/sync-merge';

const DAY = '2026-10-01';
const copy = () => JSON.parse(JSON.stringify(store.getState())) as store.AppState;

beforeEach(() => store.replaceState({ onboarded: true }));

describe('what counts as a change', () => {
  it('edits stamp the time; widget and backup bookkeeping do not', () => {
    const before = store.getState().modifiedAt ?? 0;
    store.addTask('Water the tulsi', 1);
    const after = store.getState().modifiedAt!;
    expect(after).toBeGreaterThan(before);
    store.update({ widgetUndo: null, backup: { lastManual: 5 } });
    expect(store.getState().modifiedAt).toBe(after);
  });

  it('deleting a task or a note remembers its id', () => {
    const t = store.addTask('Call the bank', 2);
    store.addDayNote(DAY, 'Rain');
    const note = store.getState().dayNotes[DAY][0];
    store.deleteTask(t.id);
    store.deleteDayNote(DAY, note.id);
    expect(Object.keys(store.getState().deletedIds ?? {})).toEqual(expect.arrayContaining([t.id, note.id]));
  });

  it('erasing this phone is not a sync change', () => {
    store.addTask('x', 1);
    store.resetAll();
    expect(store.getState().modifiedAt).toBeUndefined();
    expect(store.getState().deletedIds).toBeUndefined();
  });
});

describe('joining two phones', () => {
  it('keeps tasks from both, newer copy of the same task wins, deletions stay deleted', () => {
    const shared = store.addTask('Shared', 1);
    const gone = store.addTask('Gone', 1);
    const phoneA = copy();
    store.toggleTask(shared.id);
    store.deleteTask(gone.id);
    const onlyB = store.addTask('Only on B', 3);
    const phoneB = copy();
    const m = mergeStates(phoneA, phoneB);
    expect(m.tasks.map((x) => x.title).sort()).toEqual(['Only on B', 'Shared']);
    expect(m.tasks.find((x) => x.id === shared.id)?.done).toBe(true);
    expect(m.tasks.some((x) => x.id === onlyB.id)).toBe(true);
    // Same result whichever phone does the joining.
    expect(mergeStates(phoneB, phoneA).tasks.map((x) => x.id).sort()).toEqual(m.tasks.map((x) => x.id).sort());
  });

  it('joins days and notes from both phones', () => {
    const a = { ...copy(), checkins: { '2026-09-30': 4 as const }, dayNotes: { [DAY]: [{ id: 'n1', text: 'A', at: 1 }] }, modifiedAt: 10 };
    const b = { ...copy(), checkins: { [DAY]: 2 as const }, dayNotes: { [DAY]: [{ id: 'n2', text: 'B', at: 2 }] }, modifiedAt: 20 };
    const m = mergeStates(a, b);
    expect(m.checkins).toEqual({ '2026-09-30': 4, [DAY]: 2 });
    expect(m.dayNotes[DAY].map((n) => n.text)).toEqual(['A', 'B']);
  });

  it('keeps this phone’s widget settings, backup dates, timer and photo', () => {
    const local = { ...copy(), widgetLocks: { Tasks: true }, backup: { lastManual: 1 }, avatar: { kind: 'photo' as const, uri: 'file:///me.jpg' }, modifiedAt: 1 };
    const remote = { ...copy(), widgetLocks: {}, backup: {}, avatar: { kind: 'preset' as const, id: 'lotus' }, name: 'Aran', modifiedAt: 2 };
    const m = mergeStates(local, remote);
    expect(m.widgetLocks).toEqual({ Tasks: true });
    expect(m.backup).toEqual({ lastManual: 1 });
    expect(m.avatar).toEqual(local.avatar);
    expect(m.name).toBe('Aran');
  });

  it('forgets deletions after the tombstone period', () => {
    const now = Date.now();
    expect(pruneDeleted({ old: now - (TOMBSTONE_DAYS + 1) * 86_400_000, fresh: now }, now)).toEqual({ fresh: now });
  });

  it('the uploaded copy leaves out this phone’s own things', () => {
    const up = forUpload({ ...copy(), avatar: { kind: 'photo', uri: 'file:///me.jpg' } });
    expect(up.widgetPrefs).toBeUndefined();
    expect(up.backup).toBeUndefined();
    expect(up.avatar).toBeNull();
    expect(up.focus?.active).toBeNull();
  });

  it('applyRemote cleans the download and does not count as a local edit', () => {
    const t = store.addTask('Mine', 1);
    const stamp = store.getState().modifiedAt!;
    const changed = store.applyRemote({ tasks: [{ id: 'r1', title: 'From the other phone', quadrant: 2, done: false, createdAt: 1 } as never, { bad: true } as never], modifiedAt: stamp - 5 });
    expect(changed).toBe(true);
    expect(store.getState().tasks.map((x) => x.id).sort()).toEqual([t.id, 'r1'].sort());
    expect(store.getState().modifiedAt).toBe(stamp);
    expect(store.applyRemote({ tasks: [], modifiedAt: 0 })).toBe(false);
  });
});
