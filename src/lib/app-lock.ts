/**
 * App lock: a 4-digit PIN, with fingerprint or face unlock where the phone supports it.
 * Kept in its own storage key, outside the app state, so it is never written into a backup
 * file and a restored backup cannot change the PIN. On the phone the record lives in
 * expo-secure-store (encrypted with a keystore key, and left out of Android auto-backup);
 * on the web it stays in the kv store. Only a slow salted hash of the PIN is kept.
 */
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform, AppState as RNAppState } from 'react-native';

import { readItem, removeItem, writeItem } from '@/lib/kv';

const KEY = 'daybloom.lock.v1';
const ATTEMPTS_KEY = 'daybloom.lock-attempts.v1';
export const PIN_LENGTH = 4;
/** Wrong PINs allowed before a wait. */
const MAX_TRIES = 5;
/** Each wait in a row is longer: 30 s, 1 min, 5 min, 15 min, then an hour each time. */
const WAITS_MS = [30_000, 60_000, 300_000, 900_000, 3_600_000];
/**
 * Hash strength: rounds of SHA-256 over a 16 KB block (1024 × 16 KB = 16 MB hashed per try,
 * about 0.1 s on a mid-range phone). Stored with each record, so older records still check out.
 */
const ROUNDS = 1024;
const BLOCK = 16_384;
/** "Immediately" still lets you glance at another app for a moment. */
const GRACE_MS = 5_000;
/** How long a picker, share sheet or call may keep the app in the background without locking. */
const EXPECT_MS = 120_000;

export type LockAfter = 0 | 60 | 300;
export const LOCK_AFTER: { value: LockAfter; label: string }[] = [
  { value: 0, label: 'Immediately' },
  { value: 60, label: 'After 1 min' },
  { value: 300, label: 'After 5 min' },
];

/** `rounds` is missing on records from before 2.4 (a single SHA-256). */
type Saved = { hash: string; salt: string; biometric: boolean; after: LockAfter; rounds?: number };
type Attempts = { tries: number; strikes: number; waitUntil: number };
const NO_ATTEMPTS: Attempts = { tries: 0, strikes: 0, waitUntil: 0 };

/** Secure store on the phone, kv on the web (secure-store has no web version). */
const secure = Platform.OS !== 'web';

function readSecure(key: string): string | null {
  if (!secure) return readItem(key);
  try {
    return SecureStore.getItem(key) || null;
  } catch {
    return null;
  }
}

/** Returns false if the keystore refused the write. */
function writeSecure(key: string, value: string | null): boolean {
  if (!secure) {
    if (value === null) removeItem(key);
    else writeItem(key, value);
    return true;
  }
  try {
    // There is no synchronous delete: blank it now, then remove it.
    SecureStore.setItem(key, value ?? '');
    if (value === null) void SecureStore.deleteItemAsync(key).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

function load(): Saved | null {
  let raw = readSecure(KEY);
  if (!raw && secure) {
    // Before 2.4 the record was in the kv store (and so in Android auto-backup): move it once.
    // If the keystore refuses, it stays where it is and keeps working.
    raw = readItem(KEY);
    if (raw && writeSecure(KEY, raw)) removeItem(KEY);
  }
  try {
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function loadAttempts(): Attempts {
  try {
    const raw = readSecure(ATTEMPTS_KEY);
    return raw ? { ...NO_ATTEMPTS, ...(JSON.parse(raw) as Partial<Attempts>) } : NO_ATTEMPTS;
  } catch {
    return NO_ATTEMPTS;
  }
}

let saved = load();
let locked = !!saved;
/** Wrong tries survive a force-stop, so the wait cannot be skipped by restarting the app. */
let attempts = loadAttempts();
let backgroundAt: number | null = null;
/** Locked on the way out with "Immediately"; lifted again if back within the grace time. */
let lockedOnLeave = false;
let expectUntil = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function setAttempts(next: Attempts) {
  attempts = next;
  writeSecure(ATTEMPTS_KEY, next.tries || next.strikes || next.waitUntil ? JSON.stringify(next) : null);
}

function persist(next: Saved | null) {
  const wasOn = !!saved;
  saved = next;
  writeSecure(KEY, next ? JSON.stringify(next) : null);
  // A record left in kv by a refused migration must not come back later.
  if (secure && readItem(KEY) !== null) removeItem(KEY);
  if (wasOn !== !!next) shield(!!next);
  emit();
}

/**
 * While the lock is on, the app's windows are secure: blank in the recent-apps carousel and in
 * screenshots (Android takes the recents picture before the app hears it is leaving, so locking
 * then is too late). On iOS the app switcher picture is blurred.
 */
function shield(on: boolean) {
  if (Platform.OS === 'web') return;
  const tag = 'daybloom-lock';
  const quietly = (f: () => Promise<void>) => {
    try {
      void f().catch(() => undefined);
    } catch {
      // No screen (a widget update) or no native module: nothing to protect.
    }
  };
  quietly(() => (on ? ScreenCapture.preventScreenCaptureAsync(tag) : ScreenCapture.allowScreenCaptureAsync(tag)));
  if (Platform.OS === 'ios') quietly(() => (on ? ScreenCapture.enableAppSwitcherProtectionAsync() : ScreenCapture.disableAppSwitcherProtectionAsync()));
}

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/**
 * Salted SHA-256 of the PIN, then `rounds` more rounds, each over a 16 KB block that starts with
 * the previous digest. With only 10,000 PINs a single hash is found at once if the record leaks;
 * this makes each guess cost as much as a real unlock.
 */
async function hashPin(pin: string, salt: string, rounds: number): Promise<string> {
  const first = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
  if (!rounds) return first;
  const block = new Uint8Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) block[i] = (salt.charCodeAt(i % salt.length) + i) & 255;
  let h = Uint8Array.from(first.match(/../g) ?? [], (x) => parseInt(x, 16));
  for (let r = 0; r < rounds; r++) {
    block.set(h, 0);
    h = new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, block));
  }
  return toHex(h);
}

export type LockInfo = { enabled: boolean; locked: boolean; biometric: boolean; after: LockAfter };

let snapshot: LockInfo = info();
function info(): LockInfo {
  return { enabled: !!saved, locked: !!saved && locked, biometric: !!saved?.biometric, after: saved?.after ?? 60 };
}
listeners.add(() => {
  snapshot = info();
});

/** The lock state outside React (background work, tests). */
export function isLocked(): boolean {
  return snapshot.locked;
}

export function useLock(): LockInfo {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
    () => snapshot,
  );
}

