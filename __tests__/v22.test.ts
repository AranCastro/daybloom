/** Version 2.2: patterns, energy check and easy tasks, check-in from the reminder, weather that follows the phone. */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  return {
    readItem: (k: string) => mem.get(k) ?? null,
    writeItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});
const here = { lat: 9.93, lon: 76.27 };
jest.mock('@/lib/places', () => {
  const actual = jest.requireActual<typeof import('@/lib/places')>('@/lib/places');
  return { ...actual, currentCoords: jest.fn(async () => ({ ...here })) };
});
jest.mock('expo-location', () => ({}));
jest.mock('expo-notifications', () => ({
  dismissNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
}));

import { addDays, dayKey, fromKey } from '@/lib/dates';
import { deepFirst, fitEnergy } from '@/lib/effort';
import { handleCheckinAction } from '@/lib/notification-checkin';
import { findPatterns, MIN_DAYS } from '@/lib/patterns';
import * as store from '@/lib/store';
import { refreshWeather } from '@/lib/weather';

const TODAY = '2026-09-27'; // a Sunday
const back = (n: number) => dayKey(addDays(fromKey(TODAY), -n));

function reset() {
  store.replaceState({ onboarded: true });
}

describe('patterns', () => {
  beforeEach(reset);

  it('needs two weeks of check-ins before saying anything', () => {
    const checkins: Record<string, 1 | 2 | 3 | 4 | 5> = {};
    for (let i = 0; i < MIN_DAYS - 1; i++) checkins[back(i)] = 3;
    store.update({ checkins });
    expect(findPatterns(store.getState(), TODAY)).toEqual([]);
  });

  it('notices heavier Mondays and better days with a call', () => {
    const checkins: Record<string, 1 | 2 | 3 | 4 | 5> = {};
    const garden: store.Bloom[] = [];
    for (let i = 0; i < 42; i++) {
      const d = back(i);
      const monday = fromKey(d).getDay() === 1;
      const called = i % 4 === 0 && !monday;
      checkins[d] = monday ? 2 : called ? 5 : 3;
      if (called) garden.push({ id: `r${i}`, at: fromKey(d).getTime() + 12 * 3600_000, flower: 'marigold', source: 'reach' });
    }
    store.update({ checkins, garden });
    const ids = findPatterns(store.getState(), TODAY).map((p) => p.id);
    expect(ids).toContain('weekday-low');
    expect(ids).toContain('reach');
    const monday = findPatterns(store.getState(), TODAY).find((p) => p.id === 'weekday-low')!;
    expect(monday.title).toBe('Your Mondays are often heavier');
  });

  it('notices fewer focus sessions on Tension days', () => {
    const checkins: Record<string, 1 | 2 | 3 | 4 | 5> = {};
    const moodTags: Record<string, string[]> = {};
    const sessions: store.AppState['focus']['sessions'] = [];
    for (let i = 0; i < 30; i++) {
      const d = back(i);
      checkins[d] = 3;
      if (i % 5 === 0) moodTags[d] = ['tension'];
      else for (let k = 0; k < 2; k++) sessions.push({ at: fromKey(d).getTime() + (9 + k) * 3600_000, minutes: 25, flower: 'marigold' });
    }
    store.update({ checkins, moodTags, focus: { sessions, active: null } });
    const p = findPatterns(store.getState(), TODAY).find((x) => x.id === 'tag-focus');
    expect(p?.title).toBe('Tension days had fewer focus sessions');
  });
});

describe('energy and effort levels', () => {
  beforeEach(reset);

  it('records energy and clears it on a second tap', () => {
    store.setEnergy(TODAY, 1);
    expect(store.getState().energy[TODAY]).toBe(1);
    store.setEnergy(TODAY, 1);
    expect(store.getState().energy[TODAY]).toBeUndefined();
  });

  it('sets an effort level on add and edit', () => {
    store.addTask('Reply to email', 1, undefined, 'quick');
    const t = store.getState().tasks.find((x) => x.title === 'Reply to email')!;
    expect(t.effort).toBe('quick');
    store.editTask(t.id, { effort: 'deep' });
    expect(store.getState().tasks.find((x) => x.id === t.id)?.effort).toBe('deep');
  });

  it('energy decides which effort levels show', () => {
    const mk = (effort: store.Task['effort'], done = false) => ({ effort, done });
    const all = [mk('quick'), mk('light'), mk('moderate'), mk('deep'), mk(undefined), mk('deep', true)];
    expect(fitEnergy(all, 1).map((t) => t.effort)).toEqual(['quick', 'deep']); // Quick, plus the finished deep task
    expect(fitEnergy(all, 2).map((t) => t.effort)).toEqual(['quick', 'light', 'moderate', undefined, 'deep']);
    expect(fitEnergy(all, 3)).toHaveLength(6);
    expect(fitEnergy(all, undefined)).toHaveLength(6);
    expect(deepFirst([mk('quick'), mk('deep'), mk(undefined)]).map((t) => t.effort)).toEqual(['deep', undefined, 'quick']);
  });

  it('turns the old "Quick and easy" flag into the Quick level', () => {
    store.replaceState({ onboarded: true, tasks: [{ id: 'x', title: 'Old', quadrant: 1, done: false, createdAt: 1, easy: true } as never] });
    const t = store.getState().tasks[0] as store.Task & { easy?: boolean };
    expect(t.effort).toBe('quick');
    expect(t.easy).toBeUndefined();
  });
});

describe('check-in from the reminder', () => {
  beforeEach(reset);

  it('a mood button records the mood, dismisses the reminder and confirms', async () => {
    const n = jest.requireMock('expo-notifications') as { dismissNotificationAsync: jest.Mock; scheduleNotificationAsync: jest.Mock };
    expect(await handleCheckinAction('mood-4', 'daily-checkin')).toBe(true);
    expect(store.getState().checkins[dayKey()]).toBe(4);
    expect(n.dismissNotificationAsync).toHaveBeenCalledWith('daily-checkin');
    expect(n.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('ignores other actions (a plain tap on the reminder)', async () => {
    expect(await handleCheckinAction('expo.modules.notifications.actions.DEFAULT')).toBe(false);
  });
});

describe('weather follows the phone', () => {
  it('fetches again after moving to another town, not when staying put', async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ current: { temperature_2m: 27.4, weather_code: 63, is_day: 1 } }) }));
    (globalThis as { fetch: unknown }).fetch = fetchMock;
    await refreshWeather(false);
    await refreshWeather(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('latitude=9.9&longitude=76.3');
    here.lat = 10.53; // Thrissur
    await refreshWeather(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
