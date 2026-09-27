/**
 * The garden's sky: time of day from the phone's clock, the Indian season from the month,
 * and (only if the user turns on "Live weather") the current local weather from Open-Meteo
 * (open-meteo.com, free, no account). Only approximate coordinates are sent: latitude and
 * longitude rounded to 0.1° (about 11 km). The result is cached for 30 minutes, on this phone.
 */
import { useSyncExternalStore } from 'react';

import { readItem, writeItem } from '@/lib/kv';
import { currentCoords } from '@/lib/places';

export type Sky = 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'storm';
export type Phase = 'dawn' | 'day' | 'dusk' | 'night';
export type Season = 'summer' | 'monsoon' | 'autumn' | 'winter';
/** `lat`/`lon` are the rounded grid cell the reading is for, so moving to another town fetches again. */
export type Weather = { sky: Sky; temp: number; isDay: boolean; at: number; lat?: number; lon?: number };

const KEY = 'daybloom.weather.v1';
const FRESH_MS = 30 * 60_000;

/** WMO weather codes, as used by Open-Meteo, grouped into what the garden can draw. */
export function skyOf(code: number): Sky {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

export function phaseOf(hour: number): Phase {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19) return 'dusk';
  return 'night';
}

/** Seasons as commonly described for India: summer Mar–May, south-west monsoon Jun–Sep, post-monsoon Oct–Nov, winter Dec–Feb. */
export function seasonOf(month: number): Season {
  if (month >= 2 && month <= 4) return 'summer';
  if (month >= 5 && month <= 8) return 'monsoon';
  if (month >= 9 && month <= 10) return 'autumn';
  return 'winter';
}

/** The question above the mood orbs, in tune with the season and (if known) the weather. */
export function checkInLine(season: Season, sky?: Sky): string {
  if (sky === 'storm') return 'Thunder outside. Take it slow. How does today feel?';
  if (sky === 'rain' || sky === 'drizzle') return 'Rain outside. One tap is enough.';
  switch (season) {
    case 'monsoon':
      return 'Monsoon days can feel long. One tap, no words needed.';
    case 'summer':
      return 'Warm days. Drink some water. One tap is enough.';
    case 'autumn':
      return 'The rains are easing. One tap, no words needed.';
    default:
      return 'Cool mornings. One tap, no words needed.';
  }
}

function load(): Weather | null {
  try {
    const raw = readItem(KEY);
    const w = raw ? (JSON.parse(raw) as Weather) : null;
    // Weather more than six hours old says nothing about now.
    return w && Date.now() - w.at < 6 * 60 * 60_000 ? w : null;
  } catch {
    return null;
  }
}

let current = load();
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function useWeather(enabled: boolean): Weather | null {
  const w = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => current,
  );
  return enabled ? w : null;
}

/**
 * Keeps the garden's weather in step with where the phone is: fetches when the reading is older
 * than 30 minutes or the phone has moved to another 0.1° cell (about 11 km). `ask` may show the
 * location prompt.
 */
export function refreshWeather(ask = false): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      // A fresh reading only needs to know whether the phone has moved: use a position the phone
      // already has (no new GPS fix, no prompt); without one, keep the reading.
      const fresh = !!current && Date.now() - current.at < FRESH_MS && !ask;
      const here = await currentCoords(ask, fresh);
      if (!here) return;
      const lat = Math.round(here.lat * 10) / 10;
      const lon = Math.round(here.lon * 10) / 10;
      if (fresh && current?.lat === lat && current?.lon === lon) return;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      type Reply = { current?: { temperature_2m?: number; weather_code?: number; is_day?: number } };
      let data: Reply;
      try {
        // The time limit covers reading the body too, which can stall on a poor connection.
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) return;
        data = (await res.json()) as Reply;
      } finally {
        clearTimeout(timer);
      }
      const c = data.current;
      if (!c || typeof c.weather_code !== 'number') return;
      current = { sky: skyOf(c.weather_code), temp: Math.round(c.temperature_2m ?? 0), isDay: c.is_day === 1, at: Date.now(), lat, lon };
      writeItem(KEY, JSON.stringify(current));
      listeners.forEach((l) => l());
    } catch {
      // Offline or refused: the garden simply follows the clock and the season.
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Turns live weather on: asks for location, fetches once. Returns false (and leaves it off) if location is refused. */
export async function enableLiveWeather(setOn: (on: boolean) => void): Promise<boolean> {
  const here = await currentCoords(true);
  if (!here) {
    setOn(false);
    return false;
  }
  setOn(true);
  await refreshWeather(false);
  return true;
}

/** How long ago the reading was taken, for the garden's label. */
export function ageLabel(at: number, now: number): string {
  const min = Math.max(0, Math.round((now - at) / 60_000));
  return min < 2 ? 'just now' : min < 60 ? `${min} min ago` : `${Math.round(min / 60)} h ago`;
}