async function newRecord(pin: string, from: Saved | null): Promise<Saved> {
  const salt = Crypto.randomUUID();
  return { hash: await hashPin(pin, salt, ROUNDS), salt, biometric: from?.biometric ?? false, after: from?.after ?? 60, rounds: ROUNDS };
}

/** Turns the lock on (or changes the PIN). */
export async function setPin(pin: string) {
  persist(await newRecord(pin, saved));
  setAttempts(NO_ATTEMPTS);
  locked = false;
  emit();
}

export async function checkPin(pin: string): Promise<boolean> {
  if (!saved) return true;
  const current = saved;
  if ((await hashPin(pin, current.salt, current.rounds ?? 0)) !== current.hash) return false;
  // An older, weaker record is rehashed now that the PIN is known.
  if ((current.rounds ?? 0) < ROUNDS) {
    const next = await newRecord(pin, current);
    if (saved === current) persist(next);
  }
  return true;
}

/** Seconds to wait after too many wrong PINs (0 when free to try). */
export function waitSeconds(now = Date.now()): number {
  return Math.max(0, Math.ceil((attempts.waitUntil - now) / 1000));
}

/** The wait in words, for the lock screen: "30 seconds", "5 minutes", "1 hour". */
export function waitLabel(now = Date.now()): string {
  const s = waitSeconds(now);
  if (s < 60) return `${s} ${s === 1 ? 'second' : 'seconds'}`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'}`;
  const h = Math.ceil(m / 60);
  return `${h} ${h === 1 ? 'hour' : 'hours'}`;
}

/** Tries a PIN on the lock screen. */
export async function unlockWithPin(pin: string): Promise<'ok' | 'wrong' | 'wait'> {
  if (waitSeconds() > 0) return 'wait';
  if (await checkPin(pin)) {
    setAttempts(NO_ATTEMPTS);
    locked = false;
    emit();
    return 'ok';
  }
  const tries = attempts.tries + 1;
  if (tries >= MAX_TRIES) {
    const wait = WAITS_MS[Math.min(attempts.strikes, WAITS_MS.length - 1)];
    setAttempts({ tries: 0, strikes: attempts.strikes + 1, waitUntil: Date.now() + wait });
    return 'wait';
  }
  setAttempts({ ...attempts, tries });
  return 'wrong';
}

export async function biometricAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function unlockWithBiometric(): Promise<boolean> {
  if (!saved?.biometric) return false;
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Daybloom', cancelLabel: 'Use PIN', disableDeviceFallback: true });
    if (r.success) {
      setAttempts(NO_ATTEMPTS);
      locked = false;
      emit();
    }
    return r.success;
  } catch {
    return false;
  }
}

export function setBiometric(on: boolean) {
  if (saved) persist({ ...saved, biometric: on });
}

export function setLockAfter(after: LockAfter) {
  if (saved) persist({ ...saved, after });
}

/** Turns the lock off (after the PIN was confirmed in Settings). */
export function disableLock() {
  locked = false;
  setAttempts(NO_ATTEMPTS);
  persist(null);
}

/**
 * Call just before something that briefly leaves the app and comes back: a contact or file
 * picker, the share sheet, a call or message, a permission dialog. Android reports those as
 * going to the background, so without this "Immediately" would ask for the PIN on every return.
 * Holds for the next return only, and for two minutes at most.
 */
export function expectReturn(now = Date.now()) {
  expectUntil = now + EXPECT_MS;
}

/** What the lock does when the app changes state (exported for tests). */
export function onAppStateChange(s: string, now = Date.now()) {
  if (!saved) return;
  if (s === 'background') {
    backgroundAt ??= now;
    // "Immediately": lock on the way out, unless a picker or share sheet is expected back.
    if (saved.after === 0 && !locked && now > expectUntil) {
      locked = true;
      lockedOnLeave = true;
      emit();
    }
  }
  if (s === 'active' && backgroundAt !== null) {
    const away = now - backgroundAt;
    const expected = now <= expectUntil;
    if (lockedOnLeave && away < GRACE_MS) locked = false;
    else if (!expected && away >= Math.max(saved.after * 1000, GRACE_MS)) locked = true;
    backgroundAt = null;
    lockedOnLeave = false;
    expectUntil = 0;
    emit();
  }
}

/** Locks when the app returns after being away longer than the chosen time. */
export function startLockWatch(): () => void {
  shield(!!saved);
  const sub = RNAppState.addEventListener('change', (s) => onAppStateChange(s));
  return () => sub.remove();
}
