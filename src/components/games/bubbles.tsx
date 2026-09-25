/**
 * Bubble Pop. Zen: no timer, no way to lose. 60-second dash: pop as many as you can while
 * the bubbles speed up. Golden bubbles (rare) are worth 5. Every pop bursts into particles.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Burst, Confetti, FloatText, haptic, ResultPanel, TimeBar } from '@/components/games/fx';
import { GameShell, StatPill } from '@/components/games/shell';
import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Button, Card } from '@/components/ui';
import { useIsDark } from '@/hooks/use-theme';
import { gameOf } from '@/lib/games';
import { recordGame, useAppState } from '@/lib/store';
import { useAppActive } from '@/hooks/use-app-active';

const PALETTE: [string, string][] = [
  ['#FBE3A8', '#F2B84B'],
  ['#D3EDC6', '#86C17A'],
  ['#D6E6F1', '#86AFCB'],
  ['#E2DCF7', '#A69BDF'],
  ['#FAD4CB', '#EE9A86'],
  ['#CDEEE3', '#72C3A8'],
];
const GOLD: [string, string] = ['#FFF1B8', '#E8A317'];
const DASH_SECONDS = 60;
const MAX_ON_SCREEN = 13;

type Mode = 'zen' | 'dash';
/** x is a 0..1 fraction of the field width, so no layout measurement is needed. */
type Bubble = { id: number; x: number; size: number; colors: [string, string]; duration: number; golden: boolean };

