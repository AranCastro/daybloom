import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppLockCard } from '@/components/app-lock-card';
import { BackupCard } from '@/components/backup';
import { Icon } from '@/components/icons';
import { AvatarPicker, ProfileAvatar } from '@/components/profile';
import { Text } from '@/components/text';
import { Button, Card, Choice, Divider, Input, Row, Screen, tap } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { QUADRANTS } from '@/lib/quadrants';
import { CIRCLE } from '@/lib/circle';
import { prettyTime } from '@/lib/dates';
import { cancelFocusAlarm, cancelReminders, scheduleDailyReminder } from '@/lib/reminders';
import { helpline } from '@/lib/region';
import { disableLock } from '@/lib/app-lock';
import { enableLiveWeather } from '@/lib/weather';
import { dndSupported, openDndAccess, useDndAccess } from '@/lib/focus-dnd';
import app from '../../app.json';
import { AppState, resetAll, setLabel, setSettings, update, useAppState } from '@/lib/store';

const TIMES = [
  { label: '8 AM', value: 8 },
  { label: '1 PM', value: 13 },
  { label: '7 PM', value: 19 },
  { label: '9 PM', value: 21 },
];

/** The four usual times, plus the saved one when it is another hour (restored or older data). */
function timesWith(hour: number, minute: number) {
  if (TIMES.some((x) => x.value === hour)) return TIMES;
  return [...TIMES, { label: prettyTime(hour, minute), value: hour }].sort((a, b) => a.value - b.value);
}

export const PRIVACY_URL = 'https://arancastro.github.io/privacy/';

export default function Settings() {
  const t = useTheme();
  const name = useAppState((s) => s.name);
  // Typed locally and saved once, so each keystroke does not rewrite storage and redraw widgets.
  const [draft, setDraft] = useState(name);
  // A Restore (or any other change from outside) replaces the draft, so blurring the field
  // cannot write the old name back over the restored one.
  const [seenName, setSeenName] = useState(name);
  if (seenName !== name) {
    setSeenName(name);
    setDraft(name);
  }
  const [picking, setPicking] = useState(false);
  const reminder = useAppState((s) => s.reminder);
  const streak = useAppState((s) => s.streak);
  const prefs = useAppState((s) => s.settings);
  const dndAccess = useDndAccess();
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
      disableLock();
      resetAll();
      // Close Settings and the tabs beneath it first, so a swipe back from onboarding cannot
      // reveal the old screens.
      if (router.canDismiss()) router.dismissAll();
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

      <AppLockCard />

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

      <LiveWeatherCard />

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
        {dndSupported && (
          <>
            <Text variant="bodyStrong">Do Not Disturb while focusing</Text>
            <Choice
              options={[
                { label: 'Ask', value: 'ask' },
                { label: 'Always', value: 'always' },
                { label: 'Never', value: 'never' },
              ]}
              value={prefs.focusDnd}
              onChange={(focusDnd) => setSettings({ focusDnd })}
            />
            <Text variant="small">
              Silences notifications until the session ends; alarms and your starred contacts still come through.
              {prefs.focusDnd !== 'never' && !dndAccess ? ' Daybloom needs Do Not Disturb access first.' : ''}
            </Text>
            {prefs.focusDnd !== 'never' && !dndAccess && (
              <Button title="Allow Do Not Disturb access" kind="secondary" icon="settings" onPress={openDndAccess} />
            )}
          </>
        )}
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
        <Text variant="small">Used in greetings and to sign the message to your buddy.</Text>
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
          <Choice options={timesWith(reminder.hour, reminder.minute)} value={reminder.hour} onChange={(hour) => setReminder({ ...reminder, hour, minute: 0 })} />
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
        <Row icon="lock" title="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} />
      </Card>

      <BackupCard />

      <Card>
        <Row icon="spark" title="Erase all data" detail="Start fresh on this phone" onPress={wipe} />
      </Card>

      <Credits />

      <AboutFooter />
    </Screen>
  );
}

/** Live weather in the garden: asks for location once, then sends only rounded coordinates to Open-Meteo. */
function LiveWeatherCard() {
  const on = useAppState((s) => s.settings.liveWeather);
  const [note, setNote] = useState<string | undefined>();
  async function toggle(v: boolean) {
    tap();
    if (!v) {
      setSettings({ liveWeather: false });
      return;
    }
    const ok = await enableLiveWeather((liveWeather) => setSettings({ liveWeather }));
    setNote(ok ? undefined : 'Location is off or not allowed, so the garden follows the clock and the season.');
  }
  return (
    <Card>
      <SettingSwitch
        title="Live weather in the garden"
        detail="Rain, clouds, sun or stars as they are where you are. Uses your approximate location (about 11 km) and Open-Meteo, a free weather service. Off: the garden follows the clock and the season."
        value={on}
        onChange={toggle}
      />
      {!!note && <Text variant="small">{note}</Text>}
    </Card>
  );
}

/** The app's name, version and where it was made, at the foot of Settings. */
function AboutFooter() {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 6, paddingVertical: 18 }}>
      <Image source={require('../../assets/images/icon.png')} style={{ width: 56, height: 56, borderRadius: Radius.md }} accessibilityIgnoresInvertColors />
      <Text variant="heading">Daybloom</Text>
      <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: t.surfaceAlt }}>
        <Text variant="caption">Version {app.expo.version}</Text>
      </View>
      <Text variant="quoteSm" color="textSecondary" center>
        Grow a little every day.
      </Text>
      <Text variant="caption" color="textMuted" center>
        Made with care in Kochi, India · © {new Date().getFullYear()} Dr Aran Castro
      </Text>
    </View>
  );
}

/** Who made the app, with a way to get in touch. */
function Credits() {
  const t = useTheme();
  return (
    <Card>
      <Text variant="label">Credits</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Image
          source={require('../../assets/images/creator.jpg')}
          style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: t.brand }}
          contentFit="cover"
          accessibilityLabel="Photo of Dr Aran Castro"
        />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Dr Aran Castro, PhD</Text>
          <Text variant="small">Designed and developed Daybloom</Text>
        </View>
      </View>
      <Row icon="chat" title="arancastro17@gmail.com" onPress={() => Linking.openURL('mailto:arancastro17@gmail.com?subject=Daybloom').catch(() => {})} />
      <Row icon="phone" title="+91 74187 42406" onPress={() => Linking.openURL('tel:+917418742406').catch(() => {})} />
    </Card>
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
  // Follow the saved name when it changes from outside (a Restore), so a blur does not
  // write the stale draft over the restored label.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
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
      <Text variant="caption" color="textMuted">
        {hint}
      </Text>
    </View>
  );
}
