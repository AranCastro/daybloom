/**
 * Thottam (Malayalam: garden). Arrange the flowers you have grown into a Poo Kolam, ring by
 * ring, with an Onam, Diwali or Pongal border; save your designs and share them as a picture.
 */
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Flower } from '@/components/flower';
import { Icon } from '@/components/icons';
import { PookalamArt } from '@/components/pookalam';
import { Text } from '@/components/text';
import { Button, Card, Input, Screen, tap } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { fromKey } from '@/lib/dates';
import { flowerOf } from '@/lib/flowers';
import { shareViewAsImage } from '@/lib/share-image';
import { deletePookalam, Pookalam, PookalamRing, savePookalam, useAppState } from '@/lib/store';
import { FESTIVALS, festivalNear, PATTERNS, surprise } from '@/lib/thottam';

const MAX_RINGS = 6;

export default function Thottam() {
  const t = useTheme();
  const today = useToday();
  const garden = useAppState((s) => s.garden);
  const saved = useAppState((s) => s.pookalams);
  const kinds: string[] = [];
  for (const b of garden) if (!kinds.includes(b.flower)) kinds.push(b.flower);
  const season = festivalNear(fromKey(today));

  const [id, setId] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [center, setCenter] = useState(kinds[0] ?? 'marigold');
  const [rings, setRings] = useState<PookalamRing[]>(() =>
    kinds.length ? [0, 1, 2].map((i) => ({ flower: kinds[i % kinds.length], pattern: (['petals', 'solid', 'alternate'] as const)[i] })) : [],
  );
  const [festival, setFestival] = useState<Pookalam['festival']>(season ?? 'onam');
  const [sel, setSel] = useState<number>(-1); // -1 = centre
  const [busy, setBusy] = useState(false);
  const art = useRef<View>(null);
  // Measured from the column, so the art sits inside the screen gutter.
  const [avail, setAvail] = useState(0);
  const size = Math.min(avail, 420);

  if (!kinds.length) {
    return (
      <Screen>
        <Back />
        <Text variant="title">Thottam</Text>
        <Card>
          <Text variant="body">Your Poo Kolam is made from the flowers you grow. Check in, finish a task or a focus session to grow your first one.</Text>
        </Card>
      </Screen>
    );
  }

  const selFlower = sel === -1 ? center : rings[sel]?.flower;
  const setFlower = (f: string) => {
    tap();
    if (sel === -1) setCenter(f);
    else setRings(rings.map((r, i) => (i === sel ? { ...r, flower: f } : r)));
  };
  const setPattern = (p: PookalamRing['pattern']) => {
    tap();
    setRings(rings.map((r, i) => (i === sel ? { ...r, pattern: p } : r)));
  };
  const addRing = () => {
    tap();
    if (rings.length >= MAX_RINGS) return;
    setRings([...rings, { flower: kinds[rings.length % kinds.length], pattern: 'petals' }]);
    setSel(rings.length);
  };
  const removeRing = () => {
    tap();
    if (rings.length <= 1) return;
    setRings(rings.slice(0, -1));
    setSel(Math.min(sel, rings.length - 2));
  };
  const load = (p: Pookalam) => {
    tap();
    setId(p.id);
    setName(p.name);
    setCenter(p.center);
    setRings(p.rings);
    setFestival(p.festival);
    setSel(-1);
  };
  const save = () => {
    tap();
    const p = savePookalam({ id, name: name.trim() || `Poo Kolam ${saved.length + 1}`, center, rings, festival });
    setId(p.id);
    setName(p.name);
  };
  const share = async () => {
    setBusy(true);
    const ok = await shareViewAsImage(art, 'Share your Poo Kolam');
    setBusy(false);
    if (!ok) {
      const msg = 'Saving a picture works in the Android app.';
      if (Platform.OS === 'web') globalThis.alert?.(msg);
      else Alert.alert('Could not make the picture', msg);
    }
  };
  const fresh = () => {
    tap();
    const d = surprise(kinds, festival);
    setId(undefined);
    setName('');
    setCenter(d.center);
    setRings(d.rings);
    setSel(-1);
  };

  return (
    <Screen>
      <Back />
      <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 4 }}>
        <Text variant="label">Thottam</Text>
        <Text variant="title">Your Poo Kolam.</Text>
        <Text variant="small">Ring by ring, from the {kinds.length} kinds of flower you have grown.</Text>
      </Animated.View>

      {season && (
        <Card tone="accent">
          <Text variant="bodyStrong">
            {season === 'onam' ? 'Onam season. Make a Poo Kolam for Thiruvonam.' : season === 'diwali' ? 'Diwali season. Light it up with diyas.' : 'Pongal season. Add a kolam to your doorstep.'}
          </Text>
        </Card>
      )}

      <View style={{ alignItems: 'center', minHeight: size || 300 }} onLayout={(e) => setAvail(Math.floor(e.nativeEvent.layout.width))}>
        {size > 0 && (
          <View ref={art} collapsable={false} style={{ borderRadius: size * 0.08, overflow: 'hidden' }}>
            <PookalamArt design={{ center, rings, festival }} size={size} />
          </View>
        )}
      </View>

      <Card>
        <Text variant="label">Border</Text>
        <View style={styles.wrap}>
          {FESTIVALS.map((f) => {
            const on = f.id === festival;
            return (
              <Pressable key={f.id} onPress={() => (tap(), setFestival(f.id))} style={[styles.chip, { borderColor: on ? t.brand : t.line, backgroundColor: on ? t.brand : t.surface }]}>
                <Text variant="small" strong style={{ color: on ? t.brandText : t.text }}>
                  {f.label}
                </Text>
                <Text variant="micro" style={{ color: on ? t.brandText : t.textSecondary }}>
                  {f.blurb}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="label">Rings</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
          {[-1, ...rings.map((_, i) => i)].map((i) => {
            const on = i === sel;
            const f = flowerOf(i === -1 ? center : rings[i].flower);
            return (
              <Pressable key={i} onPress={() => (tap(), setSel(i))} style={[styles.ringChip, { borderColor: on ? t.brand : t.line, backgroundColor: on ? t.surfaceAlt : t.surface }]}>
                <View style={[styles.swatch, { backgroundColor: f.petal }]} />
                <Text variant="small" strong color="text">
                  {i === -1 ? 'Centre' : `Ring ${i + 1}`}
                </Text>
              </Pressable>
            );
          })}
          {rings.length < MAX_RINGS && (
            <Pressable onPress={addRing} accessibilityLabel="Add a ring" style={[styles.ringChip, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
              <Icon name="plus" color={t.text} size={16} />
            </Pressable>
          )}
          {rings.length > 1 && (
            <Pressable onPress={removeRing} accessibilityLabel="Remove the outer ring" style={[styles.ringChip, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
              <Text variant="bodyStrong">−</Text>
            </Pressable>
          )}
        </ScrollView>

        <Text variant="label">{sel === -1 ? 'Centre flower' : `Ring ${sel + 1} flower`}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {kinds.map((k) => {
            const f = flowerOf(k);
            const on = k === selFlower;
            return (
              <Pressable key={k} onPress={() => setFlower(k)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={f.name} style={[styles.kind, { borderColor: on ? t.brand : t.line, backgroundColor: t.surface }]}>
                <Flower kind={f} size={36} />
                <Text variant="micro" strong color="text" numberOfLines={1}>
                  {f.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {sel >= 0 && (
          <>
            <Text variant="label">Pattern</Text>
            <View style={styles.wrap}>
              {PATTERNS.map((p) => {
                const on = rings[sel]?.pattern === p.id;
                return (
                  <Pressable key={p.id} onPress={() => setPattern(p.id)} style={[styles.chip, { borderColor: on ? t.brand : t.line, backgroundColor: on ? t.brand : t.surface }]}>
                    <Text variant="small" strong style={{ color: on ? t.brandText : t.text }}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </Card>

      <Input value={name} onChangeText={setName} placeholder="Name it, e.g. Thiruvonam 2026" maxLength={32} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title={id ? 'Save changes' : 'Save'} icon="check" onPress={save} style={{ flex: 1 }} />
        <Button title="Share picture" icon="image" kind="secondary" loading={busy} onPress={share} style={{ flex: 1 }} />
      </View>
      <Button title="Surprise me" icon="spark" kind="quiet" onPress={fresh} />

      {saved.length > 0 && (
        <Card>
          <Text variant="label">Your Poo Kolams · {saved.length}</Text>
          <View style={styles.gallery}>
            {saved.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => load(p)}
                onLongPress={() => {
                  const go = () => deletePookalam(p.id);
                  if (Platform.OS === 'web') {
                    if (globalThis.confirm?.(`Delete ${p.name}?`)) go();
                  } else Alert.alert(`Delete ${p.name}?`, undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}. Tap to open, hold to delete`}
                style={[styles.thumb, { borderColor: p.id === id ? t.brand : 'transparent' }]}>
                {/* Thumbnails skip the petal detail: up to 60 full designs would be thousands of SVG nodes. */}
                <PookalamArt design={p} size={96} thumb />
                <Text variant="micro" strong color="text" style={{ maxWidth: 96 }} numberOfLines={1}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text variant="caption">
            Tap to open, hold to delete.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

function Back() {
  const t = useTheme();
  return (
    <Pressable hitSlop={12} onPress={() => (tap(), router.back())} accessibilityLabel="Back" style={{ height: 32, justifyContent: 'center' }}>
      <Icon name="back" color={t.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.md, borderWidth: 1 },
  ringChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 38, borderRadius: Radius.pill, borderWidth: 1.5 },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  kind: { width: 68, alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1.5 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumb: { alignItems: 'center', gap: 4, borderWidth: 2, borderRadius: Radius.sm, padding: 2 },
});
