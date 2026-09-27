/**
 * The Daybloom backup file: plain JSON with everything the app keeps on the phone.
 * Shared by the native and web versions of backup.ts, and safe to test on its own.
 */
import Constants from 'expo-constants';

import { dayKey } from '@/lib/dates';
import type { AppState } from '@/lib/store';

export const BACKUP_FORMAT = 1;

export type BackupFile = {
  app: 'daybloom';
  format: number;
  appVersion: string;
  exportedAt: number;
  state: Partial<AppState>;
};

export type BackupSummary = { exportedAt: number; days: number; tasks: number; people: number; blooms: number; name: string };

/** Backup bookkeeping is about this phone, so it is not written into the file. */
export function makeBackup(state: AppState, now = Date.now()): string {
  const { backup: _local, ...rest } = state;
  const file: BackupFile = {
    app: 'daybloom',
    format: BACKUP_FORMAT,
    appVersion: Constants.expoConfig?.version ?? '',
    exportedAt: now,
    // A profile photo is a file on this phone, so it is not carried in the backup (a chosen avatar is).
    state: { ...rest, focus: { ...rest.focus, active: null }, avatar: rest.avatar?.kind === 'photo' ? null : rest.avatar },
  };
  return JSON.stringify(file);
}

export function backupFileName(now = new Date()): string {
  return `daybloom-backup-${dayKey(now)}.json`;
}

/** Far above any real backup (a full garden and years of check-ins are well under 5 MB). */
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

/** File types the restore picker offers. Some Android file managers label .json files as octet-stream. */
export const BACKUP_TYPES = ['application/json', 'text/plain', 'application/octet-stream'];

/** Refuses a file too large to be a backup before it is read into memory (a video picked by mistake). */
export function checkBackupSize(bytes: number | null | undefined): { ok: false; reason: string } | null {
  return typeof bytes === 'number' && bytes > MAX_BACKUP_BYTES ? { ok: false, reason: 'This file is too large to be a Daybloom backup, so it was not opened.' } : null;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Reads a backup file and checks it really is one before anything is replaced. */
export function parseBackup(text: string): { ok: true; backup: BackupFile; summary: BackupSummary } | { ok: false; reason: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'This file is not a Daybloom backup (it could not be read).' };
  }
  if (!isObj(data) || data.app !== 'daybloom' || !isObj(data.state)) {
    return { ok: false, reason: 'This file is not a Daybloom backup.' };
  }
  if (typeof data.format !== 'number' || data.format > BACKUP_FORMAT) {
    return { ok: false, reason: 'This backup was made by a newer version of Daybloom. Update the app, then try again.' };
  }
  const s = data.state as Record<string, unknown>;
  // A file whose main lists are the wrong kind is refused outright; damaged entries inside them are
  // dropped on restore (lib/sanitise), so one bad line cannot stop the app from opening.
  const lists = ['tasks', 'people', 'garden', 'nudges'] as const;
  const maps = ['checkins', 'badges'] as const;
  if (lists.some((k) => s[k] !== undefined && !Array.isArray(s[k])) || maps.some((k) => s[k] !== undefined && !isObj(s[k]))) {
    return { ok: false, reason: 'This backup looks damaged, so nothing was changed.' };
  }
  const state = s as Partial<AppState>;
  const backup = data as unknown as BackupFile;
  return {
    ok: true,
    backup,
    summary: {
      exportedAt: typeof backup.exportedAt === 'number' ? backup.exportedAt : 0,
      days: Object.keys(state.checkins ?? {}).length,
      tasks: (state.tasks ?? []).length,
      people: (state.people ?? []).length,
      blooms: (state.garden ?? []).length,
      name: typeof state.name === 'string' ? state.name : '',
    },
  };
}
