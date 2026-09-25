/** Shared garden visuals: the illustrated bed, the "a flower bloomed" toast and the ways to grow. */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Flower } from '@/components/flower';
import { haptic } from '@/components/games/fx';
import { Icon, IconName } from '@/components/icons';
import { Text } from '@/components/text';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { FlowerKind, flowerOf, RARITY_LABEL } from '@/lib/flowers';
import { Bloom, BloomSource, onBloom } from '@/lib/store';

export const SOURCES: Record<BloomSource, { label: string; icon: IconName; rule: string }> = {
  checkin: { label: 'Daily check-in', icon: 'sun', rule: 'One flower a day' },
  task: { label: 'Finish a task', icon: 'grid', rule: 'One per task' },
  focus: { label: 'Focus session', icon: 'clock', rule: 'One per session' },
  game: { label: 'Play a game', icon: 'play', rule: 'One per game a day' },
  reach: { label: 'Reach out', icon: 'phone', rule: 'One a day' },
  badge: { label: 'Earn a badge', icon: 'star', rule: 'Always a rare flower' },
};

/** A small landscape: sky, hills and grass, with flowers planted in staggered rows (newest in front). */
export function GardenBed({ blooms, max = 24, height = 220 }: { blooms: Bloom[]; max?: number; height?: number }) {
  const dark = useIsDark();
  const shown = blooms.slice(0, max);
  const perRow = 6;
  const rows = Math.max(1, Math.ceil(shown.length / perRow));
  const size = Math.min(58, (height - 40) / Math.max(rows, 2) + 18);
  return (
    <View style={[styles.bed, { height }]}>
      <LinearGradient colors={dark ? ['#1E2B3A', '#2A3B34'] : ['#E4F0F6', '#F4EEDC']} style={StyleSheet.absoluteFill} />
      <View style={[styles.hill, { backgroundColor: dark ? '#23382E' : '#CFE3C3', left: -40, width: '70%' }]} />
      <View style={[styles.hill, { backgroundColor: dark ? '#1F3329' : '#BFD9B0', right: -50, width: '75%', height: height * 0.62 }]} />
      <LinearGradient colors={dark ? ['#294536', '#1B2E24'] : ['#A9D39A', '#7FB872']} style={[styles.grass, { height: height * 0.5 }]} />
      {shown.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="small" center style={{ color: dark ? '#CFE3C3' : '#3F6B45' }}>
            Your garden is waiting for its first flower.
          </Text>
        </View>
      ) : (
        // Oldest at the back (top), newest at the front (bottom).
        [...shown].reverse().map((b, i) => {
          const row = Math.floor(i / perRow);
          const col = i % perRow;
          const back = rows - 1 - row; // 0 = front row
          const y = height - 18 - size - back * (size * 0.52);
          const x = ((col + (row % 2 ? 0.5 : 0.1)) / perRow) * 100;
          const s = size * (1 - back * 0.1);
          return (
            <View key={b.id} style={{ position: 'absolute', left: `${Math.min(x, 88)}%`, top: y, zIndex: row }}>
              <Flower kind={flowerOf(b.flower)} size={s} stem />
            </View>
          );
        })
      )}
    </View>
  );
}

/** Global toast: slides down when any activity grows a flower. Tap to open the garden. */
export function BloomToast() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<{ bloom: Bloom; kind: FlowerKind } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const off = onBloom((bloom, kind) => {
      haptic.light();
      setItem({ bloom, kind });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setItem(null), 2800);
    });
    return () => {
      off();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!item) return null;
  const src = SOURCES[item.bloom.source];
  return (
    <Animated.View
      key={item.bloom.id}
      entering={FadeInUp.springify().damping(14)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.toastWrap, { top: insets.top + 8 }]}
      pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`A ${item.kind.name} bloomed. Open garden`}
        onPress={() => {
          setItem(null);
          router.navigate('/journey');
        }}
        style={[styles.toast, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Flower kind={item.kind} size={40} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" style={{ fontSize: 14.5 }}>
            A {item.kind.name} bloomed{item.kind.rarity !== 'common' ? ` · ${RARITY_LABEL[item.kind.rarity]}` : ''}
          </Text>
          <Text variant="small" numberOfLines={1} style={{ fontSize: 12 }}>
            {item.bloom.note ?? src.label}
          </Text>
        </View>
        <Icon name={src.icon} color={t.textMuted} size={18} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bed: { borderRadius: 24, overflow: 'hidden' },
  hill: { position: 'absolute', bottom: '32%', height: '55%', borderTopLeftRadius: 999, borderTopRightRadius: 999 },
  grass: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  empty: { position: 'absolute', left: 16, right: 16, bottom: 22 },
  toastWrap: { position: 'absolute', left: 16, right: 16, zIndex: 100, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});
