/**
 * Backup and restore on the phone.
 * - "Back up now" writes a backup file and opens the share menu, where Google Drive can be picked.
 * - "Restore" opens a backup file (from Drive or the phone) with the system file picker.
 * - Weekly: a fresh backup file is kept in the app's own storage (which Android's Google backup
 *   also copies to Drive) and the user is invited to save it to Drive.
 */
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { backupFileName, makeBackup, parseBackup } from '@/lib/backup-core';
import { getState, setBackupInfo } from '@/lib/store';

const WEEK = 7 * 24 * 60 * 60 * 1000;
const KEEP = 4;

function backupsDir(): Directory {
  const dir = new Directory(Paths.document, 'backups');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function writeBackup(dir: Directory): File {
  const file = new File(dir, backupFileName());
  if (file.exists) file.delete();
  file.create();
  file.write(makeBackup(getState()));
  return file;
}

async function share(file: File): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Daybloom backup', UTI: 'public.json' });
  return true;
}

/** Makes a backup and opens the share menu (choose Google Drive to keep it safe). */
export async function backUpNow(): Promise<boolean> {
  const ok = await share(writeBackup(new Directory(Paths.cache)));
  if (ok) setBackupInfo({ lastManual: Date.now(), pendingSave: false });
  return ok;
}

/** Shares the newest weekly backup (from the "weekly backup is ready" card). */
export async function saveLatestWeekly(): Promise<boolean> {
  const files = listWeekly();
  const ok = files.length ? await share(files[0]) : await share(writeBackup(new Directory(Paths.cache)));
  if (ok) setBackupInfo({ lastManual: Date.now(), pendingSave: false });
  return ok;
}

/** Lets the user choose a backup file and checks it. Nothing is changed until they confirm. */
export async function pickBackup() {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  const text = await new File(result.assets[0].uri).text();
  return parseBackup(text);
}

function listWeekly(): File[] {
  return backupsDir()
    .list()
    .filter((f): f is File => f instanceof File && f.name.startsWith('daybloom-backup-'))
    .sort((a, b) => b.name.localeCompare(a.name));
}

/** Once a week (checked when the app opens): keep a fresh backup on the phone and keep the last four. */
export function weeklyBackupIfDue(): void {
  const s = getState();
  if (!s.onboarded || !s.settings.autoBackup) return;
  if (s.backup.lastAuto && Date.now() - s.backup.lastAuto < WEEK) return;
  try {
    writeBackup(backupsDir());
    listWeekly()
      .slice(KEEP)
      .forEach((f) => f.delete());
    setBackupInfo({ lastAuto: Date.now(), pendingSave: true });
  } catch {
    // Storage full or unavailable: try again next time the app opens.
  }
}