export function BubblesGame() {
  const dark = useIsDark();
  const info = gameOf('bubbles')!;
  const color = dark ? info.color.dark : info.color.light;
  const best = useAppState((s) => s.games.best);

  const [mode, setMode] = useState<Mode | null>(null);
  const [over, setOver] = useState<{ score: number; newBest: boolean } | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(DASH_SECONDS);
  const scoreRef = useRef(0);
  const leftRef = useRef(DASH_SECONDS);
  const nextId = useRef(0);
  const startedAt = useRef(0);
  const modeRef = useRef<Mode | null>(null);

  const playing = mode !== null && over === null;
  // Bubbles rise from the bottom of the field by the window height; the field clips them.
  const { height: travel } = useWindowDimensions();

  // Timers pause while the app is in the background.
  const appActive = useAppActive();

  // Spawner. Dash mode speeds up over the minute.
  useEffect(() => {
    if (!playing || !appActive) return;
    const spawn = () => {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      const speedUp = mode === 'dash' ? Math.min(0.45, (elapsed / DASH_SECONDS) * 0.45) : 0;
      setBubbles((list) => {
        if (list.length >= MAX_ON_SCREEN) return list;
        const size = 50 + Math.random() * 42;
        const golden = Math.random() < 0.07;
        return [
          ...list,
          {
            id: nextId.current++,
            x: Math.random(),
            size: golden ? 58 : size,
            colors: golden ? GOLD : PALETTE[Math.floor(Math.random() * PALETTE.length)],
            duration: (golden ? 4800 : 7000 + Math.random() * 3000) * (1 - speedUp),
            golden,
          },
        ];
      });
    };
    spawn();
    const id = setInterval(spawn, mode === 'dash' ? 520 : 700);
    return () => clearInterval(id);
  }, [playing, mode, appActive]);

  // Dash countdown; ends the round itself.
  useEffect(() => {
    if (!playing || mode !== 'dash' || !appActive) return;
    const id = setInterval(() => {
      leftRef.current -= 1;
      setLeft(leftRef.current);
      if (leftRef.current <= 0) {
        clearInterval(id);
        finish();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [playing, mode, appActive]);

  // Leaving Zen mode mid-way still counts the session.
  useEffect(
    () => () => {
      if (modeRef.current === 'zen' && scoreRef.current > 0) recordGame('bubbles', scoreRef.current);
    },
    [],
  );

  function begin(m: Mode) {
    scoreRef.current = 0;
    leftRef.current = DASH_SECONDS;
    startedAt.current = Date.now();
    modeRef.current = m;
    setScore(0);
    setLeft(DASH_SECONDS);
    setBubbles([]);
    setOver(null);
    setMode(m);
  }

  function finish() {
    const m = modeRef.current;
    const final = scoreRef.current;
    modeRef.current = null; // already recorded; do not record again on unmount
    // An empty session is not a record.
    const newBest = final > 0 && recordGame(m === 'dash' ? 'bubbles60' : 'bubbles', final);
    if (newBest) haptic.success();
    setOver({ score: final, newBest });
    setBubbles([]);
  }

  const remove = (id: number) => setBubbles((list) => list.filter((b) => b.id !== id));

  function popped(id: number, golden: boolean) {
    scoreRef.current += golden ? 5 : 1;
    setScore(scoreRef.current);
    if (golden) haptic.medium();
    else haptic.light();
    setTimeout(() => remove(id), 650);
  }

  // ── Screens ──
  if (over && mode) {
    const bestKey = mode === 'dash' ? 'bubbles60' : 'bubbles';
    return (
      <GameShell title={info.title}>
        {over.newBest && <Confetti />}
        <View style={styles.centerFill}>
          <ResultPanel
            eyebrow={mode === 'dash' ? '60-second dash' : 'Zen session'}
            value={`${over.score}`}
            unit="popped"
            newBest={over.newBest}
            line={mode === 'dash' ? 'Quick hands.' : 'A little lighter, maybe.'}
            color={color}
            stats={[{ label: 'Your best', value: `${Math.max(best[bestKey] ?? 0, over.score)}` }]}
            onAgain={() => begin(mode)}
            onDone={() => router.back()}
          />
        </View>
      </GameShell>
    );
  }

  if (!mode) {
    return (
      <GameShell title={info.title}>
        <View style={styles.intro}>
          <Animated.View entering={FadeIn.duration(400)} style={styles.introArt}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.introBubble, { width: [84, 58, 70, 44][i], height: [84, 58, 70, 44][i], left: [40, 150, 210, 110][i], top: [60, 20, 110, 140][i] }]}>
                <LinearGradient colors={i === 1 ? GOLD : PALETTE[i]} style={StyleSheet.absoluteFill} start={{ x: 0.2, y: 0.1 }} end={{ x: 0.9, y: 0.95 }} />
              </View>
            ))}
          </Animated.View>
          <Text variant="title" center>
            Pick your pace
          </Text>
          <Text variant="body" color="textSecondary" center>
            Tap bubbles to pop them. Golden ones are worth five.
          </Text>
        </View>
        <View style={{ gap: 10 }}>
          <ModeCard title="Zen" line="No timer. Stop whenever you like." icon="leaf" record={best.bubbles} onPress={() => begin('zen')} />
          <ModeCard title="60-second dash" line="Bubbles speed up. How many can you pop?" icon="clock" record={best.bubbles60} onPress={() => begin('dash')} />
        </View>
      </GameShell>
    );
  }

  return (
    <GameShell title={info.title} stat={<StatPill label={`${score}`} color={color} />}>
      {mode === 'dash' ? (
        <View style={{ gap: 6, marginBottom: 8 }}>
          <TimeBar fraction={left / DASH_SECONDS} color={left <= 10 ? '#E0664F' : color} />
          <Text variant="small" center>
            {left} s left
          </Text>
        </View>
      ) : (
        <Text variant="small" center style={{ marginBottom: 8 }}>
          Zen · no timer
        </Text>
      )}
      <View style={styles.field}>
        {bubbles.map((b) => (
          <BubbleView key={b.id} bubble={b} travel={travel} onPop={() => popped(b.id, b.golden)} onGone={() => remove(b.id)} />
        ))}
      </View>
      {mode === 'zen' && <Button title="I'm done" kind="secondary" onPress={finish} style={{ marginTop: 10 }} />}
    </GameShell>
  );
}

