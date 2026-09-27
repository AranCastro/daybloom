/** Focus sounds: a grid of seven built-in sounds (and Off), each with its own icon and colour. */
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Card, Choice, tap } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { previewSound, stopSound } from '@/lib/focus-sound';
import { ragaForHour, soundOf, SOUNDS } from '@/lib/sounds';
import { useClock } from '@/hooks/use-today';
import { setSettings, useAppState } from '@/lib/store';

const VOLUMES = [
  { label: 'Soft', value: 0.35 },
  { label: 'Medium', value: 0.6 },
  { label: 'Loud', value: 0.9 },
];

/** While a session runs with a sound: a small chip under the timer, tap to silence. */
export function NowPlaying() {
  const t = useTheme();
  const id = useAppState((s) => s.settings.focusSound);
  const current = SOUNDS.find((x) => x.id === id);
  if (!current) return null;
  return (
    <Pressable
      onPress={() => (tap(), setSettings({ focusSound: 'off' }))}
      accessibilityRole="button"
      accessibilityLabel={`${current.label} playing. Tap to turn the sound off`}
      style={[styles.now, { backgroundColor: current.tint + '22', borderColor: current.tint }]}>
      <Icon name={current.icon} color={current.tint} size={16} />
      <Text style={{ fontFamily: Fonts.bodyStrong, fontSize: 12.5, color: t.text }}>{current.label}</Text>
      <Icon name="mute" color={t.textSecondary} size={15} />
    </Pressable>
  );
}

export function SoundPicker({ running }: { running: boolean }) {
  const t = useTheme();
  const dark = useIsDark();
  const sound = useAppState((s) => s.settings.focusSound);
  const volume = useAppState((s) => s.settings.focusVolume);
  const current = SOUNDS.find((x) => x.id === sound);
  const { hour } = useClock();
  const suits = soundOf(ragaForHour(hour) ?? undefined);

  function choose(id: string) {
    tap();
    setSettings({ focusSound: id });
    // While a session runs, the sound follows the setting straight away; otherwise play a short preview.
    if (running) return;
    const pick = SOUNDS.find((x) => x.id === id);
    if (pick) void previewSound(pick.id, volume);
    else stopSound();
  }

  return (
    <Card>
      <View style={styles.head}>
        <Text variant="label">Focus sound</Text>
        <Text variant="small" color="textMuted" style={{ fontSize: 12 }}>
          {current ? (running ? `Playing · ${current.label}` : 'Plays during focus · tap to hear') : 'Silence'}
        </Text>
      </View>
      <View style={styles.grid}>
        <Tile label="Off" blurb="Silence" icon="mute" tint={t.textSecondary} on={!current} onPress={() => choose('off')} dark={dark} />
        {SOUNDS.map((x) => (
          <Tile key={x.id} label={x.label} blurb={x.blurb} icon={x.icon} tint={x.tint} on={x.id === sound} onPress={() => choose(x.id)} dark={dark} />
        ))}
      </View>
      {suits && suits.id !== sound && (
        <Pressable onPress={() => choose(suits.id)} accessibilityRole="button" style={[styles.suggest, { backgroundColor: suits.tint + '1A' }]}>
          <Icon name={suits.icon} color={suits.tint} size={16} />
          <Text variant="small" style={{ flex: 1, fontSize: 12.5 }}>
            {suits.id === 'raga-bhairav' ? 'Morning is the time for Raga Bhairav.' : 'Evening is the time for Raga Yaman.'} Tap to try it.
          </Text>
        </Pressable>
      )}
      {current && (
        <Animated.View entering={FadeIn.duration(250)} style={{ gap: 8 }}>
          <Text variant="small" center>
            {current.label} · {current.blurb}
          </Text>
          <View style={styles.volHead}>
            <Icon name="volume" color={t.textSecondary} size={18} />
            <Text variant="bodyStrong" style={{ fontSize: 14 }}>
              Volume
            </Text>
          </View>
          <Choice options={VOLUMES} value={VOLUMES.reduce((a, b) => (Math.abs(b.value - volume) < Math.abs(a.value - volume) ? b : a)).value} onChange={(v) => setSettings({ focusVolume: v })} />
          {current.id === 'gamma' && (
            <Text variant="small" style={{ fontSize: 12 }}>
              Gamma plays 200 Hz in one ear and 240 Hz in the other; use headphones to hear the 40 Hz beat.
            </Text>
          )}
        </Animated.View>
      )}
    </Card>
  );
}

function Tile({ label, blurb, icon, tint, on, onPress, dark }: { label: string; blurb: string; icon: Parameters<typeof Icon>[0]['name']; tint: string; on: boolean; onPress: () => void; dark: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${label}. ${blurb}`}
      style={({ pressed }) => [
        styles.tile,
        { borderColor: on ? tint : t.line, backgroundColor: on ? tint + (dark ? '33' : '1F') : t.surface, transform: [{ scale: pressed ? 0.96 : 1 }] },
      ]}>
      <View style={[styles.iconBubble, { backgroundColor: on ? tint : tint + '26' }]}>
        <Icon name={icon} color={on ? '#fff' : tint} size={22} />
      </View>
      <Text style={{ fontFamily: Fonts.bodyStrong, fontSize: 11.5, lineHeight: 14, color: t.text, textAlign: 'center' }} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  tile: { width: '23%', minWidth: 72, minHeight: 96, alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 3, borderRadius: 18, borderWidth: 1.5 },
  iconBubble: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 14 },
  now: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  volHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
});
