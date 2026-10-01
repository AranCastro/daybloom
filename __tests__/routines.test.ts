/** Routine tasks: every day, weekly, every few days, up to three times a day, with quiet reminders. */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  return {
    readItem: (k: string) => mem.get(k) ?? null,
    writeItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});
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
  getAllScheduledNotificationsAsync: jest.fn(async () => [{ identifier: 'routine:old:2026-01-01:0' }, { identifier: 'daily-checkin' }]),
  getPresentedNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  dismissNotificationAsync: jest.fn(async () => undefined),
}));

import { addDays, dayKey, fromKey } from '@/lib/dates';
import { handleRoutineAction } from '@/lib/notification-checkin';
import { ROUTINE_DONE, ROUTINE_NOT_DONE, syncRoutineReminders } from '@/lib/reminders';
import { fromMinutes, instanceId, normaliseTimes, occursOn, repeatLabel, reminderId, taskIdFromReminder } from '@/lib/routines';
import { sanitise } from '@/lib/sanitise';
import * as store from '@/lib/store';

const TODAY = dayKey();
const day = (n: number) => dayKey(addDays(fromKey(TODAY), n));
const routineTasks = (id: string) => store.getState().tasks.filter((t) => t.routineId === id);

beforeEach(() => {
  store.replaceState({ onboarded: true });
  jest.clearAllMocks();
});

describe('when a routine is due', () => {
  it('every day, weekly on chosen days, every few days from the start', () => {
    const start = '2026-09-27'; // a Sunday
    expect(occursOn({ kind: 'daily', start }, '2026-09-26')).toBe(false);
    expect(occursOn({ kind: 'daily', start }, '2026-10-05')).toBe(true);
    expect(occursOn({ kind: 'weekly', weekdays: [1, 4], start }, '2026-09-28')).toBe(true); // Monday
    expect(occursOn({ kind: 'weekly', weekdays: [1, 4], start }, '2026-09-29')).toBe(false);
    expect(occursOn({ kind: 'interval', every: 3, start }, '2026-09-30')).toBe(true);
    expect(occursOn({ kind: 'interval', every: 3, start }, '2026-10-01')).toBe(false);
  });

  it('labels and times', () => {
    expect(repeatLabel({ kind: 'weekly', weekdays: [4, 1], times: ['08:00'] })).toBe('Weekly on Mon, Thu');
    expect(repeatLabel({ kind: 'daily', times: ['08:00', '20:00'] })).toBe('Every day · twice a day');
    expect(fromMinutes(-30)).toBe('23:30');
    expect(normaliseTimes(['20:00', '08:00', '08:00', 'x', '13:00', '06:00'])).toEqual(['06:00', '08:00', '13:00']);
    expect(taskIdFromReminder(reminderId('r1:2026-09-27:0'))).toBe('r1:2026-09-27:0');
  });
});

