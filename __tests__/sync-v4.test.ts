/** 4.0: device sync joins piece by piece, so an edit on one phone never undoes another phone's. */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  return {
    readItem: (k: string) => mem.get(k) ?? null,
    writeItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});

import { dayKey } from '@/lib/dates';
import * as store from '@/lib/store';
import { forUpload, mergeStates } from '@/lib/sync-merge';

const copy = () => JSON.parse(JSON.stringify(store.getState())) as store.AppState;
/** What another phone receives: the upload, cleaned the way the store cleans a download. */
const download = (s: store.AppState) => JSON.parse(JSON.stringify(forUpload(s))) as Partial<store.AppState>;

let clock = 1_800_000_000_000;
beforeEach(() => {
  clock += 3_600_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  store.resetAll();
  store.replaceState({ onboarded: true, name: 'Aran' });
});
const later = (ms = 60_000) => (clock += ms);
/** Switches the store to another phone holding `s` (loaded from sync, so nothing counts as an edit). */
const become = (s: store.AppState) => {
  store.resetAll();
  store.applyRemote(JSON.parse(JSON.stringify(s)));
};

describe('each piece takes the phone that changed it last', () => {
  it('a routine ticked on one phone stays ticked when another phone adds the day’s task later', () => {
    const r = store.addRoutine({ title: 'Medicine', quadrant: 1, kind: 'daily', times: ['00:00'], remind: false });
    const id = store.getState().tasks.find((t) => t.routineId === r.id)!.id;
    const phoneB = copy(); // phone B before the tick, with today's task added by the app itself
    later();
    store.toggleTask(id);
    const phoneA = copy();
    // Phone B opens later: its own upkeep must not count as a newer edit.
    const merged = mergeStates({ ...phoneB, modifiedAt: phoneB.modifiedAt }, phoneA);
    expect(merged.tasks.find((t) => t.id === id)?.done).toBe(true);
    expect(merged.routineLog[r.id][dayKey()]).toEqual([0]);
  });

  it('different edits on two phones both survive', () => {
    const task = store.addTask('Call the bank', 2);
    const base = copy();
    later();
    // Phone A renames the person list… phone B ticks the task (B is the later phone overall).
    store.addPerson('Amma', 1);
    const phoneA = copy();
    become(base);
    later();
    store.toggleTask(task.id);
    const phoneB = copy();
    const merged = mergeStates(phoneA, phoneB);
    expect(merged.people.map((p) => p.name)).toContain('Amma');
    expect(merged.tasks.find((t) => t.id === task.id)?.done).toBe(true);
  });

  it('a day cleared on one phone stays cleared', () => {
    const day = dayKey();
    store.update({ goodNotes: { [day]: 'Lunch with friends' } });
    const before = copy();
    later();
    store.update({ goodNotes: {} });
    const cleared = copy();
    expect(mergeStates(cleared, before).goodNotes[day]).toBeUndefined();
    expect(mergeStates(before, cleared).goodNotes[day]).toBeUndefined();
  });

  it('two phones ticking different times of a routine on the same day keep both', () => {
    const r = store.addRoutine({ title: 'Water', quadrant: 1, kind: 'daily', times: ['00:00', '23:59'], remind: false });
    const day = dayKey();
    const base = copy();
    later();
    store.setSlotMark(r.id, day, 0, 'done');
    const phoneA = copy();
    become(base);
    later();
    store.setSlotMark(r.id, day, 1, 'done');
    const phoneB = copy();
    expect(mergeStates(phoneA, phoneB).routineLog[r.id][day]).toEqual([0, 1]);
  });

  it('an item brought back after a deletion stays', () => {
    const task = store.addTask('Pay rent', 1);
    const withTask = copy();
    later();
    store.deleteTask(task.id);
    const deleted = copy();
    later();
    store.replaceState(withTask); // restored from a backup: a new change
    const restored = copy();
    expect(mergeStates(restored, deleted).tasks.some((t) => t.id === task.id)).toBe(true);
    expect(mergeStates(deleted, restored).tasks.some((t) => t.id === task.id)).toBe(true);
  });

  it('editing a routine’s times keeps its task for today after sync', () => {
    const r = store.addRoutine({ title: 'Walk', quadrant: 2, kind: 'daily', times: ['00:00'], remind: false });
    const other = copy();
    later();
    store.editRoutine(r.id, { times: ['00:00', '23:59'] });
    const id = store.getState().tasks.find((t) => t.routineId === r.id)!.id;
    const merged = mergeStates(copy(), other);
    expect(merged.tasks.some((t) => t.id === id)).toBe(true);
  });

  it('a first sync takes the name from Drive; later syncs keep this phone’s newer name', () => {
    const drive = copy();
    later();
    store.update({ name: 'New phone' });
    const phone = copy();
    expect(mergeStates(phone, drive, Date.now(), { preferRemote: true }).name).toBe('Aran');
    expect(mergeStates(phone, drive).name).toBe('New phone');
  });

  it('the daily reminder time stays on each phone; a photo never travels', () => {
    store.update({ reminder: { enabled: true, hour: 7, minute: 0 }, avatar: { kind: 'photo', uri: 'file:///me.jpg' } });
    const up = download(copy());
    expect(up.reminder).toBeUndefined();
    expect(up.avatar).toBeNull();
    expect(up.stamps?.avatar).toBeUndefined();
    const other = { ...copy(), reminder: { enabled: false, hour: 21, minute: 0 }, avatar: null };
    expect(mergeStates(other, store.getState()).reminder.enabled).toBe(false);
  });

  it('bloomsEver never falls below the flowers in the garden', () => {
    const a = { ...copy(), bloomsEver: 3, bloomCount: 3 };
    const b = { ...copy(), bloomsEver: 1, bloomCount: 9, modifiedAt: (a.modifiedAt ?? 0) + 1 };
    expect(mergeStates(a, b).bloomsEver).toBeGreaterThanOrEqual(9);
  });
});

describe('the app’s own upkeep is not an edit', () => {
  it('adding the day’s routine task does not change the sync time', () => {
    store.addRoutine({ title: 'Read', quadrant: 2, kind: 'daily', times: ['00:00'], remind: false });
    const stamp = store.getState().modifiedAt;
    later(86_400_000);
    store.ensureRoutines(new Date(clock));
    expect(store.getState().modifiedAt).toBe(stamp);
  });
});
