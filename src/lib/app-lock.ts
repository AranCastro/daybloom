/**
 * App lock: a 4-digit PIN, with fingerprint or face unlock where the phone supports it.
 * Kept in its own storage key, outside the app state, so it is never written into a backup
 * file and a restored backup cannot change the PIN. Only a salted SHA-256 hash of the PIN is kept.
 */
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { useSyncExternalStore } from 'react';
import { AppState as RNAppState } from 'react-native';

import { readItem, removeItem, writeItem } from '@/lib/kv';

const KEY = 'daybloom.lock.v1';
export const PIN_LENGTH = 4;
/** Wrong PINs allowed before a short wait. */
const MAX_TRIES = 5;
const WAIT_MS = 30_000;

export type LockAfter = 0 | 60 | 300;
export const LOCK_AFTER: { value: LockAfter; label: string }[] = [
  { value: 0, label: 'Immediately' },
  { value: 60, label: 'After 1 min' },
  { value: 300, label: 'After 5 min' },
];

type Saved = { hash: string; salt: string; biometric: boolean; after: LockAfter };

function load(): Saved | null {
  try {
    const raw = readItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

let saved = load();
let locked = !!saved;
let tries = 0;
let waitUntil = 0;
let backgroundAt: number | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function persist(next: Saved | null) {
  saved = next;
  if (next) writeItem(KEY, JSON.stringify(next));
  else removeItem(KEY);
  emit();
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export type LockInfo = { enabled: boolean; locked: boolean; biometric: boolean; after: LockAfter };

let snapshot: LockInfo = info();
function info(): LockInfo {
  return { enabled: !!saved, locked: !!saved && locked, biometric: !!saved?.biometric, after: saved?.after ?? 60 };
}
listeners.add(() => {
  snapshot = info();
});

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

/** Turns the lock on (or changes the PIN). */
export async function setPin(pin: string) {
  const salt = Crypto.randomUUID();
  persist({ hash: await hashPin(pin, salt), salt, biometric: saved?.biometric ?? false, after: saved?.after ?? 60 });
  locked = false;
  emit();
}

export async function checkPin(pin: string): Promise<boolean> {
  if (!saved) return true;
  return (await hashPin(pin, saved.salt)) === saved.hash;
}

/** Seconds to wait after too many wrong PINs (0 when free to try). */
export function waitSeconds(now = Date.now()): number {
  return Math.max(0, Math.ceil((waitUntil - now) / 1000));
}

/** Tries a PIN on the lock screen. */
export async function unlockWithPin(pin: string): Promise<'ok' | 'wrong' | 'wait'> {
  if (waitSeconds() > 0) return 'wait';
  if (await checkPin(pin)) {
    tries = 0;
    locked = false;
    emit();
    return 'ok';
  }
  tries += 1;
  if (tries >= MAX_TRIES) {
    tries = 0;
    waitUntil = Date.now() + WAIT_MS;
    return 'wait';
  }
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
      tries = 0;
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
  persist(null);
}

/** Locks when the app returns after being away longer than the chosen time. */
export function startLockWatch(): () => void {
  const sub = RNAppState.addEventListener('change', (s) => {
    if (!saved) return;
    if (s === 'background') backgroundAt = Date.now();
    if (s === 'active' && backgroundAt !== null) {
      if ((Date.now() - backgroundAt) / 1000 >= saved.after) {
        locked = true;
        emit();
      }
      backgroundAt = null;
    }
  });
  return () => sub.remove();
}