describe('routine tasks in the matrix', () => {
  const at = (d: string, hh: number, mm = 0) => {
    const x = fromKey(d);
    x.setHours(hh, mm, 0, 0);
    return x;
  };

  it('three times a day shows one task at a time; each new time replaces the earlier one', () => {
    // Tomorrow, so the day runs forward from morning (adding it runs today's check at the real time).
    const D = day(1);
    const r = store.addRoutine({ title: 'Affirmations', quadrant: 2, effort: 'quick', kind: 'daily', times: ['20:00', '08:00', '13:00'], remind: true });
    store.ensureRoutines(at(D, 7));
    let mine = routineTasks(r.id);
    expect(mine.map((t) => t.at)).toEqual(['08:00']); // before the first time: the morning one
    expect(mine[0]).toMatchObject({ quadrant: 2, effort: 'quick', due: D });
    expect(store.ensureRoutines(at(D, 9))).toBe(false); // still the morning one
    // Morning one done; at 1 pm it makes way for the afternoon one (its flower stays).
    store.toggleTask(mine[0].id);
    const blooms = store.getState().bloomCount;
    store.ensureRoutines(at(D, 13, 5));
    mine = routineTasks(r.id);
    expect(mine.map((t) => [t.at, t.done])).toEqual([['13:00', false]]);
    expect(store.getState().bloomCount).toBe(blooms);
    expect(store.getState().clearedWork[TODAY]).toBe(1); // shaded on the day it was ticked
    // Afternoon one missed: at 8 pm the evening one replaces it.
    store.ensureRoutines(at(D, 20));
    expect(routineTasks(r.id).map((t) => t.at)).toEqual(['20:00']);
  });

  it('never more than one row, even for data from 3.1 that added all three at once', () => {
    const r = store.addRoutine({ title: 'Water', quadrant: 1, kind: 'daily', times: ['08:00', '13:00', '20:00'], remind: false });
    // As 3.1 left it: all three of today's tasks, and a bare day in routineMade.
    store.update((s) => ({
      routineMade: { ...s.routineMade, [r.id]: TODAY },
      tasks: [
        ...s.tasks.filter((t) => t.routineId !== r.id),
        ...[0, 1, 2].map((slot) => ({ id: `${r.id}:${TODAY}:${slot}`, title: 'Water', quadrant: 1 as const, due: TODAY, done: false, createdAt: 1, routineId: r.id, slot, at: ['08:00', '13:00', '20:00'][slot] })),
      ],
    }));
    store.ensureRoutines(at(TODAY, 14));
    expect(routineTasks(r.id).map((t) => t.at)).toEqual(['13:00']);
  });

  it('skipping today keeps it away for the rest of the day, back tomorrow', () => {
    const r = store.addRoutine({ title: 'Walk', quadrant: 2, kind: 'daily', times: ['07:00', '18:00'], remind: false });
    store.ensureRoutines(at(TODAY, 8));
    store.deleteTask(routineTasks(r.id)[0].id);
    store.ensureRoutines(at(TODAY, 19));
    expect(routineTasks(r.id)).toHaveLength(0);
    store.ensureRoutines(at(day(1), 8));
    expect(routineTasks(r.id).map((t) => t.id)).toEqual([instanceId(r.id, day(1), 0)]);
  });

  it('the next day: an unfinished one goes, a finished one is cleared with its shading kept', () => {
    const r = store.addRoutine({ title: 'Plants', quadrant: 2, kind: 'daily', times: ['08:00'], remind: false });
    store.ensureRoutines(at(TODAY, 9));
    store.toggleTask(instanceId(r.id, TODAY, 0));
    store.ensureRoutines(at(day(1), 9));
    expect(routineTasks(r.id).map((t) => t.id)).toEqual([instanceId(r.id, day(1), 0)]);
    expect(store.getState().clearedWork[TODAY]).toBe(1);
  });

  it('weekly: nothing on other days', () => {
    const notToday = (fromKey(TODAY).getDay() + 1) % 7;
    const r = store.addRoutine({ title: 'Clean desk', quadrant: 3, kind: 'weekly', weekdays: [notToday], times: ['10:00'], remind: false });
    store.ensureRoutines(at(TODAY, 11));
    expect(routineTasks(r.id)).toHaveLength(0);
    store.ensureRoutines(at(day(1), 11));
    expect(routineTasks(r.id)).toHaveLength(1);
  });

  it('editing follows through to today’s task; a finished current one stays finished', () => {
    const r = store.addRoutine({ title: 'Stretch', quadrant: 2, kind: 'daily', times: ['00:00'], remind: false });
    const id = instanceId(r.id, TODAY, 0);
    store.editRoutine(r.id, { title: 'Stretch 10 min', quadrant: 1 });
    expect(routineTasks(r.id).map((t) => [t.title, t.quadrant])).toEqual([['Stretch 10 min', 1]]);
    store.toggleTask(id);
    store.editRoutine(r.id, { kind: 'interval', every: 2 });
    expect(routineTasks(r.id)).toEqual([expect.objectContaining({ id, done: true })]);
  });

  it('stopping a routine keeps a finished task and can remove an open one', () => {
    const r = store.addRoutine({ title: 'Read', quadrant: 2, kind: 'daily', times: ['00:00'], remind: false });
    store.toggleTask(instanceId(r.id, TODAY, 0));
    store.deleteRoutine(r.id, true);
    expect(store.getState().routines).toHaveLength(0);
    const left = store.getState().tasks.filter((t) => t.title === 'Read');
    expect(left).toHaveLength(1);
    expect(left[0].done).toBe(true);
    expect(left[0].routineId).toBeUndefined();
  });

  it('turns a one-time task into a routine', () => {
    const task = store.addTask('Drink water', 1);
    const r = store.makeRoutineFrom(task.id, { title: 'Drink water', quadrant: 1, kind: 'daily', times: ['09:00'], remind: false });
    expect(store.getState().tasks.find((t) => t.id === task.id)).toBeUndefined();
    expect(routineTasks(r.id)).toHaveLength(1);
  });

  it('a damaged routine in a backup is repaired or dropped', () => {
    const out = sanitise({
      routines: [
        { id: 'a', title: 'OK', kind: 'daily', quadrant: 9, times: ['25:00', '07:30'], start: '2026-09-01' },
        { id: 'b', title: 'No days', kind: 'weekly', weekdays: [], times: ['08:00'] },
        { id: 'c', title: 'Bad kind', kind: 'hourly', times: ['08:00'] },
        { id: 'd', title: 'Gap', kind: 'interval', every: 99, times: [] },
      ],
      routineMade: { a: '2026-09-27', b: 'yesterday' },
    });
    expect(out.routines?.map((r) => r.id)).toEqual(['a', 'd']);
    expect(out.routines?.[0]).toMatchObject({ quadrant: 1, times: ['07:30'], remind: true });
    expect(out.routines?.[1]).toMatchObject({ every: 30, times: ['08:00'] });
    expect(out.routineMade).toEqual({ a: '2026-09-27' });
    expect(sanitise({ routineMade: { a: '2026-09-27#2', b: '2026-09-27#x' } }).routineMade).toEqual({ a: '2026-09-27#2' });
  });
});

