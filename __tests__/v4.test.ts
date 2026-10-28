/** 4.0: routines, reminders, history and saving: fixes from the audit. */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  return {
    readItem: (k: string) => mem.get(k) ?? null,
    writeItem: jest.fn((k: string, v: string) => void mem.set(k, v)),
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
import { handleCheckinAction, handleRoutineAction } from '@/lib/notification-checkin';
import { isLowStreak } from '@/lib/nudge-rule';
import { ROUTINE_DONE, ROUTINE_NOT_DONE, syncRoutineReminders } from '@/lib/reminders';
import { answeredIn, instanceId, reminderId, Routine } from '@/lib/routines';
import { routineStats } from '@/lib/routine-stats';
import { sanitise } from '@/lib/sanitise';
import * as store from '@/lib/store';

const TODAY = dayKey();
const day = (n: number) => dayKey(addDays(fromKey(TODAY), n));
const n = jest.requireMock('expo-notifications') as Record<string, jest.Mock>;
const scheduledIds = () => n.scheduleNotificationAsync.mock.calls.map((c) => (c[0] as { identifier: string }).identifier);
/** A time later today, so a routine's second time has come. */
const at = (h: number, m = 0) => {
  const d = fromKey(TODAY);
  d.setHours(h, m, 0, 0);
  return d;
};

beforeEach(() => {
  store.replaceState({ onboarded: true });
  jest.clearAllMocks();
});

describe('reminder presses after their task has gone', () => {
  it('Done on the morning reminder, pressed after the afternoon task took over, is still recorded', async () => {
    const r = store.addRoutine({ title: 'Tablets', quadrant: 1, kind: 'daily', times: ['00:00', '00:01'], remind: true });
    store.ensureRoutines(at(23, 59)); // the second time has replaced the first task
    const morning = instanceId(r.id, TODAY, 0);
    expect(store.getState().tasks.some((t) => t.id === morning)).toBe(false);
    expect(await handleRoutineAction(ROUTINE_DONE, reminderId(morning), 201)).toBe(true);
    expect(store.getState().routineLog[r.id][TODAY]).toContain(0);
  });

  it('Not done on yesterday’s reminder after midnight is recorded for yesterday', async () => {
    const r = store.addRoutine({ title: 'Walk', quadrant: 2, kind: 'daily', times: ['21:00'], remind: true, start: day(-1) });
    const last = instanceId(r.id, day(-1), 0);
    expect(await handleRoutineAction(ROUTINE_NOT_DONE, reminderId(last), 202)).toBe(true);
    expect(store.getState().routineMissed[r.id][day(-1)]).toEqual([0]);
  });
});

describe('reminders leave out times already answered', () => {
  it('no reminder for a time marked Not done, ticked on the routine page, or a skipped day', async () => {
    const r = store.addRoutine({ title: 'Water', quadrant: 1, kind: 'daily', times: ['22:00', '23:00'], remind: true });
    store.setSlotMark(r.id, day(1), 0, 'done');
    store.setSlotMark(r.id, day(1), 1, 'missed');
    const s = store.getState();
    await syncRoutineReminders(s.routines, s.tasks, false, at(0, 1), answeredIn(s));
    const ids = scheduledIds();
    expect(ids).not.toContain(reminderId(instanceId(r.id, day(1), 0)));
    expect(ids).not.toContain(reminderId(instanceId(r.id, day(1), 1)));
    expect(ids).toContain(reminderId(instanceId(r.id, day(2), 0)));
    // Skip today: none of today's times.
    const skip = answeredIn({ ...s, routineMade: { [r.id]: `${TODAY}#9` } });
    expect(skip(r.id, TODAY, 1)).toBe(true);
  });
});

describe('editing a routine', () => {
  it('a time already done today moves with its time when an earlier time is added', () => {
    const r = store.addRoutine({ title: 'Stretch', quadrant: 2, kind: 'daily', times: ['00:01'], remind: false });
    store.ensureRoutines(at(12));
    const id = store.getState().tasks.find((t) => t.routineId === r.id)!.id;
    store.toggleTask(id);
    store.editRoutine(r.id, { times: ['00:00', '00:01'] });
    store.ensureRoutines(at(12));
    const s = store.getState();
    expect(s.routineLog[r.id][TODAY]).toEqual([1]);
    const mine = s.tasks.filter((t) => t.routineId === r.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ done: true, slot: 1, id: instanceId(r.id, TODAY, 1) });
  });

  it('a time marked Not done is not brought back by an edit', () => {
    const r = store.addRoutine({ title: 'Read', quadrant: 2, kind: 'daily', times: ['00:00'], remind: false });
    store.markNotDone(store.getState().tasks.find((t) => t.routineId === r.id)!.id);
    store.editRoutine(r.id, { quadrant: 3, times: ['00:00', '23:59'] });
    store.ensureRoutines(at(0, 5));
    expect(store.getState().tasks.some((t) => t.routineId === r.id)).toBe(false);
  });

  it('past days keep the schedule they had: adding a weekday does not break the streak', () => {
    const r: Routine = { id: 'w', title: 'Gym', quadrant: 2, kind: 'weekly', weekdays: [fromKey(TODAY).getDay()], start: day(-28), times: ['07:00'], remind: false, createdAt: 0 };
    const log = Object.fromEntries([-28, -21, -14, -7].map((d) => [day(d), [0]]));
    const before = routineStats(r, log, TODAY);
    const edited: Routine = { ...r, weekdays: [0, 1, 2, 3, 4, 5, 6], start: TODAY, past: [{ kind: 'weekly', weekdays: r.weekdays, start: r.start, times: r.times, until: day(-1) }] };
    const after = routineStats(edited, log, TODAY);
    expect(after.best).toBe(before.best);
    expect(after.streak).toBe(before.streak);
  });

  it('the store keeps the old schedule when the times change', () => {
    const r = store.addRoutine({ title: 'Meds', quadrant: 1, kind: 'daily', times: ['08:00'], remind: false, start: day(-10) });
    store.editRoutine(r.id, { times: ['08:00', '20:00'] });
    const now = store.getRoutine(r.id)!;
    expect(now.start).toBe(TODAY);
    expect(now.past).toEqual([{ kind: 'daily', start: day(-10), until: day(-1), times: ['08:00'], every: undefined, weekdays: undefined }]);
    // And it survives a backup round trip.
    const back = sanitise(JSON.parse(JSON.stringify({ routines: store.getState().routines }))).routines!;
    expect(back[0].past).toEqual([{ kind: 'daily', start: day(-10), until: day(-1), times: ['08:00'] }]);
  });
});

