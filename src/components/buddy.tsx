/**
 * The nudge buddy: who it is (chosen, or automatically the first person in Call anytime),
 * how to change it, and the one-tap card that appears after a few low days.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { Avatar } from '@/components/people';
import { Text } from '@/components/text';
import { Button, Card, Divider, tap } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useCircleNames } from '@/lib/labels';
import { canPickContacts, pickContact } from '@/lib/pick-contact';
import { sms, whatsapp } from '@/lib/reach';
import {
  addPerson,
  dismissNudge,
  markNudgeOpened,
  nudgeMessage,
  Person,
  resolveBuddy,
  setBuddy,
  todaysNudge,
  useAppState,
} from '@/lib/store';

/** Re-renders when the buddy (or the people it depends on) changes. */
export function useBuddy(): { buddy: Person | null; automatic: boolean } {
  const people = useAppState((s) => s.people);
  const buddyId = useAppState((s) => s.buddyId);
  const buddy = resolveBuddy({ people, buddyId });
  return { buddy, automatic: !buddyId || buddy?.id !== buddyId };
}

async function send(via: 'sms' | 'whatsapp', buddy: Person, myName: string) {
  if (!buddy.phone) return;
  const text = nudgeMessage(buddy.name.split(' ')[0], myName);
  const ok = via === 'sms' ? await sms(buddy.phone, text) : await whatsapp(buddy.phone, text);
  if (ok) markNudgeOpened();
}

/** Shown on Today when the low-days rule has been met: one tap opens the message, ready to send. */
export function NudgeReadyCard() {
  const t = useTheme();
  const nudges = useAppState((s) => s.nudges);
  const myName = useAppState((s) => s.name);
  const { buddy } = useBuddy();
  const n = todaysNudge({ nudges });
  if (!n || !buddy) return null;
  const first = buddy.name.split(' ')[0];

  if (n.status === 'opened') {
    return (
      <Card tone="accent">
        <View style={styles.row}>
          <Icon name="heart" color={t.accent} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            Your message to {first} is ready. Press Send in your messages app.
          </Text>
        </View>
        <Text variant="small">They will only see a request to call. Nothing about your answers is shared.</Text>
      </Card>
    );
  }

  return (
    <Animated.View entering={FadeInDown.delay(120)}>
      <Card tone="accent">
        <View style={styles.row}>
          <Avatar person={buddy} size={44} />
          <View style={{ flex: 1 }}>
            <Text variant="label">A few hard days</Text>
            <Text variant="heading">Ask {first} to call you today?</Text>
          </View>
        </View>
        <Text variant="small">One tap writes “{nudgeMessage(first, myName)}”. You press Send.</Text>
        {buddy.phone ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="SMS" icon="chat" onPress={() => send('sms', buddy, myName)} style={{ flex: 1 }} />
            <Button title="WhatsApp" icon="send" kind="secondary" onPress={() => send('whatsapp', buddy, myName)} style={{ flex: 1 }} />
          </View>
        ) : (
          <Button title={`Add ${first}'s phone number`} icon="phone" kind="secondary" onPress={() => router.navigate('/circle')} />
        )}
        <Pressable onPress={() => (tap(), dismissNudge())} style={{ alignSelf: 'center', padding: 6 }}>
          <Text variant="small" color="textMuted">
            Not now
          </Text>
        </Pressable>
      </Card>
    </Animated.View>
  );
}

/** Buddy section for the People tab: who it is and how to change it. */
export function BuddyCard() {
  const t = useTheme();
  const { buddy, automatic } = useBuddy();
  const people = useAppState((s) => s.people);
  const myName = useAppState((s) => s.name);
  const cName = useCircleNames();
  const [choosing, setChoosing] = useState(false);
  const [note, setNote] = useState('');

  async function fromContacts() {
    const c = await pickContact();
    if (!c?.name) return;
    const existing = people.find((p) => p.name.trim().toLowerCase() === c.name.trim().toLowerCase());
    const person = existing ?? addPerson(c.name, 1, c.phone);
    setBuddy(person.id);
    setNote(existing ? '' : `${c.name} was added to ${cName(1)}.`);
  }

  return (
    <Card style={{ gap: 12 }}>
      {buddy ? (
        <View style={styles.row}>
          <Avatar person={buddy} size={56} />
          <View style={{ flex: 1 }}>
            <Text variant="title" style={{ fontSize: 24, lineHeight: 30 }}>
              {buddy.name}
            </Text>
            <Text variant="small">
              {automatic ? `Automatic: the first person in ${cName(1)}` : 'Chosen by you'}
              {buddy.phone ? '' : ' · no phone number yet'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          <Text variant="heading">No buddy yet</Text>
          <Text variant="small">
            Pick someone from your contacts, or add a person to {cName(1)}: the first one there becomes your buddy
            automatically.
          </Text>
        </View>
      )}
      {buddy && (
        <Text variant="small" color="textSecondary">
          After a few low days, you will be offered one tap to send: “{nudgeMessage(buddy.name.split(' ')[0], myName)}”
        </Text>
      )}
      {canPickContacts && <Button title="Choose from contacts" icon="people" onPress={fromContacts} />}
      {people.length > 0 && (
        <Button title="Choose from your circle" icon="heart" kind="secondary" onPress={() => (tap(), setChoosing(true))} />
      )}
      {!automatic && (
        <Pressable onPress={() => (tap(), setBuddy(null), setNote(''))} style={{ alignSelf: 'center', padding: 6 }}>
          <Text variant="small" color="accent">
            Use automatic (first in {cName(1)})
          </Text>
        </Pressable>
      )}
      {!!note && (
        <Text variant="small" center>
          {note}
        </Text>
      )}

      <Modal visible={choosing} transparent animationType="slide" onRequestClose={() => setChoosing(false)}>
        <Pressable style={styles.scrim} onPress={() => setChoosing(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: t.surface }]}>
          <View style={[styles.grabber, { backgroundColor: t.line }]} />
          <Text variant="heading">Choose your buddy</Text>
          <ScrollView style={{ marginTop: 10 }}>
            {people.map((p, i) => (
              <View key={p.id}>
                {i > 0 && <Divider />}
                <Pressable
                  onPress={() => (tap(), setBuddy(p.id), setChoosing(false), setNote(''))}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: buddy?.id === p.id }}
                  aria-checked={buddy?.id === p.id}
                  style={[styles.row, { paddingVertical: 10 }]}>
                  <Avatar person={p} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{p.name}</Text>
                    <Text variant="small">
                      {cName(p.quadrant)}
                      {p.phone ? '' : ' · no phone number'}
                    </Text>
                  </View>
                  {buddy?.id === p.id && <Icon name="check" color={t.accent} size={20} />}
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scrim: { flex: 1, backgroundColor: 'rgba(10,8,6,0.38)' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 36, maxHeight: '75%' },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
});
