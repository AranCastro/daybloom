/**
 * Shared game effects: particle burst, floating score text, confetti, 3-2-1 countdown,
 * time bar, star rating and the results panel. All animation runs on the UI thread (Reanimated).
 */
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const haptic = {
  light: () => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  select: () => Platform.OS !== 'web' && Haptics.selectionAsync(),
  success: () => Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};
export { haptic };

// ── Particle burst ──────────────────────────────────────────────────────────

function Particle({ progress, angle, dist, color, size }: { progress: SharedValue<number>; angle: number; dist: number; color: string; size: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: Math.cos(angle) * dist * progress.value },
      { translateY: Math.sin(angle) * dist * progress.value },
      { scale: 1 - progress.value * 0.6 },
    ],
  }));
  return <Animated.View style={[{ position: 'absolute', left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

/** Radial burst of dots from its own origin. Place it in a zero-size absolutely positioned parent. */
export function Burst({ color, count = 9, dist = 48, size = 8 }: { color: string; count?: number; dist?: number; size?: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [progress]);
  return (
    <View pointerEvents="none" style={styles.origin}>
      {Array.from({ length: count }, (_, i) => (
        <Particle key={i} progress={progress} angle={(i / count) * Math.PI * 2 + 0.3} dist={dist * (0.75 + (i % 3) * 0.15)} color={color} size={size - (i % 2) * 2} />
      ))}
    </View>
  );
}

/** "+1" that rises and fades. */
export function FloatText({ text, color }: { text: string; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(1, { duration: 750, easing: Easing.out(Easing.quad) }));
  }, [p]);
  const style = useAnimatedStyle(() => ({ opacity: 1 - p.value, transform: [{ translateY: -46 * p.value }, { scale: 0.9 + p.value * 0.3 }] }));
  return (
    <Animated.Text pointerEvents="none" style={[styles.float, { color, fontFamily: Fonts.bodyStrong }, style]}>
      {text}
    </Animated.Text>
  );
}

// ── Confetti ────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#F2B84B', '#E07A4F', '#6FAE7C', '#8C84C6', '#2C7FA3', '#F2A999'];

type Piece = { x: number; delay: number; color: string; w: number; h: number; fall: number; spin: number; drift: number };

function ConfettiPiece({ piece }: { piece: Piece }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(piece.delay, withTiming(1, { duration: 2300, easing: Easing.out(Easing.quad) })));
  }, [p, piece.delay]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.8 ? 1 : (1 - p.value) / 0.2,
    transform: [
      { translateY: -30 + piece.fall * p.value },
      { translateX: piece.drift * Math.sin(p.value * Math.PI * 2) },
      { rotate: `${piece.spin * p.value}deg` },
    ],
  }));
  return <Animated.View style={[{ position: 'absolute', top: 0, left: `${piece.x}%`, width: piece.w, height: piece.h, borderRadius: 2, backgroundColor: piece.color }, style]} />;
}

export function Confetti({ count = 42, height = 700 }: { count?: number; height?: number }) {
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: count }, (_, i) => ({
      x: Math.random() * 96,
      delay: Math.random() * 350,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      w: 6 + Math.random() * 6,
      h: 10 + Math.random() * 8,
      fall: height * (0.55 + Math.random() * 0.45),
      spin: 360 + Math.random() * 540,
      drift: 10 + Math.random() * 24,
    })),
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, i) => (
        <ConfettiPiece key={i} piece={piece} />
      ))}
    </View>
  );
}

// ── Countdown ───────────────────────────────────────────────────────────────

/** 3 · 2 · 1, then calls onDone. */
export function Countdown({ onDone, color }: { onDone: () => void; color: string }) {
  const [n, setN] = useState(3);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    haptic.light();
    let left = 3;
    const id = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(id);
        haptic.medium();
        done.current();
        return;
      }
      haptic.light();
      setN(left);
    }, 750);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.countdown}>
      <Animated.Text key={n} entering={ZoomIn.duration(320).springify()} style={{ fontFamily: Fonts.display, fontSize: 120, lineHeight: 132, color }}>
        {n}
      </Animated.Text>
      <Text variant="label">Get ready</Text>
    </View>
  );
}

