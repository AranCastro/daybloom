import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Button, Card, Divider, Input, Screen } from '@/components/ui';
import { TabBarInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { prettyDate } from '@/lib/dates';
import { shareInvite } from '@/lib/invite';
import { newTopic } from '@/lib/ntfy';
import { getState, testNudge, update, useAppState } from '@/lib/store';

function confirm(title: string, message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Yes', style: 'destructive', onPress: onYes },
  ]);
}

export default function Circle() {
  const t = useTheme();
  const buddy = useAppState((s) => s.buddy);
  const nudges = useAppState((s) => s.nudges);
  const streak = useAppState((s) => s.streak);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');

  async function createBuddy() {
    const name = draft.trim();
    if (!name) return;
    const topic = newTopic();
    update({ buddy: { name, topic, joined: false } });
    setDraft('');
    const r = await shareInvite(name, getState().name, topic);
    if (r === 'copied') setNote('Invite copied. Paste it into WhatsApp or SMS.');
  }

  async function test() {
    setSending(true);
    const ok = await testNudge();
    setSending(false);
    setNote(ok ? `Test sent. Ask ${buddy?.name} if it arrived.` : 'Could not send. Check your internet and try again.');
  }

  return (
    <Screen bottomInset={TabBarInset + 24}>
      <Animated.View entering={FadeInDown.duration(450)} style={{ gap: 4, marginTop: 8 }}>
        <Text variant="label">Your buddy</Text>
        <Text variant="title">One person who{'\n'}would want to know.</Text>
      </Animated.View>

      {!buddy ? (
        <Card>
          <Text variant="heading">Who should we nudge?</Text>
          <Text variant="small">
            Pick someone who would pick up the phone for you: a sibling, a close friend, a parent. They will only ever
            be asked to call.
          </Text>
          <Input value={draft} onChangeText={setDraft} placeholder="Their first name" autoCapitalize="words" />
          <Button title="Create and share invite" icon="share" onPress={createBuddy} disabled={!draft.trim()} />
        </Card>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <View style={[styles.bigAvatar, { backgroundColor: t.brand }]}>
            <Text variant="hero" style={{ color: t.brandText }}>
              {buddy.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text variant="title">{buddy.name}</Text>
          <View style={[styles.pill, { backgroundColor: buddy.joined ? t.glowB : t.accentSoft }]}>
            <View style={[styles.dot, { backgroundColor: buddy.joined ? '#5AA36B' : t.accent }]} />
            <Text variant="small" color="text">
              {buddy.joined ? 'Connected' : 'Waiting for them to join'}
            </Text>
          </View>
          <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 14 }}>
            <Button title="Send a test nudge" icon="send" onPress={test} loading={sending} />
            <Button
              title="Share invite again"
              icon="share"
              kind="secondary"
              onPress={async () => {
                const r = await shareInvite(buddy.name, getState().name, buddy.topic);
                if (r === 'copied') setNote('Invite copied. Paste it into WhatsApp or SMS.');
              }}
            />
          </View>
          {!!note && (
            <Text variant="small" center style={{ marginTop: 6 }}>
              {note}
            </Text>
          )}
          {!buddy.joined && (
            <Pressable
              onPress={() => update((s) => ({ buddy: s.buddy ? { ...s.buddy, joined: true } : null }))}
              style={{ padding: 8 }}>
              <Text variant="small" color="accent">
                They got the test? Mark as connected
              </Text>
            </Pressable>
          )}
        </Card>
      )}

      <Card>
        <Text variant="label">How the nudge works</Text>
        <Step icon="sun" text="You tap how each day feels. Your answers never leave this phone." />
        <Step icon="bell" text={`After ${streak} low days in a row, ${buddy?.name ?? 'your buddy'} gets one line: “Call ${getState().name || 'your friend'} today.”`} />
        <Step icon="lock" text="They are never told why, and never see your moods." />
        <Step icon="heart" text="One nudge per rough patch. A better day resets it." />
      </Card>

      {nudges.length > 0 && (
        <Card>
          <Text variant="label">Nudge history</Text>
          {nudges.slice(0, 8).map((n, i) => (
            <View key={n.at}>
              {i > 0 && <Divider />}
              <View style={styles.history}>
                <Text variant="body">{n.kind === 'test' ? 'Test nudge' : 'Nudge sent'}</Text>
                <Text variant="small">
                  {prettyDate(new Date(n.at))}
                  {n.status === 'queued' ? ' · waiting for internet' : ''}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {buddy && (
        <Pressable
          style={{ alignSelf: 'center', padding: 10 }}
          onPress={() =>
            confirm('Change buddy?', `${buddy.name} will no longer receive nudges.`, () => {
              update({ buddy: null });
              setNote('');
            })
          }>
          <Text variant="small" color="textMuted">
            Change buddy
          </Text>
        </Pressable>
      )}
    </Screen>
  );
}

function Step({ icon, text }: { icon: 'sun' | 'bell' | 'lock' | 'heart'; text: string }) {
  const t = useTheme();
  return (
    <View style={styles.step}>
      <View style={[styles.stepIcon, { backgroundColor: t.surfaceAlt }]}>
        <Icon name={icon} color={t.text} size={18} />
      </View>
      <Text variant="body" color="textSecondary" style={{ flex: 1, fontSize: 15 }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bigAvatar: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  step: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 4 },
  stepIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  history: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
});
