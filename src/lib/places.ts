/**
 * Places for check-ins: names the user chooses (Home, Office, Campus…), optionally pinned with
 * the phone's GPS. Coordinates stay on the phone. Distances use the haversine formula on the
 * WGS 84 sphere approximation (mean Earth radius 6,371 km).
 */
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { expectReturn } from '@/lib/app-lock';
import type { AppState, Place } from '@/lib/store';

export const PLACE_EMOJI = ['🏠', '🏢', '🎓', '👪', '☕', '🌳', '🛕', '🚆', '🏥', '🏖️', '💪', '📚'] as const;

export const PLACE_IDEAS = [
  { name: 'Home', emoji: '🏠' },
  { name: 'Office', emoji: '🏢' },
  { name: 'Campus', emoji: '🎓' },
  { name: "Parents' house", emoji: '👪' },
];

export type Coords = { lat: number; lon: number };

/** Great-circle distance in metres. */
export function distanceM(a: Coords, b: Coords): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The pinned place within `radius` metres of here, nearest first. */
export function nearestPlace(places: Place[], here: Coords, radius = 400): Place | null {
  let best: { p: Place; d: number } | null = null;
  for (const p of places) {
    if (p.lat === undefined || p.lon === undefined) continue;
    const d = distanceM(here, { lat: p.lat, lon: p.lon });
    if (d <= radius && (!best || d < best.d)) best = { p, d };
  }
  return best?.p ?? null;
}

/** After a lookup nobody asked for fails (location off, no fix), the next ones wait this long. */
export const RETRY_MS = 30 * 60_000;
let failedAt = 0;

/**
 * The phone's position, asking for permission if `ask` is true. Null when refused or unavailable.
 * `cheap` only uses a recent position the phone already has, never waiting for a new fix.
 * Without `ask` (the garden's weather, the place suggestion) no system dialog ever shows, not even
 * Android's "Turn on location", and after a failure there is no new try for 30 minutes.
 */
export async function currentCoords(ask: boolean, cheap = false): Promise<Coords | null> {
  if (!ask && Date.now() - failedAt < RETRY_MS) return null;
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && ask && perm.canAskAgain) {
      // The permission dialog briefly leaves the app (the app lock should not ask again on return).
      expectReturn();
      perm = await Location.requestForegroundPermissionsAsync();
    }
    if (!perm.granted) return null;
    const last = Platform.OS === 'web' ? null : await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 });
    if (!last && cheap) return null;
    if (!last && Platform.OS !== 'web' && !(await Location.hasServicesEnabledAsync())) {
      if (!ask) {
        failedAt = Date.now();
        return null;
      }
      // Asked for: Android offers to turn location on, in a dialog that briefly leaves the app.
      expectReturn();
    }
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: ask }));
    failedAt = 0;
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch {
    if (!ask) failedAt = Date.now();
    return null;
  }
}

export type PlaceStats = { place: Place; days: number; avg: number | null; best: number; top: string | null };

/** How each place feels: days checked in there, average mood (1–5) and the most used feeling tag. */
export function placeStats(s: Pick<AppState, 'places' | 'checkinPlace' | 'checkins' | 'moodTags'>, sinceDay?: string): PlaceStats[] {
  return s.places
    .map((place) => {
      const days = Object.entries(s.checkinPlace)
        .filter(([d, id]) => id === place.id && (!sinceDay || d >= sinceDay) && s.checkins[d] !== undefined)
        .map(([d]) => d);
      const moods = days.map((d) => s.checkins[d]);
      const tags = new Map<string, number>();
      for (const d of days) for (const t of s.moodTags[d] ?? []) tags.set(t, (tags.get(t) ?? 0) + 1);
      const top = [...tags.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        place,
        days: days.length,
        avg: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null,
        best: moods.filter((m) => m >= 4).length,
        top,
      };
    })
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0) || b.days - a.days);
}
