/** Backup and restore in the browser demo: download a file, and restore from a chosen file. */
import * as DocumentPicker from 'expo-document-picker';

import { backupFileName, makeBackup, parseBackup } from '@/lib/backup-core';
import { getState, setBackupInfo } from '@/lib/store';

function download(): boolean {
  const blob = new Blob([makeBackup(getState())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = backupFileName();
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return true;
}

export async function backUpNow(): Promise<boolean> {
  const ok = download();
  if (ok) setBackupInfo({ lastManual: Date.now(), pendingSave: false });
  return ok;
}

export async function saveLatestWeekly(): Promise<boolean> {
  return backUpNow();
}

export async function pickBackup() {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'] });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const text = asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text();
  return parseBackup(text);
}

/** The browser keeps no weekly files. */
export function weeklyBackupIfDue(): void {}
