/**
 * Send a flower: a small illustrated card made from a flower the user has grown, with a short
 * line, shared as an image (the share menu offers WhatsApp) or as a WhatsApp text.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Flower } from '@/components/flower';
import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Button, Card, Input, Screen, tap } from '@/components/ui';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { FlowerKind, flowerOf, RARITY_LABEL } from '@/lib/flowers';
import { whatsapp } from '@/lib/reach';
import { shareViewAsImage } from '@/lib/share-image';
import { markReached, useAppState } from '@/lib/store';

export const FLOWER_LINES = [
  'Thinking of you',
  'You made my day',
  'Stay strong',
  'Get well soon',
  'Thank you',
  'Proud of you',
  'Happy Onam',
  'Happy Diwali',
  'Happy Pongal',
];

export default function SendFlower() {
  const t = useTheme();
  const params = useLocalSearchParams<{ flower?: string; person?: string }>();
  const garden = useAppState((s) => s.garden);
  const people = useAppState((s) => s.people);
  const myName = useAppState((s) => s.name);
  // Every kind grown at least once, most recent first.
  const kinds: FlowerKind[] = [];
  for (const b of garden) if (!kinds.some((k) => k.id === b.flower)) kinds.push(flowerOf(b.flower));
  const [flowerId, setFlowerId] = useState(params.flower ?? kinds[0]?.id);
  const [line, setLine] = useState(FLOWER_LINES[0]);
  const [custom, setCustom] = useState('');
  const [personId, setPersonId] = useState<string | undefined>(params.person);
  const [busy, setBusy] = useState(false);
  const card = useRef<View>(null);

  const flower = kinds.find((k) => k.id === flowerId) ?? kinds[0];
  const person = people.find((p) => p.id === personId);
  const message = custom.trim() || line;

  async function sendImage() {
    setBusy(true);
    const ok = await shareViewAsImage(card, 'Send your flower');
    setBusy(false);
    if (ok) {
      if (person) markReached(person.id);
    } else {
      const msg = 'Sharing a picture works in the Android app. You can still send the flower as a WhatsApp message.';
      if (Platform.OS === 'web') globalThis.alert?.(msg);
      else Alert.alert('Could not make the picture', msg);
    }
  }

  async function sendText() {
    if (!person?.phone) return;
    const text = `🌸 ${message}${person.name ? `, ${person.name.split(' ')[0]}` : ''}. A ${flower.name} from my garden${myName ? ` – ${myName}` : ''}`;
    if (await whatsapp(person.phone, text)) markReached(person.id);
  }

  return (
    <Screen>
      <Pressable hitSlop={12} onPress={() => (tap(), router.back())} accessibilityLabel="Back" style={{ height: 32, justifyContent: 'center' }}>
        <Icon name="back" color={t.textSecondary} />
      </Pressable>
      <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 4 }}>
        <Text variant="label">Send a flower</Text>
        <Text variant="title">A little something from your garden.</Text>
      </Animated.View>

      {!flower ? (
        <Card>
          <Text variant="small">Grow your first flower (check in, finish a task or a focus session), then send it to someone.</Text>
        </Card>
      ) : (
        <>
          <View style={{ alignItems: 'center' }}>
            <View ref={card} collapsable={false} style={styles.cardShadow}>
              <FlowerCard flower={flower} message={message} to={person?.name} from={myName} />
            </View>
          </View>

          <Card>
            <Text variant="label">Flower · from your garden</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {kinds.map((k) => (
                <Pressable
                  key={k.id}
                  onPress={() => (tap(), setFlowerId(k.id))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: k.id === flower.id }}
                  accessibilityLabel={k.name}
                  style={[styles.kind, { borderColor: k.id === flower.id ? t.brand : t.line, backgroundColor: t.surface }]}>
                  <Flower kind={k} size={40} />
                  <Text variant="micro" strong numberOfLines={1} style={{ color: t.text }}>
                    {k.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text variant="label">Message</Text>
            <View style={styles.wrap}>
              {FLOWER_LINES.map((l) => {
                const on = !custom.trim() && l === line;
                return (
                  <Pressable key={l} onPress={() => (tap(), setLine(l), setCustom(''))} style={[styles.chip, { borderColor: on ? t.brand : t.line, backgroundColor: on ? t.brand : t.surface }]}>
                    <Text variant="small" strong style={{ color: on ? t.brandText : t.text }}>{l}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Input value={custom} onChangeText={setCustom} placeholder="Or write your own line" maxLength={60} />

            <Text variant="label">For</Text>
            <View style={styles.wrap}>
              <Pressable onPress={() => (tap(), setPersonId(undefined))} style={[styles.chip, { borderColor: !person ? t.brand : t.line, backgroundColor: !person ? t.brand : t.surface }]}>
                <Text variant="small" strong style={{ color: !person ? t.brandText : t.text }}>Anyone</Text>
              </Pressable>
              {people.map((p) => {
                const on = p.id === personId;
                return (
                  <Pressable key={p.id} onPress={() => (tap(), setPersonId(p.id))} style={[styles.chip, { borderColor: on ? t.brand : t.line, backgroundColor: on ? t.brand : t.surface }]}>
                    <Text variant="small" strong style={{ color: on ? t.brandText : t.text }}>{p.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Button title="Send the picture" icon="image" loading={busy} onPress={sendImage} />
          <Text variant="small" center>
            Choose WhatsApp in the share menu, then {person ? person.name.split(' ')[0] : 'the person'}.
          </Text>
          {person?.phone && <Button title={`WhatsApp ${person.name.split(' ')[0]} a text instead`} icon="chat" kind="secondary" onPress={sendText} />}
        </>
      )}
    </Screen>
  );
}

/** The card itself: the flower on a soft wash of its own colours, the line, and who it is for. */
export function FlowerCard({ flower, message, to, from }: { flower: FlowerKind; message: string; to?: string; from?: string }) {
  return (
    <LinearGradient colors={[flower.petalInner + '55', '#FFFDF8', flower.petal + '40']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      {!!to && <Text style={[styles.small, { alignSelf: 'flex-start' }]}>For {to}</Text>}
      <View style={[styles.glow, { backgroundColor: flower.petalInner + '66' }]} />
      <Flower kind={flower} size={150} stem />
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.small}>
        A {flower.name} · {RARITY_LABEL[flower.rarity]}
        {from ? ` · from ${from}` : ''}
      </Text>
      <Text style={[styles.small, styles.tiny]}>grown in Daybloom</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  cardShadow: { borderRadius: 28, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5, backgroundColor: '#FFFDF8' },
  card: { width: 290, borderRadius: 28, padding: 22, alignItems: 'center', gap: 8, overflow: 'hidden' },
  glow: { position: 'absolute', top: 60, width: 170, height: 170, borderRadius: 85 },
  message: { fontFamily: Fonts.displayItalic, fontSize: 26, lineHeight: 32, color: '#1D1B18', textAlign: 'center', marginTop: 6 },
  small: { fontFamily: Fonts.bodyStrong, fontSize: 12, color: '#5A544C', textAlign: 'center' },
  // The shared card keeps its own fixed palette and sizes: it is a picture, not app UI.
  tiny: { opacity: 0.6, fontSize: 10.5 },
  kind: { width: 70, alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1.5 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1 },
});
