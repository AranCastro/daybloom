/** Version 2.1: jar of good days, places, garden weather and seasons, Thottam. */
import { describe, expect, it, jest } from '@jest/globals';
jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  return {
    readItem: (k: string) => mem.get(k) ?? null,
    writeItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});
jest.mock('expo-location', () => ({}));

import { distanceM, nearestPlace, placeStats } from '@/lib/places';
import * as store from '@/lib/store';
import { festivalNear, surprise } from '@/lib/thottam';
import { checkInLine, phaseOf, seasonOf, skyOf } from '@/lib/weather';

describe('jar of good days', () => {
  it('keeps one trimmed line per day and removes an empty one', () => {
    store.setGoodNote('2026-09-20', '  Finished the field report  ');
    expect(store.getState().goodNotes['2026-09-20']).toBe('Finished the field report');
    store.setGoodNote('2026-09-20', '   ');
    expect(store.getState().goodNotes['2026-09-20']).toBeUndefined();
  });
});

describe('places', () => {
  it('measures distance on the sphere (Kochi to Thrissur is about 65–80 km)', () => {
    const d = distanceM({ lat: 9.9312, lon: 76.2673 }, { lat: 10.5276, lon: 76.2144 });
    expect(d).toBeGreaterThan(65_000);
    expect(d).toBeLessThan(80_000);
  });

  it('suggests the pinned place within 400 m, and none when farther', () => {
    const home = { id: 'h', name: 'Home', emoji: '🏠', lat: 9.9312, lon: 76.2673, createdAt: 0 };
    const office = { id: 'o', name: 'Office', emoji: '🏢', lat: 9.99, lon: 76.3, createdAt: 0 };
    expect(nearestPlace([home, office], { lat: 9.9322, lon: 76.2673 })?.id).toBe('h');
    expect(nearestPlace([home, office], { lat: 10.2, lon: 76.2 })).toBeNull();
  });

  it('ranks places by average mood and counts days and tags', () => {
    const home = store.addPlace('Home', '🏠');
    const office = store.addPlace('Office', '🏢');
    store.update({
      checkins: { '2026-09-01': 5, '2026-09-02': 4, '2026-09-03': 2 },
      moodTags: { '2026-09-01': ['happy'], '2026-09-02': ['happy'], '2026-09-03': ['tension'] },
    });
    store.setCheckinPlace('2026-09-01', home.id);
    store.setCheckinPlace('2026-09-02', home.id);
    store.setCheckinPlace('2026-09-03', office.id);
    const stats = placeStats(store.getState());
    expect(stats[0].place.id).toBe(home.id);
    expect(stats[0].days).toBe(2);
    expect(stats[0].avg).toBe(4.5);
    expect(stats[0].top).toBe('happy');
    expect(stats[1].top).toBe('tension');
    // Tapping the chosen place again clears it; deleting a place clears its tags.
    store.setCheckinPlace('2026-09-03', office.id);
    expect(store.getState().checkinPlace['2026-09-03']).toBeUndefined();
    store.deletePlace(home.id);
    expect(Object.values(store.getState().checkinPlace)).not.toContain(home.id);
  });
});

describe('garden sky', () => {
  it('maps WMO weather codes', () => {
    expect(skyOf(0)).toBe('clear');
    expect(skyOf(3)).toBe('cloudy');
    expect(skyOf(45)).toBe('fog');
    expect(skyOf(53)).toBe('drizzle');
    expect(skyOf(63)).toBe('rain');
    expect(skyOf(81)).toBe('rain');
    expect(skyOf(95)).toBe('storm');
  });

  it('knows the time of day and the Indian seasons', () => {
    expect(phaseOf(6)).toBe('dawn');
    expect(phaseOf(12)).toBe('day');
    expect(phaseOf(18)).toBe('dusk');
    expect(phaseOf(23)).toBe('night');
    expect(seasonOf(6)).toBe('monsoon'); // July
    expect(seasonOf(3)).toBe('summer'); // April
    expect(seasonOf(0)).toBe('winter'); // January
    expect(checkInLine('monsoon')).toMatch(/Monsoon/);
    expect(checkInLine('winter', 'rain')).toMatch(/Rain/);
  });
});

describe('Thottam', () => {
  it('finds the festival season around a date', () => {
    expect(festivalNear(new Date(2026, 7, 26))).toBe('onam');
    expect(festivalNear(new Date(2026, 10, 8))).toBe('diwali');
    expect(festivalNear(new Date(2027, 0, 14))).toBe('pongal');
    expect(festivalNear(new Date(2026, 5, 1))).toBeNull();
  });

  it('makes surprise designs only from flowers already grown', () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const d = surprise(['jasmine', 'marigold'], 'onam', rand);
    expect(d.rings.length).toBeGreaterThanOrEqual(3);
    for (const f of [d.center, ...d.rings.map((r) => r.flower)]) expect(['jasmine', 'marigold']).toContain(f);
  });

  it('saves, updates and deletes designs', () => {
    const p = store.savePookalam({ name: 'Thiruvonam', center: 'marigold', rings: [{ flower: 'jasmine', pattern: 'petals' }], festival: 'onam' });
    store.savePookalam({ ...p, name: 'Thiruvonam 2026' });
    expect(store.getState().pookalams.filter((x) => x.id === p.id)).toHaveLength(1);
    expect(store.getState().pookalams[0].name).toBe('Thiruvonam 2026');
    store.deletePookalam(p.id);
    expect(store.getState().pookalams.find((x) => x.id === p.id)).toBeUndefined();
  });

  it('older backups without the new fields still load', () => {
    store.replaceState({ onboarded: true });
    const s = store.getState();
    expect(s.goodNotes).toEqual({});
    expect(s.places).toEqual([]);
    expect(s.pookalams).toEqual([]);
    expect(s.settings.liveWeather).toBe(false);
  });
});
