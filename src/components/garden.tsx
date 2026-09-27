/** Shared garden visuals: the illustrated bed, the "a flower bloomed" toast and the ways to grow. */
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { DimensionValue, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bud, Flower } from '@/components/flower';
import { GardenSky } from '@/components/garden-sky';
import { haptic } from '@/components/games/fx';
import { Icon, IconName } from '@/components/icons';
import { Text } from '@/components/text';
import { tap } from '@/components/ui';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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

/**
 * A small landscape: sky, hills and grass, with flowers planted in staggered rows (newest in front).
 * With `onEmpty`, the empty bed offers a way to grow the first flower.
 */
export function GardenBed({ blooms, max = 24, height = 220, onEmpty }: { blooms: Bloom[]; max?: number; height?: number; onEmpty?: () => void }) {
  const shown = blooms.slice(0, max);
  const perRow = 6;
  const rows = Math.max(1, Math.ceil(shown.length / perRow));
  const size = Math.min(58, (height - 40) / Math.max(rows, 2) + 18);
  // Measured so the right-hand flowers stay inside a narrow bed (the one on Focus).
  const [width, setWidth] = useState(0);
  return (
    <View style={[styles.bed, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <GardenSky height={height} />
      {shown.length === 0 ? (
        <View style={styles.empty} pointerEvents="box-none">
          <Bud size={Math.min(64, height * 0.36)} grow={0.4} />
          {/* A light chip: readable over the day sky and the night sky alike. */}
          <Pressable
            disabled={!onEmpty}
            onPress={onEmpty ? () => (tap(), onEmpty()) : undefined}
            accessibilityRole={onEmpty ? 'button' : undefined}
            style={styles.emptyChip}>
            <Text variant="caption" strong center style={{ color: '#2F4A3F' }}>
              {onEmpty ? 'Your garden is waiting. Check in to plant the first flower.' : 'Your garden is waiting for its first flower.'}
            </Text>
          </Pressable>
        </View>
      ) : (
        // Oldest at the back (top), newest at the front (bottom).
        [...shown].reverse().map((b, i) => {
          const row = Math.floor(i / perRow);
          const col = i % perRow;
          const back = rows - 1 - row; // 0 = front row
          const y = height - 18 - size - back * (size * 0.52);
          const x = (col + (row % 2 ? 0.5 : 0.1)) / perRow;
          const s = size * (1 - back * 0.1);
          // Spread across the width that is left once the flower itself fits.
          const left: DimensionValue = width ? x * (width - s) : `${Math.min(x * 100, 80)}%`;
          return (
            <View key={b.id} style={{ position: 'absolute', left, top: y, zIndex: row }}>
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
          <Text variant="bodySm" strong>
            A {item.kind.name} bloomed{item.kind.rarity !== 'common' ? ` · ${RARITY_LABEL[item.kind.rarity]}` : ''}
          </Text>
          <Text variant="caption" numberOfLines={1}>
            {item.bloom.note ?? src.label}
          </Text>
        </View>
        <Icon name={src.icon} color={t.textMuted} size={18} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bed: { borderRadius: Radius.md, overflow: 'hidden' },
  // Clear of the monsoon puddles along the bottom edge.
  empty: { position: 'absolute', left: 16, right: 16, bottom: 26, alignItems: 'center', gap: 6 },
  emptyChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.8)' },
  toastWrap: { position: 'absolute', left: 16, right: 16, zIndex: 100, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: Spacing.cardCompact,
    borderRadius: Radius.md,
    borderWidth: 1,
    ...Shadow.md,
  },
});
