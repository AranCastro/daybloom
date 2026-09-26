import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BackupCard } from '@/components/backup';
import { Icon } from '@/components/icons';
import { AvatarPicker, ProfileAvatar } from '@/components/profile';
import { Text } from '@/components/text';
import { Card, Choice, Divider, Input, Row, Screen, tap } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { QUADRANTS } from '@/lib/quadrants';
import { CIRCLE } from '@/lib/circle';
import { prettyTime } from '@/lib/dates';
import { cancelFocusAlarm, cancelReminders, scheduleDailyReminder } from '@/lib/reminders';
import { helpline } from '@/lib/region';
import { AppState, resetAll, setLabel, setSettings, update, useAppState } from '@/lib/store';

const TIMES = [
  { label: '8 AM', value: 8 },
  { label: '1 PM', value: 13 },
  { label: '7 PM', value: 19 },
  { label: '9 PM', value: 21 },
];

export const PRIVACY_URL = 'https://arancastro.github.io/privacy/';

export default function Settings() {
  const t = useTheme();
  const name = useAppState((s) => s.name);
  // Typed locally and saved once, so each keystroke does not rewrite storage and redraw widgets.
  const [draft, setDraft] = useState(name);
  const [picking, setPicking] = useState(false);
  const reminder = useAppState((s) => s.reminder);
  const streak = useAppState((s) => s.streak);
  const prefs = useAppState((s) => s.settings);
  const help = helpline();

  async function setReminder(next: AppState['reminder']) {
    update({ reminder: next });
    if (next.enabled) {
      const ok = await scheduleDailyReminder(next.hour, next.minute);
      if (!ok) {
        // Nothing was scheduled, so do not show the reminder as on.
        update({ reminder: { ...next, enabled: false } });
        if (Platform.OS !== 'web') {
          Alert.alert('Notifications are off', 'Allow notifications for Daybloom in your phone settings to get the daily reminder.', [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open settings', onPress: () => Linking.openSettings().catch(() => {}) },
          ]);
        }
      }
    } else {
      await cancelReminders();
    }
  }

  function wipe() {
    const go = () => {
      cancelReminders();
      cancelFocusAlarm();
      resetAll();
      router.replace('/onboarding');
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Erase everything? This removes all moods and your buddy from this phone.')) go();
      return;
    }
    Alert.alert('Erase everything?', 'This removes all moods and your buddy from this phone. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Erase', style: 'destructive', onPress: go },
    ]);
  }

  return (
    <Screen>
      <Pressable hitSlop={12} onPress={() => (tap(), router.back())} accessibilityLabel="Back" style={{ height: 32, justifyContent: 'center' }}>
        <Icon name="back" color={t.textSecondary} />
      </Pressable>
      <Animated.View entering={FadeInDown.duration(450)} style={{ gap: 4 }}>
        <Text variant="label">Settings</Text>
        <Text variant="title">Made to fit you.</Text>
      </Animated.View>

      <Card>
        <Row
          icon="grid"
          title="Home screen widgets"
          detail="Check in, tick off tasks and start focus from your home screen"
          onPress={() => router.push('/widgets')}
          right={<Icon name="arrow" color={t.textMuted} size={18} />}
        />
      </Card>

      <Card>
        <Text variant="label">Appearance</Text>
        <Choice
          options={[
            { label: 'System', value: 'system' },
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
          ]}
          value={prefs.appearance}
          onChange={(appearance) => setSettings({ appearance })}
        />
        <Text variant="small">
          {prefs.appearance === 'system' ? 'Follows your phone’s light or dark setting.' : `Always ${prefs.appearance}, whatever the phone is set to.`}
        </Text>
      </Card>

      <Card>
        <Text variant="label">Comfort</Text>
        <SettingSwitch
          title="Vibration"
          detail="A light buzz on taps, check-ins and games"
          value={prefs.haptics}
          onChange={(haptics) => setSettings({ haptics })}
        />
        <Divider />
        <SettingSwitch
          title="Reduce motion"
          detail="Stops the breathing orb and softens animations. Also saves battery."
          value={prefs.reduceMotion}
          onChange={(reduceMotion) => setSettings({ reduceMotion })}
        />
      </Card>

      <Card>
        <Text variant="label">Calendar and focus</Text>
        <Text variant="bodyStrong">Week starts on</Text>
        <Choice
          options={[
            { label: 'Sunday', value: 0 },
            { label: 'Monday', value: 1 },
          ]}
          value={prefs.weekStart}
          onChange={(v) => setSettings({ weekStart: v as 0 | 1 })}
        />
        <Text variant="bodyStrong">Usual focus session</Text>
        <Choice
          options={[
            { label: '15 min', value: 'gentle' },
            { label: '25 min', value: 'classic' },
            { label: '50 min', value: 'deep' },
          ]}
          value={prefs.focusPreset}
          onChange={(focusPreset) => setSettings({ focusPreset })}
        />
        <Text variant="small">On a low day the timer still suggests the gentle 15 minutes.</Text>
      </Card>

      <Card>
        <Text variant="label">Profile</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Pressable onPress={() => (tap(), setPicking(true))} accessibilityRole="button" accessibilityLabel="Change profile picture">
            <ProfileAvatar size={64} />
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong">Profile picture</Text>
            <Pressable onPress={() => (tap(), setPicking(true))} hitSlop={6}>
              <Text variant="small" color="accent">
                Upload a photo or choose an avatar
              </Text>
            </Pressable>
          </View>
        </View>
        <Text variant="label">Your first name</Text>
        <Input
          value={draft}
          onChangeText={(v) => setDraft(v.replace(/^\s+/, ''))}
          onEndEditing={() => draft.trim() !== name && update({ name: draft.trim() })}
          onBlur={() => draft.trim() !== name && update({ name: draft.trim() })}
          placeholder="Shown in the nudge"
          autoCapitalize="words"
        />
        <Text variant="small">Your buddy will see: “Call {draft.trim() || 'your friend'} today.”</Text>
        <AvatarPicker visible={picking} onClose={() => setPicking(false)} />
      </Card>

      <SectionNames />

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">Daily reminder</Text>
            <Text variant="small">
              {reminder.enabled ? `Every day at ${prettyTime(reminder.hour, reminder.minute)}` : 'Off'}
            </Text>
          </View>
          <Switch
            value={reminder.enabled}
            onValueChange={(enabled) => setReminder({ ...reminder, enabled })}
            trackColor={{ true: t.brand, false: t.line }}
            thumbColor="#fff"
          />
        </View>
        {reminder.enabled && (
          <Choice options={TIMES} value={reminder.hour} onChange={(hour) => setReminder({ ...reminder, hour, minute: 0 })} />
        )}
      </Card>

      <Card>
        <Text variant="bodyStrong">Nudge after</Text>
        <Text variant="small">How many low days in a row before your buddy is asked to call.</Text>
        <Choice
          options={[
            { label: '2 days', value: 2 },
            { label: '3 days', value: 3 },
            { label: '4 days', value: 4 },
          ]}
          value={streak}
          onChange={(v) => update({ streak: v as AppState['streak'] })}
        />
      </Card>

      <Card>
        <Row
          icon="shield"
          title="Your data stays with you"
          detail="Moods, tasks and your circle are stored on this phone, and in backups you choose to make. No account, no ads, no tracking."
        />
        <Divider />
        <Row
          icon="phone"
          title="Talk to someone now"
          detail={help.number ? `${help.name} ${help.number} · free, 24 hours` : `${help.name} · helplines in your country`}
          onPress={() => Linking.openURL(help.number ? `tel:${help.number}` : help.link!).catch(() => {})}
        />
        <Divider />
        <Row icon="lock" title="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
      </Card>

      <BackupCard />

      <Card>
        <Row icon="spark" title="Erase all data" detail="Start fresh on this phone" onPress={wipe} />
      </Card>

      <Text variant="small" color="textMuted" center style={{ marginTop: 4 }}>
        Daybloom {Constants.expoConfig?.version ?? ''} · Designed by Dr Aran Castro{'\n'}Not a medical service. In an
        emergency, call {help.emergency}.
      </Text>
    </Screen>
  );
}

