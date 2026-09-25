/** Bubble Pop: bubbles drift upward; tap to pop. No timer, no way to lose. */
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GameShell, StatPill } from '@/components/games/shell';
import { Text } from '@/components/text';
import { useIsDark } from '@/hooks/use-theme';
import { gameOf } from '@/lib/games';
import { recordGame } from '@/lib/store';

const COLORS = ['#F7C873', '#A9D59A', '#A8C6DA', '#BDB5E8', '#F2A999', '#9FD8C7'];
const MAX_ON_SCREEN = 12;

type Bubble = { id: number; x: number; size: number; color: string; duration: number };

export function BubblesGame() {
  const dark = useIsDark();
  const info = gameOf('bubbles')!;
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [score, setScore] = useState(0);
  const nextId = useRef(0);
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!area) return;
    const spawn = () =>
      setBubbles((list) => {
        if (list.length >= MAX_ON_SCREEN) return list;
        const size = 46 + Math.random() * 44;
        const b: Bubble = {
          id: nextId.current++,
          x: Math.random() * (area.w - size),
          size,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          duration: 6500 + Math.random() * 3500,
        };
        return [...list, b];
      });
    spawn();
    const id = setInterval(spawn, 650);
    return () => clearInterval(id);
  }, [area]);

  // Save the session's count as a best score when leaving.
  useEffect(() => () => {
    if (scoreRef.current > 0) recordGame('bubbles', scoreRef.current);
  }, []);

  const remove = (id: number) => setBubbles((list) => list.filter((b) => b.id !== id));

  function pop(id: number) {
    scoreRef.current += 1;
    setScore(scoreRef.current);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => remove(id), 220);
  }

  return (
    <GameShell title={info.title} stat={<StatPill label={`${score}`} color={dark ? info.color.dark : info.color.light} />}>
      <Text variant="small" center style={{ marginBottom: 8 }}>
        No timer. Pop as many or as few as you like.
      </Text>
      <View
        style={styles.field}
        onLayout={(e: LayoutChangeEvent) => {
          const { width, height } = e.nativeEvent.layout;
          if (!area || area.w !== width || area.h !== height) setArea({ w: width, h: height });
        }}>
        {area &&
          bubbles.map((b) => (
            <BubbleView key={b.id} bubble={b} fieldHeight={area.h} onPop={() => pop(b.id)} onGone={() => remove(b.id)} />
          ))}
      </View>
    </GameShell>
  );
}

function BubbleView({
  bubble,
  fieldHeight,
  onPop,
  onGone,
}: {
  bubble: Bubble;
  fieldHeight: number;
  onPop: () => void;
  onGone: () => void;
}) {
  const y = useSharedValue(fieldHeight);
  const sway = useSharedValue(0);
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(1);
  const [popped, setPopped] = useState(false);

  useEffect(() => {
    y.set(withTiming(-bubble.size, { duration: bubble.duration, easing: Easing.linear }));
    sway.set(withRepeat(withSequence(withTiming(10, { duration: 1400 }), withTiming(-10, { duration: 1400 })), -1, true));
    scale.set(withTiming(1, { duration: 400 }));
    const gone = setTimeout(onGone, bubble.duration);
    return () => clearTimeout(gone);
    // Run once per bubble.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }, { translateX: sway.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.bubbleWrap, { left: bubble.x, width: bubble.size, height: bubble.size }, anim]}>
      {/* The responder fires on touch-down, so even a very quick tap on a moving bubble counts. */}
      <View
        accessibilityRole="button"
        accessibilityLabel="Bubble"
        onStartShouldSetResponder={() => !popped}
        onResponderGrant={() => {
          setPopped(true);
          scale.set(withTiming(1.5, { duration: 200 }));
          opacity.set(withTiming(0, { duration: 200 }));
          onPop();
        }}
        style={[
          styles.bubble,
          { borderRadius: bubble.size / 2, backgroundColor: bubble.color + 'CC', borderColor: 'rgba(255,255,255,0.75)' },
        ]}>
        <View pointerEvents="none" style={[styles.shine, { width: bubble.size * 0.28, height: bubble.size * 0.18, borderRadius: bubble.size }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, overflow: 'hidden', borderRadius: 28 },
  bubbleWrap: { position: 'absolute', top: 0 },
  bubble: { flex: 1, borderWidth: 1.5 },
  shine: { position: 'absolute', top: '18%', left: '20%', backgroundColor: 'rgba(255,255,255,0.8)', transform: [{ rotate: '-30deg' }] },
});
