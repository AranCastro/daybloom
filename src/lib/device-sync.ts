/**
 * Device sync (GitHub build only, switched on by EXPO_PUBLIC_DEVICE_SYNC=1 at build time): the user
 * signs in with Google and Daybloom keeps one file, daybloom-sync.json, in the hidden app-data folder
 * of the user's own Google Drive. Each phone downloads it, joins it with its own data
 * (lib/sync-merge), and uploads the result. No server of ours is involved; the app can see only the
 * file it made, not anything else in the user's Drive.
 */
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { useSyncExternalStore } from 'react';
import { AppState as RNAppState } from 'react-native';

import { readItem, removeItem, writeItem } from '@/lib/kv';
import { applyRemote, flushState, getState, onErase, subscribe } from '@/lib/store';
import { forUpload } from '@/lib/sync-merge';

export const syncEnabled = process.env.EXPO_PUBLIC_DEVICE_SYNC === '1';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE = 'daybloom-sync.json';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const KEY = 'daybloom.sync.v1';
/** Wait after the last change before uploading, so a burst of taps makes one upload. */
const PUSH_DELAY_MS = 20_000;
/** Coming back to the app syncs again only after this long. */
const RESUME_GAP_MS = 60_000;

export type SyncInfo = { email: string | null; lastSync: number | null; busy: boolean; error: string | null };

let info: SyncInfo = readInfo();
const listeners = new Set<() => void>();

function readInfo(): SyncInfo {
  try {
    const raw = readItem(KEY);
    const o = raw ? (JSON.parse(raw) as Partial<SyncInfo>) : {};
    return { email: typeof o.email === 'string' ? o.email : null, lastSync: typeof o.lastSync === 'number' ? o.lastSync : null, busy: false, error: null };
  } catch {
    return { email: null, lastSync: null, busy: false, error: null };
  }
}

function setInfo(patch: Partial<SyncInfo>) {
  info = { ...info, ...patch };
  try {
    if (info.email) writeItem(KEY, JSON.stringify({ email: info.email, lastSync: info.lastSync }));
    else removeItem(KEY);
  } catch {
    // Storage full: the sign-in still works for this session.
  }
  listeners.forEach((l) => l());
}

export function useSyncInfo(): SyncInfo {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => info,
    () => info,
  );
}

let configured = false;
function configure() {
  if (configured) return;
  GoogleSignin.configure({ scopes: [SCOPE] });
  configured = true;
}

/** A Drive request; a stale token is cleared and the request tried once more. */
async function drive(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const { accessToken } = await GoogleSignin.getTokens();
  const res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401 && retry) {
    await GoogleSignin.clearCachedAccessToken(accessToken);
    return drive(url, init, false);
  }
  if (!res.ok) throw new Error(`Google Drive answered ${res.status}`);
  return res;
}

async function findFile(): Promise<string | null> {
  const q = encodeURIComponent(`name='${FILE}'`);
  const res = await drive(`${DRIVE}?spaces=appDataFolder&q=${q}&fields=files(id)&pageSize=1`);
  const body = (await res.json()) as { files?: { id: string }[] };
  return body.files?.[0]?.id ?? null;
}

async function upload(id: string | null, text: string): Promise<void> {
  if (id) {
    await drive(`${UPLOAD}/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: text });
    return;
  }
  const boundary = `daybloom${Date.now()}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: FILE, parents: ['appDataFolder'] }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
  await drive(`${UPLOAD}?uploadType=multipart`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
}

function friendly(e: unknown): string {
  if (isErrorWithCode(e)) {
    if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return 'Google Play services is missing or out of date on this phone.';
    if (e.code === statusCodes.SIGN_IN_REQUIRED) return 'Please sign in again.';
    // Android reports a missing or mismatched OAuth client as DEVELOPER_ERROR (code 10).
    if (String(e.code) === '10' || /DEVELOPER_ERROR/.test(e.message)) return 'Google sign-in is not set up for this copy of the app yet.';
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (/network|fetch|timeout/i.test(msg)) return 'No internet connection. Daybloom will try again later.';
  return `Sync did not finish: ${msg}`;
}

let running: Promise<void> | null = null;
let lastPushedAt = -1;

/** Downloads, joins and uploads. Runs one at a time; a call during a sync waits for it. */
export function syncNow(): Promise<void> {
  if (!syncEnabled || !info.email) return Promise.resolve();
  if (running) return running;
  running = (async () => {
    setInfo({ busy: true, error: null });
    try {
      configure();
      const id = await findFile();
      let remoteText: string | null = null;
      if (id) {
        remoteText = await (await drive(`${DRIVE}/${id}?alt=media`)).text();
        const remote = JSON.parse(remoteText) as { app?: string; state?: unknown };
        if (remote.app === 'daybloom' && remote.state && typeof remote.state === 'object') applyRemote(remote.state, { firstTime: !info.lastSync });
      }
      flushState();
      const s = getState();
      const text = JSON.stringify({ app: 'daybloom', format: 1, state: forUpload(s) });
      if (text !== remoteText) await upload(id, text);
      lastPushedAt = s.modifiedAt ?? 0;
      setInfo({ busy: false, lastSync: Date.now() });
    } catch (e) {
      setInfo({ busy: false, error: friendly(e) });
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Shows Google's account picker, then syncs. Returns an error message, or null when signed in. */
export async function signInForSync(): Promise<string | null> {
  try {
    configure();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') return null;
    if (!res.data.scopes.includes(SCOPE)) {
      const more = await GoogleSignin.addScopes({ scopes: [SCOPE] });
      if (more?.type !== 'success') {
        await GoogleSignin.signOut();
        return 'Daybloom needs permission to keep its own file in your Google Drive to sync.';
      }
    }
    setInfo({ email: res.data.user.email, error: null });
    await syncNow();
    return info.error;
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) return null;
    const msg = friendly(e);
    setInfo({ error: msg });
    return msg;
  }
}

/** Stops syncing on this phone. Data here and the copy in Drive both stay. */
export async function signOutOfSync(): Promise<void> {
  try {
    configure();
    await GoogleSignin.signOut();
  } catch {
    // Already signed out.
  }
  setInfo({ email: null, lastSync: null, error: null });
}

/** Removes the copy in Drive (Settings → Delete everything, or the user's choice). */
export async function deleteSyncCopy(): Promise<void> {
  if (!syncEnabled || !info.email) return;
  configure();
  const id = await findFile();
  if (id) await drive(`${DRIVE}/${id}`, { method: 'DELETE' });
}

/** Syncs at launch, when the app comes back, and shortly after local changes. Returns a stop function. */
export function startDeviceSync(): () => void {
  if (!syncEnabled) return () => {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastResume = 0;
  const kick = () => {
    lastResume = Date.now();
    void syncNow();
  };
  if (info.email) kick();
  // Erasing this phone stops its sync; the copy in Drive and the other phones keep their data.
  const unErase = onErase(() => void signOutOfSync());
  const unsub = subscribe(() => {
    if (!info.email || (getState().modifiedAt ?? 0) === lastPushedAt) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), PUSH_DELAY_MS);
  });
  const sub = RNAppState.addEventListener('change', (s) => {
    if (s === 'active' && info.email && Date.now() - lastResume > RESUME_GAP_MS) kick();
    // Leaving the app: send a pending change now rather than wait.
    if (s === 'background' && timer) {
      clearTimeout(timer);
      timer = null;
      void syncNow();
    }
  });
  return () => {
    if (timer) clearTimeout(timer);
    unsub();
    unErase();
    sub.remove();
  };
}