function ModeCard({ title, line, icon, record, onPress }: { title: string; line: string; icon: 'leaf' | 'clock'; record?: number; onPress: () => void }) {
  return (
    <Card style={{ padding: 16 }}>
      <View style={styles.modeRow}>
        <Icon name={icon} color="#2C7FA3" size={24} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{title}</Text>
          <Text variant="small">
            {line}
            {record !== undefined ? ` Best ${record}.` : ''}
          </Text>
        </View>
      </View>
      <Button title={`Play ${title}`} onPress={onPress} style={{ marginTop: 6 }} />
    </Card>
  );
}

function BubbleView({ bubble, travel, onPop, onGone }: { bubble: Bubble; travel: number; onPop: () => void; onGone: () => void }) {
  const y = useSharedValue(0);
  const sway = useSharedValue(0);
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(1);
  const [popped, setPopped] = useState(false);

  useEffect(() => {
    y.set(withTiming(-(travel + bubble.size + 10), { duration: bubble.duration, easing: Easing.linear }));
    sway.set(withRepeat(withSequence(withTiming(9, { duration: 1500 }), withTiming(-9, { duration: 1500 })), -1, true));
    scale.set(withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.6)) }));
    const gone = setTimeout(onGone, bubble.duration + 50);
    return () => clearTimeout(gone);
    // Once per bubble.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wrap = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { translateX: sway.value }] }));
  const body = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[
        styles.bubbleWrap,
        { left: `${bubble.x * 100}%`, marginLeft: -bubble.size * bubble.x, width: bubble.size, height: bubble.size },
        wrap,
      ]}>
      {/* A responder on a plain View fires on touch-down, so even a very quick tap on a moving bubble counts. */}
      <View
        accessibilityRole="button"
        accessibilityLabel={bubble.golden ? 'Golden bubble' : 'Bubble'}
        onStartShouldSetResponder={() => !popped}
        onResponderGrant={() => {
          setPopped(true);
          cancelAnimation(y);
          cancelAnimation(sway);
          scale.set(withTiming(1.35, { duration: 160 }));
          opacity.set(withTiming(0, { duration: 160 }));
          onPop();
        }}
        style={styles.hit}>
        <Animated.View pointerEvents="none" style={[styles.bubble, { borderRadius: bubble.size / 2 }, body]}>
          <LinearGradient colors={bubble.colors} start={{ x: 0.2, y: 0.1 }} end={{ x: 0.9, y: 0.95 }} style={[StyleSheet.absoluteFill, { borderRadius: bubble.size / 2 }]} />
          <View style={[styles.shine, { width: bubble.size * 0.3, height: bubble.size * 0.18, borderRadius: bubble.size }]} />
          {bubble.golden && (
            <View style={styles.center}>
              <Icon name="star" color="#fff" fill="#fff" size={bubble.size * 0.36} />
            </View>
          )}
        </Animated.View>
      </View>
      {popped && (
        <View pointerEvents="none" style={[styles.fxOrigin, { left: bubble.size / 2, top: bubble.size / 2 }]}>
          <Burst color={bubble.colors[1]} count={bubble.golden ? 14 : 9} dist={bubble.golden ? 70 : 46} />
          <FloatText text={bubble.golden ? '+5' : '+1'} color={bubble.golden ? '#C98A1E' : bubble.colors[1]} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, justifyContent: 'center' },
  intro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  introArt: { width: 300, height: 210, marginBottom: 10 },
  introBubble: { position: 'absolute', borderRadius: 999, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)' },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  field: { flex: 1, overflow: 'hidden', borderRadius: 28 },
  bubbleWrap: { position: 'absolute', top: '100%' },
  hit: { flex: 1 },
  bubble: { flex: 1, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)', overflow: 'hidden' },
  shine: { position: 'absolute', top: '17%', left: '20%', backgroundColor: 'rgba(255,255,255,0.85)', transform: [{ rotate: '-30deg' }] },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  fxOrigin: { position: 'absolute', width: 0, height: 0 },
});
