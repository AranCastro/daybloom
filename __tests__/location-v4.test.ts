/** 4.0: background location lookups never pop up a system dialog and back off after a failure. */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  return {
    readItem: (k: string) => mem.get(k) ?? null,
    writeItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});
jest.mock('@/lib/app-lock', () => ({ expectReturn: jest.fn() }));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

import * as Location from 'expo-location';

import { expectReturn } from '@/lib/app-lock';
import { currentCoords, RETRY_MS } from '@/lib/places';
import { refreshWeather } from '@/lib/weather';

const loc = jest.mocked(Location);
const granted = { granted: true, canAskAgain: true, status: 'granted' } as never;
const notYet = { granted: false, canAskAgain: true, status: 'undetermined' } as never;
const refused = { granted: false, canAskAgain: false, status: 'denied' } as never;
const here = { coords: { latitude: 12.97, longitude: 77.59 } } as never;

let clock = 1_900_000_000_000;
beforeEach(() => {
  jest.clearAllMocks();
  // Each test starts well after any earlier back-off.
  clock += 2 * RETRY_MS;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  loc.getForegroundPermissionsAsync.mockResolvedValue(granted);
  loc.requestForegroundPermissionsAsync.mockResolvedValue(granted);
  loc.getLastKnownPositionAsync.mockResolvedValue(null);
  loc.hasServicesEnabledAsync.mockResolvedValue(true);
  loc.getCurrentPositionAsync.mockResolvedValue(here);
});

describe('lookups nobody asked for', () => {
  it('never offer the "Turn on location" dialog', async () => {
    expect(await currentCoords(false)).toEqual({ lat: 12.97, lon: 77.59 });
    expect(loc.getCurrentPositionAsync).toHaveBeenCalledWith(expect.objectContaining({ mayShowUserSettingsDialog: false }));
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(expectReturn).not.toHaveBeenCalled();
  });

  it('give up quietly with location off, and wait 30 minutes before trying again', async () => {
    loc.hasServicesEnabledAsync.mockResolvedValue(false);
    expect(await currentCoords(false)).toBeNull();
    expect(loc.getCurrentPositionAsync).not.toHaveBeenCalled();
    clock += 10 * 60_000;
    expect(await currentCoords(false)).toBeNull();
    expect(loc.hasServicesEnabledAsync).toHaveBeenCalledTimes(1);
    clock += RETRY_MS;
    loc.hasServicesEnabledAsync.mockResolvedValue(true);
    expect(await currentCoords(false)).not.toBeNull();
  });

  it('back off after a failed fix too', async () => {
    loc.getCurrentPositionAsync.mockRejectedValue(new Error('no fix'));
    expect(await currentCoords(false)).toBeNull();
    expect(await currentCoords(false)).toBeNull();
    expect(loc.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it('the garden weather does not ask for a position again while backing off', async () => {
    const fetch = jest.fn();
    globalThis.fetch = fetch as never;
    loc.hasServicesEnabledAsync.mockResolvedValue(false);
    await refreshWeather(false);
    await refreshWeather(false);
    expect(loc.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('when the user asks', () => {
  it('ignores the back-off and may offer to turn location on', async () => {
    loc.hasServicesEnabledAsync.mockResolvedValue(false);
    await currentCoords(false);
    expect(await currentCoords(true)).not.toBeNull();
    expect(loc.getCurrentPositionAsync).toHaveBeenCalledWith(expect.objectContaining({ mayShowUserSettingsDialog: true }));
    // The settings dialog briefly leaves the app.
    expect(expectReturn).toHaveBeenCalledTimes(1);
  });

  it('tells the lock to expect a return only when a dialog will really show', async () => {
    await currentCoords(true);
    expect(expectReturn).not.toHaveBeenCalled();
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();

    loc.getForegroundPermissionsAsync.mockResolvedValue(refused);
    expect(await currentCoords(true)).toBeNull();
    expect(expectReturn).not.toHaveBeenCalled();
    expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();

    loc.getForegroundPermissionsAsync.mockResolvedValue(notYet);
    expect(await currentCoords(true)).not.toBeNull();
    expect(expectReturn).toHaveBeenCalledTimes(1);
    expect(loc.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});
