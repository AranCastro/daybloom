/** Backup and restore: the Settings card and the "weekly backup is ready" card on Today. */
import { useState } from 'react';
import { Alert, Platform, Pressable, Switch, View } from 'react-native';

import { Text } from '@/components/text';
import { Button, Card, Divider, tap } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { backUpNow, pickBackup, saveLatestWeekly } from '@/lib/backup';
import { BackupSummary } from '@/lib/backup-core';
import { prettyDate } from '@/lib/dates';
import { cancelFocusAlarm, cancelReminders, scheduleDailyReminder } from '@/lib/reminders';
import { getState, replaceState, setBackupInfo, setSettings, useAppState } from '@/lib/store';

const WEB = Platform.OS === 'web';

function when(at?: number): string {
  return at ? prettyDate(new Date(at)) : 'never';
}

/** Alert.alert with buttons does nothing on web, so the browser demo uses confirm(). */
function confirmAsync(title: string, message: string, ok: string): Promise<boolean> {
  if (WEB) return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

function notify(title: string, message: string) {
  if (WEB) window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

function describe(s: BackupSummary): string {
  const bits = [`${s.days} ${s.days === 1 ? 'day' : 'days'} of check-ins`, `${s.tasks} tasks`, `${s.people} people`, `${s.blooms} flowers`];
  return `Backup from ${s.exportedAt ? prettyDate(new Date(s.exportedAt)) : 'an unknown date'}${s.name ? ` (${s.name})` : ''}: ${bits.join(', ')}.`;
}

export function BackupCard() {
  const t = useTheme();
  const info = useAppState((s) => s.backup);
  const auto = useAppState((s) => s.settings.autoBackup);
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null);

  async function backup() {
    setBusy('backup');
    try {
      const ok = await backUpNow();
      if (!ok) notify('Could not open the share menu', 'Sharing is not available on this device.');
    } catch {
      notify('Backup failed', 'Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy('restore');
    try {
      const picked = await pickBackup();
      if (!picked) return;
      if (!picked.ok) return notify('Cannot restore this file', picked.reason);
      const yes = await confirmAsync(
        'Restore this backup?',
        `${describe(picked.summary)}\n\nThis replaces everything now on this phone. Make a backup first if you want to keep it.`,
        'Restore',
      );
      if (!yes) return;
      replaceState(picked.backup.state);
      // Reminders follow the restored settings; a running focus alarm no longer applies.
      await cancelFocusAlarm().catch(() => {});
      const r = getState().reminder;
      if (!WEB) await (r.enabled ? scheduleDailyReminder(r.hour, r.minute) : cancelReminders()).catch(() => {});
      notify('Restored', 'Your moods, tasks, people and garden are back.');
    } catch {
      notify('Restore failed', 'The file could not be opened. Nothing was changed.');
    } finally {
      setBusy(null);
    }
  }

  const last = Math.max(info.lastManual ?? 0, info.lastAuto ?? 0) || undefined;

  return (
    <Card>
      <Text variant="label">Backup and restore</Text>
      <Text variant="small">
        Last backup: {when(last)}
        {info.lastRestore ? ` · Last restored: ${when(info.lastRestore)}` : ''}
      </Text>
      <Button title={WEB ? 'Download a backup' : 'Back up to Google Drive'} icon="share" loading={busy === 'backup'} onPress={backup} />
      {!WEB && <Text variant="small">Opens the share menu. Choose Drive to keep the file safe in your Google account.</Text>}
      <Button title="Restore from a backup" icon="refresh" kind="secondary" loading={busy === 'restore'} onPress={restore} />
      {!WEB && (
        <>
          <Divider />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Weekly backup</Text>
              <Text variant="small">Keeps a fresh backup on this phone every week and reminds you to save it to Drive.</Text>
            </View>
            <Switch
              value={auto}
              onValueChange={(autoBackup) => setSettings({ autoBackup })}
              trackColor={{ true: t.brand, false: t.line }}
              thumbColor="#fff"
              accessibilityLabel="Weekly backup"
            />
          </View>
          <Text variant="small" color="textMuted">
            Your phone’s own Google backup (Settings › Google › Backup) also includes Daybloom, and restores it when you
            reinstall or move to a new phone.
          </Text>
        </>
      )}
    </Card>
  );
}

/** Shown on Today after the weekly backup is made, until it is saved or put off. */
export function WeeklyBackupCard() {
  const pending = useAppState((s) => s.backup.pendingSave);
  const [busy, setBusy] = useState(false);
  if (!pending || WEB) return null;

  async function save() {
    setBusy(true);
    try {
      await saveLatestWeekly();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text variant="label">Weekly backup</Text>
      <Text variant="bodyStrong">Your backup for this week is ready.</Text>
      <Text variant="small">Save it to Google Drive so your moods, tasks and garden are safe even if you change phones.</Text>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Button title="Save to Drive" icon="share" loading={busy} onPress={save} style={{ flex: 1 }} />
        <Pressable onPress={() => (tap(), setBackupInfo({ pendingSave: false }))} hitSlop={8} style={{ paddingHorizontal: 12 }}>
          <Text variant="bodyStrong" color="textSecondary">
            Later
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}