// ── Time bar ────────────────────────────────────────────────────────────────

export function TimeBar({ fraction, color }: { fraction: number; color: string }) {
  const t = useTheme();
  const w = useSharedValue(fraction);
  useEffect(() => {
    w.set(withTiming(Math.max(0, Math.min(1, fraction)), { duration: 950, easing: Easing.linear }));
  }, [fraction, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={[styles.track, { backgroundColor: t.surfaceAlt }]}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, style]} />
    </View>
  );
}

// ── Stars and results ───────────────────────────────────────────────────────

export function Stars({ count, color, size = 34 }: { count: number; color: string; size?: number }) {
  const t = useTheme();
  return (
    <View style={styles.stars}>
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} entering={ZoomIn.delay(250 + i * 180).springify().damping(9)} style={{ transform: [{ translateY: i === 1 ? -8 : 0 }] }}>
          <Icon name="star" size={size} color={i < count ? color : t.line} fill={i < count ? color : 'none'} strokeWidth={1.6} />
        </Animated.View>
      ))}
    </View>
  );
}

type Stat = { label: string; value: string };

export function ResultPanel({
  eyebrow,
  value,
  unit,
  line,
  stars,
  color,
  newBest,
  stats,
  onAgain,
  onDone,
  againLabel = 'Play again',
}: {
  eyebrow: string;
  value: string;
  unit?: string;
  line?: string;
  stars?: number;
  color: string;
  newBest?: boolean;
  stats?: Stat[];
  onAgain: () => void;
  onDone: () => void;
  againLabel?: string;
}) {
  const t = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(420)} style={[styles.panel, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Text variant="label" center>
        {eyebrow}
      </Text>
      {stars !== undefined && <Stars count={stars} color={color} />}
      <View style={styles.valueRow}>
        <Text style={{ fontFamily: Fonts.display, fontSize: 64, lineHeight: 72, color: t.text }}>{value}</Text>
        {unit ? (
          <Text variant="body" color="textSecondary" style={{ marginBottom: 12 }}>
            {unit}
          </Text>
        ) : null}
      </View>
      {newBest && (
        <Animated.View entering={ZoomIn.delay(500).springify()} style={[styles.badge, { backgroundColor: color }]}>
          <Icon name="spark" color="#fff" size={14} />
          <Text variant="bodyStrong" style={{ color: '#fff', fontSize: 13 }}>
            New personal best
          </Text>
        </Animated.View>
      )}
      {line ? (
        <Text variant="quote" color="textSecondary" center style={{ fontSize: 17 }}>
          {line}
        </Text>
      ) : null}
      {stats && stats.length > 0 && (
        <View style={[styles.statsRow, { borderColor: t.line }]}>
          {stats.map((s) => (
            <View key={s.label} style={{ flex: 1, alignItems: 'center' }}>
              <Text variant="bodyStrong" style={{ fontSize: 18 }}>
                {s.value}
              </Text>
              <Text variant="small" style={{ fontSize: 11.5 }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      )}
      <Animated.View entering={FadeIn.delay(300)} style={{ alignSelf: 'stretch', gap: 8 }}>
        <Button title={againLabel} icon="refresh" onPress={onAgain} />
        <Button title="Done" kind="quiet" onPress={onDone} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', width: 0, height: 0 },
  float: { position: 'absolute', fontSize: 20, width: 80, left: -40, top: -14, textAlign: 'center' },
  countdown: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  stars: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 6 },
  panel: { borderRadius: 30, borderWidth: 1, padding: 22, gap: 10, alignItems: 'center' },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  statsRow: { flexDirection: 'row', alignSelf: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 4 },
});
