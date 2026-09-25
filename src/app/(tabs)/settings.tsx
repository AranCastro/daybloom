import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, Linking, Platform, Switch, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { Card, Choice, Divider, Input, Row, Screen } from '@/components/ui';
import { TabBarInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { prettyTime } from '@/lib/dates';
import { cancelReminders, scheduleDailyReminder } from '@/lib/reminders';
import { AppState, getState, resetAll, update, useAppState } from '@/lib/store';

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
  const reminder = useAppState((s) => s.reminder);
  const streak = useAppState((s) => s.streak);

  async function setReminder(next: AppState['reminder']) {
    update({ reminder: next });
    if (next.enabled) {
      const ok = await scheduleDailyReminder(next.hour, next.minute);
      if (!ok && Platform.OS !== 'web') {
        Alert.alert('Notifications are off', 'Allow notifications for Nudge in your phone settings to get the daily reminder.');
      }
    } else {
      await cancelReminders();
    }
  }

  function wipe() {
    const go = () => {
      cancelReminders();
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
    <Screen bottomInset={TabBarInset + 24}>
      <Animated.View entering={FadeInDown.duration(450)} style={{ gap: 4, marginTop: 8 }}>
        <Text variant="label">Settings</Text>
        <Text variant="title">Made to fit you.</Text>
      </Animated.View>

      <Card>
        <Text variant="label">Your first name</Text>
        <Input
          value={name}
          onChangeText={(v) => update({ name: v.replace(/^\s+/, '') })}
          onEndEditing={() => update({ name: getState().name.trim() })}
          placeholder="Shown in the nudge"
          autoCapitalize="words"
        />
        <Text variant="small">Your buddy will see: “Call {name || 'your friend'} today.”</Text>
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
        <Row icon="shield" title="Your data stays here" detail="Moods are stored only on this phone. No account, no ads, no tracking." />
        <Divider />
        <Row icon="phone" title="Talk to someone now" detail="Tele-MANAS 14416 · free, 24 hours" onPress={() => Linking.openURL('tel:14416')} />
        <Divider />
        <Row icon="lock" title="Privacy policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
      </Card>

      <Card>
        <Row icon="spark" title="Erase all data" detail="Start fresh on this phone" onPress={wipe} />
      </Card>

      <Text variant="small" color="textMuted" center style={{ marginTop: 4 }}>
        Nudge a Friend {Constants.expoConfig?.version ?? ''} · Designed by Dr Aran Castro{'\n'}Not a medical service. In an
        emergency, call 112.
      </Text>
    </Screen>
  );
}
