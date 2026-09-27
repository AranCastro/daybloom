/** "Where are you?" after the check-in: the user's own places, optionally pinned with GPS. */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Backdrop, Button, Input, tap } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Coords, currentCoords, nearestPlace, PLACE_EMOJI, PLACE_IDEAS } from '@/lib/places';
import { addPlace, setCheckinPlace, useAppState } from '@/lib/store';

export function PlacePicker({ day }: { day: string }) {
  const t = useTheme();
  const places = useAppState((s) => s.places);
  const chosen = useAppState((s) => s.checkinPlace[day]);
  const [adding, setAdding] = useState(false);
  const [near, setNear] = useState<string | null>(null);

  // If some places are pinned and location is already allowed, suggest the one nearby.
  const pinned = places.some((p) => p.lat !== undefined);
  useEffect(() => {
    if (!pinned || chosen) return;
    let live = true;
    currentCoords(false).then((here) => {
      const p = here ? nearestPlace(places, here) : null;
      if (live && p) setNear(p.id);
    });
    return () => {
      live = false;
    };
  }, [pinned, chosen, places]);

  return (
    <View style={{ gap: 8, alignSelf: 'stretch' }}>
      <View style={styles.head}>
        <Icon name="pin" color={t.textSecondary} size={16} />
        <Text variant="label" style={{ flex: 1 }}>
          Where are you? (optional)
        </Text>
        {places.length > 0 && (
          <Pressable onPress={() => (tap(), router.push('/places'))} hitSlop={8} accessibilityRole="button">
            <Text variant="small" color="accent" style={{ fontSize: 12.5 }}>
              Where you feel best
            </Text>
          </Pressable>
        )}
      </View>
      <View style={styles.wrap}>
        {places.map((p) => {
          const on = chosen === p.id;
          const hint = !chosen && near === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => (tap(), setCheckinPlace(day, p.id))}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={hint ? `${p.name}, you seem to be here` : p.name}
              style={[
                styles.chip,
                { borderColor: on ? t.brand : hint ? t.accent : t.line, backgroundColor: on ? t.brand : t.surface, borderStyle: hint ? 'dashed' : 'solid' },
              ]}>
              <Text style={{ fontSize: 15 }}>{p.emoji}</Text>
              <Text style={{ fontFamily: Fonts.bodyStrong, fontSize: 13, color: on ? t.brandText : t.text }}>
                {hint ? `Near ${p.name}?` : p.name}
              </Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => (tap(), setAdding(true))} accessibilityRole="button" style={[styles.chip, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
          <Text style={{ fontFamily: Fonts.bodyStrong, fontSize: 13, color: t.text }}>＋ {places.length ? 'Place' : 'Add a place'}</Text>
        </Pressable>
      </View>
      {adding && <AddPlace onClose={() => setAdding(false)} onAdded={(id) => setCheckinPlace(day, id)} />}
    </View>
  );
}

/** Name a place, pick an icon, and optionally pin it with the phone's location. */
export function AddPlace({ onClose, onAdded }: { onClose: () => void; onAdded?: (id: string) => void }) {
  const t = useTheme();
  const existing = useAppState((s) => s.places);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string>('🏠');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | undefined>();
  const ideas = PLACE_IDEAS.filter((i) => !existing.some((p) => p.name.toLowerCase() === i.name.toLowerCase()));

  async function pin() {
    setLocating(true);
    const here = await currentCoords(true);
    setLocating(false);
    if (here) {
      setCoords(here);
      setNote(undefined);
    } else setNote('Location is off or not allowed. The place still works without it.');
  }

  function save() {
    const p = addPlace(name, emoji, coords ?? undefined);
    onAdded?.(p.id);
    onClose();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: t.background }]}>
        <Backdrop />
        <ScrollView contentContainerStyle={{ gap: 12, padding: 22 }} keyboardShouldPersistTaps="handled">
          <Text variant="title">A new place</Text>
          {ideas.length > 0 && (
            <View style={styles.wrap}>
              {ideas.map((i) => (
                <Pressable key={i.name} onPress={() => (tap(), setName(i.name), setEmoji(i.emoji))} style={[styles.chip, { borderColor: t.line, backgroundColor: t.surface }]}>
                  <Text style={{ fontSize: 15 }}>{i.emoji}</Text>
                  <Text style={{ fontFamily: Fonts.bodyStrong, fontSize: 13, color: t.text }}>{i.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Input value={name} onChangeText={setName} placeholder="Name, e.g. Office" maxLength={24} />
          <View style={styles.wrap}>
            {PLACE_EMOJI.map((e) => (
              <Pressable
                key={e}
                onPress={() => (tap(), setEmoji(e))}
                accessibilityRole="radio"
                accessibilityState={{ selected: emoji === e }}
                style={[styles.emoji, { borderColor: emoji === e ? t.brand : t.line, backgroundColor: emoji === e ? t.surfaceAlt : t.surface }]}>
                <Text style={{ fontSize: 20 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={pin} disabled={locating} accessibilityRole="button" style={[styles.pin, { borderColor: coords ? t.brand : t.line, backgroundColor: t.surface }]}>
            <Icon name="pin" color={coords ? t.brand : t.textSecondary} size={20} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{coords ? 'Pinned here' : locating ? 'Finding you…' : 'Pin with GPS (optional)'}</Text>
              <Text variant="small" style={{ fontSize: 12 }}>
                {coords
                  ? `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)} (WGS 84) · kept on this phone`
                  : 'Lets Daybloom suggest this place when you are near it, and draw it on your map.'}
              </Text>
            </View>
          </Pressable>
          {!!note && <Text variant="small">{note}</Text>}
          <Button title="Save place" icon="check" disabled={!name.trim()} onPress={save} />
          <Button title="Cancel" kind="quiet" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  emoji: { width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pin: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1.5 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
});