describe('gentle reminders', () => {
  it('schedules one quiet reminder per future time for the week, skipping finished ones', async () => {
    const n = jest.requireMock('expo-notifications') as Record<string, jest.Mock>;
    const r = store.addRoutine({ title: 'Medicine', quadrant: 1, kind: 'daily', times: ['08:00', '20:00'], remind: true });
    const now = fromKey(TODAY);
    now.setHours(12, 0, 0, 0);
    // The evening dose already taken (early, from its reminder).
    const tasks = [...store.getState().tasks, { id: instanceId(r.id, TODAY, 1), done: true }];
    await syncRoutineReminders(store.getState().routines, tasks, false, now);
    expect(n.cancelScheduledNotificationAsync).toHaveBeenCalledWith('routine:old:2026-01-01:0');
    expect(n.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('daily-checkin');
    const ids = n.scheduleNotificationAsync.mock.calls.map((c) => (c[0] as { identifier: string }).identifier);
    // Today: 08:00 has passed and 20:00 is done, so the first is tomorrow morning; 6 more days × 2.
    expect(ids[0]).toBe(reminderId(instanceId(r.id, day(1), 0)));
    expect(ids).toHaveLength(12);
    expect(ids).not.toContain(reminderId(instanceId(r.id, TODAY, 1)));
  });

  it('nothing is scheduled for routines without a reminder', async () => {
    const n = jest.requireMock('expo-notifications') as Record<string, jest.Mock>;
    store.addRoutine({ title: 'Quiet', quadrant: 2, kind: 'daily', times: ['08:00'], remind: false });
    await syncRoutineReminders(store.getState().routines, store.getState().tasks);
    expect(n.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('Done on the reminder ticks that task and grows its flower, once', async () => {
    const r = store.addRoutine({ title: 'Walk', quadrant: 2, kind: 'daily', times: ['00:00'], remind: true });
    const id = instanceId(r.id, TODAY, 0);
    const blooms = store.getState().bloomCount;
    expect(await handleRoutineAction(ROUTINE_DONE, reminderId(id), 111)).toBe(true);
    expect(store.getState().tasks.find((t) => t.id === id)?.done).toBe(true);
    expect(store.getState().bloomCount).toBe(blooms + 1);
    // The same press arriving again (background task and in-app listener) does nothing.
    expect(await handleRoutineAction(ROUTINE_DONE, reminderId(id), 111)).toBe(false);
    expect(await handleRoutineAction('mood-4', reminderId(id), 112)).toBe(false);
  });

  it('Not done on the reminder records it and takes the task off the matrix', async () => {
    const r = store.addRoutine({ title: 'Stretch', quadrant: 2, kind: 'daily', times: ['00:00'], remind: true });
    const id = instanceId(r.id, TODAY, 0);
    expect(await handleRoutineAction(ROUTINE_NOT_DONE, reminderId(id), 113)).toBe(true);
    expect(store.getState().tasks.some((t) => t.id === id)).toBe(false);
    expect(store.getState().routineMissed[r.id]).toEqual({ [TODAY]: [0] });
  });
});
