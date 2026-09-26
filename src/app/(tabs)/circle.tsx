import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BuddyCard, useBuddy } from '@/components/buddy';
import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Card, Divider, Screen, tap } from '@/components/ui';
import { TabBarInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCircleNames } from '@/lib/labels';
import { prettyDate } from '@/lib/dates';
import { Avatar, CircleChip, PersonSheet, useCircleColors } from '@/components/people';
import { CIRCLE, circleOf } from '@/lib/circle';
import { CircleQuadrant, Person, peopleIn, useAppState } from '@/lib/store';

export default function Circle() {
  const nudges = useAppState((s) => s.nudges);
  const streak = useAppState((s) => s.streak);
  const cName = useCircleNames();
  const { buddy } = useBuddy();
  const autos = nudges.filter((n) => n.kind === 'auto');

  return (
    <Screen bottomInset={TabBarInset + 24}>
      <Animated.View entering={FadeInDown.duration(450)} style={{ gap: 4, marginTop: 8 }}>
        <Text variant="label">Your circle</Text>
        <Text variant="title">Who lifts you{'\n'}on a low day?</Text>
        <Text variant="small">Sort the people you trust by how close they are and how you reach them.</Text>
      </Animated.View>

      <CircleMatrix />

      <View style={{ gap: 4, marginTop: 12 }}>
        <Text variant="label">Your buddy</Text>
        <Text variant="heading">One person to reach on hard days.</Text>
      </View>

      <BuddyCard />

      <Card>
        <Text variant="label">How the nudge works</Text>
        <Step icon="sun" text="You tap how each day feels. Your answers stay on this phone (and in backups you choose to make)." />
        <Step
          icon="bell"
          text={`After ${streak} low days in a row, Daybloom offers to message ${buddy?.name.split(' ')[0] ?? 'your buddy'}: one tap opens SMS or WhatsApp with the message written.`}
        />
        <Step icon="lock" text="You press Send. Nothing is sent without you, and the message never mentions your mood." />
        <Step icon="heart" text={`One offer per rough patch. A better day resets it. No setup or app is needed for your buddy; they are the first person in ${cName(1)} unless you choose someone.`} />
      </Card>

      {autos.length > 0 && (
        <Card>
          <Text variant="label">Nudge history</Text>
          {autos.slice(0, 8).map((n, i) => (
            <View key={n.at}>
              {i > 0 && <Divider />}
              <View style={styles.history}>
                <Text variant="body">{n.to ? `Offered to message ${n.to}` : 'Nudge'}</Text>
                <Text variant="small">
                  {prettyDate(new Date(n.at))}
                  {n.status === 'opened' ? ' · message opened' : n.status === 'dismissed' ? ' · not now' : n.status === 'ready' ? ' · waiting for you' : ''}
                </Text>
              </View>
            </View>
          ))}
        </Card>
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
  const name = useCircleNames()(q);
  return (
    <View style={[styles.circleCard, { backgroundColor: t.surface, borderColor: t.line }]}>
      <View style={[styles.circleTint, { backgroundColor: soft }]} />
      <View style={styles.circleHead}>
        <View style={styles.circleTitle}>
          <CircleChip q={q} size={22} />
          <Text variant="heading" style={{ color, fontSize: 15.5, lineHeight: 20, flex: 1 }} numberOfLines={1} adjustsFontSizeToFit>
            {name}
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
          accessibilityLabel={`Add to ${name}`}
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
