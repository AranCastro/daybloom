import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Button, Card, Divider, Input, Screen, tap } from '@/components/ui';
import { TabBarInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { prettyDate } from '@/lib/dates';
import { shareInvite } from '@/lib/invite';
import { newTopic } from '@/lib/ntfy';
import { Avatar, CircleChip, PersonSheet, useCircleColors } from '@/components/people';
import { CIRCLE, circleOf } from '@/lib/circle';
import { CircleQuadrant, getState, Person, peopleIn, testNudge, update, useAppState } from '@/lib/store';

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
        <Text variant="label">Your circle</Text>
        <Text variant="title">Who lifts you{'\n'}on a low day?</Text>
        <Text variant="small">Sort the people you trust by how close they are and how you reach them.</Text>
      </Animated.View>

      <CircleMatrix />

      <View style={{ gap: 4, marginTop: 12 }}>
        <Text variant="label">Your nudge buddy</Text>
        <Text variant="heading">One person who would want to know.</Text>
      </View>

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

/** 2 × 2 people matrix: columns Close / Wider, rows Call / Message. */
function CircleMatrix() {
  const people = useAppState((s) => s.people);
  const [sheet, setSheet] = useState<{ open: boolean; person?: Person | null; q?: CircleQuadrant }>({ open: false });

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.axisRow}>
        <Text variant="label" center style={{ flex: 1 }}>
          Close
        </Text>
        <Text variant="label" center style={{ flex: 1 }}>
          Wider circle
        </Text>
      </View>
      {[0, 2].map((start) => (
        <View key={start} style={styles.circleRow}>
          {CIRCLE.slice(start, start + 2).map((info, i) => (
            <Animated.View key={info.id} entering={FadeInDown.delay(70 * (start + i)).duration(400)} style={{ flex: 1 }}>
              <CircleCard
                q={info.id}
                people={peopleIn(people, info.id)}
                onPerson={(person) => setSheet({ open: true, person })}
                onAdd={() => setSheet({ open: true, person: null, q: info.id })}
              />
            </Animated.View>
          ))}
        </View>
      ))}
      <PersonSheet visible={sheet.open} person={sheet.person} defaultQuadrant={sheet.q} onClose={() => setSheet({ open: false })} />
    </View>
  );
}

function CircleCard({
  q,
  people,
  onPerson,
  onAdd,
}: {
  q: CircleQuadrant;
  people: Person[];
  onPerson: (p: Person) => void;
  onAdd: () => void;
}) {
  const t = useTheme();
  const { color, soft } = useCircleColors(q);
  const info = circleOf(q);
  return (
    <View style={[styles.circleCard, { backgroundColor: t.surface, borderColor: t.line }]}>
      <View style={[styles.circleTint, { backgroundColor: soft }]} />
      <View style={styles.circleHead}>
        <View style={styles.circleTitle}>
          <CircleChip q={q} size={22} />
          <Text variant="heading" style={{ color, fontSize: 15.5, lineHeight: 20, flex: 1 }} numberOfLines={1} adjustsFontSizeToFit>
            {info.title}
          </Text>
        </View>
        <View style={styles.circleMode}>
          <Icon name={info.mode === 'call' ? 'phone' : 'chat'} color={t.textSecondary} size={13} />
          <Text variant="small" style={{ fontSize: 11.5, lineHeight: 15 }}>
            {info.mode === 'call' ? 'Call' : 'Message'}
          </Text>
        </View>
      </View>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {people.map((person) => (
          <Pressable key={person.id} onPress={() => (tap(), onPerson(person))} style={styles.personRow}>
            <Avatar person={person} size={30} />
            <Text variant="body" numberOfLines={1} style={{ flex: 1, fontSize: 14.5 }}>
              {person.name}
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add to ${info.title}`}
          onPress={() => (tap(), onAdd())}
          style={[styles.addRow, { borderColor: t.line }]}>
          <Icon name="plus" color={t.textMuted} size={16} />
          <Text variant="small" color="textMuted">
            {people.length ? 'Add' : 'Add someone'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
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
  axisRow: { flexDirection: 'row', gap: 12 },
  circleRow: { flexDirection: 'row', gap: 12, height: 206 },
  circleCard: { flex: 1, borderRadius: 22, borderWidth: 1, padding: 12, overflow: 'hidden' },
  circleTint: { position: 'absolute', top: 0, left: 0, right: 0, height: 60 },
  circleHead: { gap: 2, marginBottom: 8 },
  circleTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  circleMode: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 29 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  bigAvatar: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  step: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 4 },
  stepIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  history: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
});
