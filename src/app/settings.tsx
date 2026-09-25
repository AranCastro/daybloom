import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Card, Choice, Divider, Input, Row, Screen, tap } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { prettyTime } from '@/lib/dates';
import { cancelFocusAlarm, cancelReminders, scheduleDailyReminder } from '@/lib/reminders';
import { AppState, resetAll, setSettings, update, useAppState } from '@/lib/store';

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
  const reminder = useAppState((s) => s.reminder);
  const streak = useAppState((s) => s.streak);
  const prefs = useAppState((s) => s.settings);

  async function setReminder(next: AppState['reminder']) {
    update({ reminder: next });
    if (next.enabled) {
      const ok = await scheduleDailyReminder(next.hour, next.minute);
      if (!ok && Platform.OS !== 'web') {
        Alert.alert('Notifications are off', 'Allow notifications for Daybloom in your phone settings to get the daily reminder.');
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
      </Card>

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
        <Row icon="shield" title="Your data stays here" detail="Moods, tasks and your circle are stored only on this phone. No account, no ads, no tracking." />
        <Divider />
        <Row icon="phone" title="Talk to someone now" detail="Tele-MANAS 14416 · free, 24 hours" onPress={() => Linking.openURL('tel:14416')} />
        <Divider />
        <Row icon="lock" title="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
      </Card>

      <Card>
        <Row icon="spark" title="Erase all data" detail="Start fresh on this phone" onPress={wipe} />
      </Card>

      <Text variant="small" color="textMuted" center style={{ marginTop: 4 }}>
        Daybloom {Constants.expoConfig?.version ?? ''} · Designed by Dr Aran Castro{'\n'}Not a medical service. In an
        emergency, call 112.
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
