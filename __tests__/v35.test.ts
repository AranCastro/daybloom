/** 3.5: routine history (each time a routine is ticked off) and the numbers drawn from it. */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  return {
    readItem: (k: string) => mem.get(k) ?? null,
    writeItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});

import { addDays, dayKey, fromKey } from '@/lib/dates';
import { allRoutinesWeek, cellFor, lastDays, routineStats } from '@/lib/routine-stats';
import type { Routine } from '@/lib/routines';
import { sanitise } from '@/lib/sanitise';
import * as store from '@/lib/store';
import { mergeStates } from '@/lib/sync-merge';

const TODAY = '2026-10-01'; // a Thursday
const day = (n: number) => dayKey(addDays(fromKey(TODAY), n));
const daily = (times = ['08:00']): Routine => ({ id: 'r1', title: 'Medicine', quadrant: 1, kind: 'daily', start: day(-20), times, remind: false, createdAt: 0 });

beforeEach(() => store.replaceState({ onboarded: true }));

describe('the history log', () => {
  it('records ticks from any path, and an untick removes them', () => {
    const r = store.addRoutine({ title: 'Walk', quadrant: 2, kind: 'daily', times: ['00:00'], remind: false });
    const task = store.getState().tasks.find((t) => t.routineId === r.id)!;
    store.toggleTask(task.id);
    expect(store.getState().routineLog[r.id]).toEqual({ [task.due!]: [0] });
    store.toggleTask(task.id);
    expect(store.getState().routineLog[r.id]).toEqual({});
    // A widget or reminder writes the task directly; it is still recorded.
    store.update((s) => ({ tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, done: true, doneAt: 1 } : t)) }));
    expect(store.getState().routineLog[r.id][task.due!]).toEqual([0]);
  });

  it('keeps the history when the task is replaced, and drops it with the routine', () => {
    const r = store.addRoutine({ title: 'Walk', quadrant: 2, kind: 'daily', times: ['00:00'], remind: false });
    const task = store.getState().tasks.find((t) => t.routineId === r.id)!;
    store.toggleTask(task.id);
    store.ensureRoutines(addDays(new Date(), 1));
    expect(Object.keys(store.getState().routineLog[r.id])).toEqual([task.due]);
    store.deleteRoutine(r.id);
    expect(store.getState().routineLog[r.id]).toBeUndefined();
  });

  it('data from before 3.5 gets its history from the flowers routine tasks grew', () => {
    store.replaceState({
      onboarded: true,
      routines: [daily()],
      garden: [
        { id: 'b1', at: 1, flower: 'jasmine', source: 'task', ref: `r1:${day(-2)}:0` },
        { id: 'b2', at: 2, flower: 'jasmine', source: 'task', ref: `r1:${day(-2)}:0` },
        { id: 'b3', at: 3, flower: 'jasmine', source: 'task', ref: `gone:${day(-1)}:0` },
      ] as never,
    });
    expect(store.getState().routineLog).toEqual({ r1: { [day(-2)]: [0] } });
  });

  it('a damaged history keeps only real days and slots', () => {
    const out = sanitise({ routineLog: { r1: { [TODAY]: [0, 0, 2, 7, 'x'], nope: [1], [day(-1)]: [] }, r2: 'bad' } });
    expect(out.routineLog).toEqual({ r1: { [TODAY]: [0, 2] } });
  });

  it('two phones join their histories day by day', () => {
    const base = store.getState();
    const a = { ...base, routineLog: { r1: { [day(-1)]: [0] } }, modifiedAt: 1 };
    const b = { ...base, routineLog: { r1: { [TODAY]: [0] }, r2: { [TODAY]: [1] } }, modifiedAt: 2, deletedIds: { r2: Date.now() } };
    expect(mergeStates(a, b).routineLog).toEqual({ r1: { [day(-1)]: [0], [TODAY]: [0] } });
  });
});

