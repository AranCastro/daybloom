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
import { ROUTINE_DONE, syncRoutineReminders } from '@/lib/reminders';
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
  it('a daily routine three times a day adds three tasks today, in its quadrant, with its effort', () => {
    const r = store.addRoutine({ title: 'Take medicine', quadrant: 1, effort: 'quick', kind: 'daily', times: ['20:00', '08:00', '13:00'], remind: true });
    const tasks = routineTasks(r.id);
    expect(tasks.map((t) => t.at)).toEqual(['08:00', '13:00', '20:00']);
    expect(tasks.every((t) => t.quadrant === 1 && t.effort === 'quick' && t.due === TODAY)).toBe(true);
    // Calling again the same day adds nothing more.
    expect(store.ensureRoutines()).toBe(false);
    expect(routineTasks(r.id)).toHaveLength(3);
  });

  it('a task skipped today does not come back until the next day', () => {
    const r = store.addRoutine({ title: 'Walk', quadrant: 2, kind: 'daily', times: ['07:00'], remind: false });
    store.deleteTask(instanceId(r.id, TODAY, 0));
    store.ensureRoutines();
    expect(routineTasks(r.id)).toHaveLength(0);
    store.ensureRoutines(day(1));
    expect(routineTasks(r.id).map((t) => t.id)).toEqual([instanceId(r.id, day(1), 0)]);
  });

  it('the next day: unfinished ones go, finished ones are cleared with their shading kept', () => {
    const r = store.addRoutine({ title: 'Water plants', quadrant: 2, kind: 'daily', times: ['08:00', '19:00'], remind: false });
    store.toggleTask(instanceId(r.id, TODAY, 0));
    const blooms = store.getState().bloomCount;
    store.ensureRoutines(day(1));
    const ids = routineTasks(r.id).map((t) => t.id);
    expect(ids).toEqual([instanceId(r.id, day(1), 0), instanceId(r.id, day(1), 1)]);
    expect(store.getState().clearedWork[TODAY]).toBe(1);
    expect(store.getState().bloomCount).toBe(blooms); // the flower stays
  });

  it('weekly: nothing on other days', () => {
    const notToday = (fromKey(TODAY).getDay() + 1) % 7;
    const r = store.addRoutine({ title: 'Clean desk', quadrant: 3, kind: 'weekly', weekdays: [notToday], times: ['10:00'], remind: false });
    expect(routineTasks(r.id)).toHaveLength(0);
    store.ensureRoutines(day(1));
    expect(routineTasks(r.id)).toHaveLength(1);
  });

  it('editing follows through to today’s unfinished tasks; a new time re-adds them', () => {
    const r = store.addRoutine({ title: 'Stretch', quadrant: 2, kind: 'daily', times: ['08:00', '18:00'], remind: false });
    store.toggleTask(instanceId(r.id, TODAY, 0));
    store.editRoutine(r.id, { title: 'Stretch 10 min', quadrant: 1 });
    const open = routineTasks(r.id).filter((t) => !t.done);
    expect(open.map((t) => [t.title, t.quadrant])).toEqual([['Stretch 10 min', 1]]);
    store.editRoutine(r.id, { times: ['08:00', '17:30'] });
    const now = routineTasks(r.id);
    expect(now.find((t) => t.slot === 0)?.done).toBe(true); // finished stays finished
    expect(now.find((t) => t.slot === 1)?.at).toBe('17:30');
  });

  it('stopping a routine keeps finished tasks and can remove today’s open ones', () => {
    const r = store.addRoutine({ title: 'Read', quadrant: 2, kind: 'daily', times: ['08:00', '21:00'], remind: false });
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
  });
});

describe('gentle reminders', () => {
  it('schedules one quiet reminder per future time for the week, skipping finished ones', async () => {
    const n = jest.requireMock('expo-notifications') as Record<string, jest.Mock>;
    const r = store.addRoutine({ title: 'Medicine', quadrant: 1, kind: 'daily', times: ['08:00', '20:00'], remind: true });
    const now = fromKey(TODAY);
    now.setHours(12, 0, 0, 0);
    store.toggleTask(instanceId(r.id, TODAY, 1)); // evening dose already taken
    await syncRoutineReminders(store.getState().routines, store.getState().tasks, false, now);
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
    const r = store.addRoutine({ title: 'Walk', quadrant: 2, kind: 'daily', times: ['07:00'], remind: true });
    const id = instanceId(r.id, TODAY, 0);
    const blooms = store.getState().bloomCount;
    expect(await handleRoutineAction(ROUTINE_DONE, reminderId(id), 111)).toBe(true);
    expect(store.getState().tasks.find((t) => t.id === id)?.done).toBe(true);
    expect(store.getState().bloomCount).toBe(blooms + 1);
    // The same press arriving again (background task and in-app listener) does nothing.
    expect(await handleRoutineAction(ROUTINE_DONE, reminderId(id), 111)).toBe(false);
    expect(await handleRoutineAction('mood-4', reminderId(id), 112)).toBe(false);
  });
});