function SettingSwitch({ title, detail, value, onChange }: { title: string; detail: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small">{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: t.brand, false: t.line }}
        thumbColor="#fff"
        accessibilityLabel={title}
      />
    </View>
  );
}

/** Rename the four matrix quadrants and the four circle sections (empty = the default name). */
function SectionNames() {
  const labels = useAppState((s) => s.labels);
  const row = (kind: 'matrix' | 'circle', q: 1 | 2 | 3 | 4, fallback: string, hint: string) => (
    <NameField key={`${kind}${q}`} value={labels[kind][q] ?? ''} placeholder={fallback} hint={hint} onSave={(v) => setLabel(kind, q, v)} />
  );
  return (
    <Card>
      <Text variant="label">Section names</Text>
      <Text variant="small">Rename the matrix and circle headings to suit you. Leave a box empty to use the original name.</Text>
      <Text variant="bodyStrong">Eisenhower Matrix</Text>
      {QUADRANTS.map((i) => row('matrix', i.id, i.action, i.meaning))}
      <Divider />
      <Text variant="bodyStrong">People circle</Text>
      {CIRCLE.map((i) => row('circle', i.id, i.title, i.meaning))}
    </Card>
  );
}

function NameField({ value, placeholder, hint, onSave }: { value: string; placeholder: string; hint: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const save = () => draft.trim() !== value && onSave(draft);
  return (
    <View style={{ gap: 2 }}>
      <Input
        value={draft}
        onChangeText={setDraft}
        onEndEditing={save}
        onBlur={save}
        placeholder={placeholder}
        maxLength={24}
        accessibilityLabel={`Name for ${placeholder} (${hint})`}
      />
      <Text variant="small" color="textMuted" style={{ fontSize: 12 }}>
        {hint}
      </Text>
    </View>
  );
}