describe('numbers from the history', () => {
  it('counts due days, streaks and an unfinished today', () => {
    const log = { [day(-3)]: [0], [day(-2)]: [0], [day(-1)]: [0], [day(-5)]: [0] };
    const s = routineStats(daily(), log, TODAY);
    expect(s.total).toBe(4);
    expect(s.streak).toBe(3); // today is not over, so it does not break the run
    expect(s.best).toBe(3);
    expect(s.last30).toEqual({ done: 4, due: 21 }); // started 20 days ago, today included
  });

  it('weekly routines only count their days; missed times show as part days', () => {
    const r: Routine = { ...daily(['08:00', '20:00']), kind: 'weekly', weekdays: [1, 4] };
    const log = { [day(-3)]: [0, 1], [TODAY]: [1] }; // Monday both, Thursday one
    expect(cellFor(r, log, day(-1), TODAY)).toEqual({ day: day(-1), due: 0, done: 0, future: false });
    expect(cellFor(r, log, TODAY, TODAY)).toEqual({ day: TODAY, due: 2, done: 1, future: false });
    const s = routineStats(r, log, TODAY, 1);
    expect(s.thisWeek).toEqual({ done: 3, due: 4 });
    expect(s.slots.map((x) => x.done)).toEqual([1, 2]);
    expect(s.heat).toHaveLength(16 * 7);
    expect(fromKey(s.heat[0].day).getDay()).toBe(1);
    expect(s.recent[0]).toEqual({ day: TODAY, slots: [null, 'done'] });
  });

  it('the summary adds up every routine this week', () => {
    const r2: Routine = { ...daily(), id: 'r2', start: TODAY };
    const w = allRoutinesWeek([daily(), r2], { r1: { [TODAY]: [0] } }, TODAY, 1);
    expect(w.days).toHaveLength(7);
    expect(w).toMatchObject({ done: 1, due: 5 }); // Mon–Thu for r1, today for r2
    expect(lastDays(daily(), {}, TODAY)).toHaveLength(14);
  });
});

describe('Not done (3.6)', () => {
  it('marks a routine task not done: recorded, off the matrix, and the next time still comes', () => {
    const r = store.addRoutine({ title: 'Water', quadrant: 1, kind: 'daily', times: ['00:00', '23:59'], remind: false });
    const task = store.getState().tasks.find((t) => t.routineId === r.id)!;
    store.toggleTask(task.id);
    const blooms = store.getState().bloomCount;
    store.markNotDone(task.id);
    const s = store.getState();
    expect(s.tasks.some((t) => t.id === task.id)).toBe(false);
    expect(s.routineMissed[r.id]).toEqual({ [task.due!]: [0] });
    expect(s.routineLog[r.id]).toEqual({}); // no longer counted as done
    expect(s.bloomCount).toBeLessThan(blooms); // its flower went back
    expect(store.slotMark(s, r.id, task.due!, 0)).toBe('missed');
    // Later the evening time arrives as usual.
    const evening = new Date();
    evening.setHours(23, 59, 30);
    store.ensureRoutines(evening);
    expect(store.getState().tasks.filter((t) => t.routineId === r.id).map((t) => t.slot)).toEqual([1]);
  });

  it('the routine page cycles a past time: done, not done, no answer', () => {
    store.replaceState({ onboarded: true, routines: [daily()] });
    store.setSlotMark('r1', day(-2), 0, 'done');
    expect(store.slotMark(store.getState(), 'r1', day(-2), 0)).toBe('done');
    store.setSlotMark('r1', day(-2), 0, 'missed');
    expect(store.getState().routineLog.r1[day(-2)]).toBeUndefined();
    expect(store.slotMark(store.getState(), 'r1', day(-2), 0)).toBe('missed');
    store.setSlotMark('r1', day(-2), 0, null);
    expect(store.slotMark(store.getState(), 'r1', day(-2), 0)).toBeNull();
  });

  it('ticking a time done clears an earlier Not done for it', () => {
    const r = store.addRoutine({ title: 'Read', quadrant: 2, kind: 'daily', times: ['00:00'], remind: false });
    const task = store.getState().tasks.find((t) => t.routineId === r.id)!;
    store.setSlotMark(r.id, task.due!, 0, 'missed');
    expect(store.getState().tasks.some((t) => t.id === task.id)).toBe(false);
    store.setSlotMark(r.id, task.due!, 0, 'done');
    expect(store.slotMark(store.getState(), r.id, task.due!, 0)).toBe('done');
  });

  it('stats count Not done and show it in recent days', () => {
    const s = routineStats(daily(['08:00', '20:00']), { [day(-1)]: [0] }, TODAY, 1, 16, { [day(-1)]: [1], [day(-3)]: [0, 1] });
    expect(s.notDone30).toBe(3);
    expect(s.recent[1]).toEqual({ day: day(-1), slots: ['done', 'missed'] });
  });

  it('a damaged Not done record is cleaned like the history', () => {
    expect(sanitise({ routineMissed: { r1: { [TODAY]: [1, 9] } } }).routineMissed).toEqual({ r1: { [TODAY]: [1] } });
  });
});