describe('saving', () => {
  it('a reload never throws away edits that could not be saved', () => {
    const kv = jest.requireMock('@/lib/kv') as { writeItem: jest.Mock };
    kv.writeItem.mockImplementation(() => {
      throw new Error('disk full');
    });
    store.update({ name: 'Unsaved' });
    store.reloadState(); // a widget tap or reminder button
    expect(store.getState().name).toBe('Unsaved');
    kv.writeItem.mockReset();
  });
});

describe('nudge and late check-ins', () => {
  it('a check-in dated in the future does not switch the low-mood nudge off', () => {
    expect(isLowStreak({ [day(-2)]: 1, [day(-1)]: 2, [TODAY]: 1, [day(3)]: 5 }, 3, TODAY)).toBe(true);
  });

  it('a mood tapped on last night’s reminder just after midnight counts for last night', async () => {
    const tonight = fromKey(day(1));
    tonight.setHours(0, 20, 0, 0);
    jest.useFakeTimers({ now: tonight, doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
    try {
      const sentAt = tonight.getTime() - 60 * 60_000; // 23:20 the evening before
      await handleCheckinAction('mood-4', 'daily-checkin', sentAt);
      expect(store.getState().checkins[TODAY]).toBe(4);
      expect(store.getState().checkins[day(1)]).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });
});
