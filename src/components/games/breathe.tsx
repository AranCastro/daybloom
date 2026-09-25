/**
 * Breathe: an orb grows on the in-breath and shrinks on the out-breath, with a ring that
 * fills over the whole session. Three rhythms; about one minute each.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { haptic, ResultPanel } from '@/components/games/fx';
import { GameShell, StatPill } from '@/components/games/shell';
import { Text } from '@/components/text';
import { Button, Choice } from '@/components/ui';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { gameOf } from '@/lib/games';
import { recordGame, useAppState } from '@/lib/store';

type Phase = { label: string; secs: number; scale: number };
type Pattern = { key: 'calm' | 'box' | 'unwind'; name: string; recipe: string; rounds: number; phases: Phase[] };

const SMALL = 0.56;
const PATTERNS: Pattern[] = [
  {
    key: 'calm',
    name: 'Calm',
    recipe: 'In 4 · hold 2 · out 6',
    rounds: 5,
    phases: [
      { label: 'Breathe in', secs: 4, scale: 1 },
      { label: 'Hold', secs: 2, scale: 1 },
      { label: 'Breathe out', secs: 6, scale: SMALL },
    ],
  },
  {
    key: 'box',
    name: 'Box',
    recipe: 'In 4 · hold 4 · out 4 · hold 4',
    rounds: 4,
    phases: [
      { label: 'Breathe in', secs: 4, scale: 1 },
      { label: 'Hold', secs: 4, scale: 1 },
      { label: 'Breathe out', secs: 4, scale: SMALL },
      { label: 'Hold', secs: 4, scale: SMALL },
    ],
  },
  {
    key: 'unwind',
    name: 'Unwind',
    recipe: 'In 4 · hold 7 · out 8',
    rounds: 3,
    phases: [
      { label: 'Breathe in', secs: 4, scale: 1 },
      { label: 'Hold', secs: 7, scale: 1 },
      { label: 'Breathe out', secs: 8, scale: SMALL },
    ],
  },
];

const cycleOf = (p: Pattern) => p.phases.reduce((n, ph) => n + ph.secs, 0);

function locate(p: Pattern, tick: number) {
  const cycle = cycleOf(p);
  const within = tick % cycle;
  let acc = 0;
  for (let i = 0; i < p.phases.length; i++) {
    if (within < acc + p.phases[i].secs) return { index: i, left: acc + p.phases[i].secs - within, isStart: within === acc };
    acc += p.phases[i].secs;
  }
  return { index: 0, left: p.phases[0].secs, isStart: true };
}

const RING = 280;
const STROKE = 5;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function BreatheGame() {
  const t = useTheme();
  const dark = useIsDark();
  const info = gameOf('breathe')!;
  const color = dark ? info.color.dark : info.color.light;
  const sessions = useAppState((s) => s.games.plays.breathe ?? 0);

  const [patternKey, setPatternKey] = useState<Pattern['key']>('calm');
  const pattern = PATTERNS.find((p) => p.key === patternKey)!;
  const total = cycleOf(pattern) * pattern.rounds;

  const [tick, setTick] = useState<number | null>(null); // null = intro
  const tickRef = useRef(0);
  const scale = useSharedValue(SMALL);
  const glow = useSharedValue(0.25);
  const ring = useSharedValue(0);

  const running = tick !== null && tick < total;
  const finished = tick !== null && tick >= total;
  const where = locate(pattern, Math.min(tick ?? 0, total - 1));
  const round = Math.min(pattern.rounds, Math.floor((tick ?? 0) / cycleOf(pattern)) + 1);

  // One interval drives the session; it ends the session itself so the result is recorded once.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      tickRef.current += 1;
      setTick(tickRef.current);
      if (tickRef.current >= total) {
        clearInterval(id);
        recordGame('breathe', 1);
        haptic.success();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, total]);

  // At the start of each phase, animate the orb and pulse the glow.
  const phaseKey = running && where.isStart ? `${tick}` : null;
  useEffect(() => {
    if (!phaseKey) return;
    const ph = pattern.phases[where.index];
    const easing = Easing.inOut(Easing.sin);
    scale.set(withTiming(ph.scale, { duration: ph.secs * 1000, easing }));
    glow.set(withTiming(ph.scale === 1 ? 0.55 : 0.2, { duration: ph.secs * 1000, easing }));
    haptic.select();
  }, [phaseKey, pattern, where.index, scale, glow]);

  // Ring fills steadily across the whole session.
  useEffect(() => {
    if (tick === null) return;
    ring.set(withTiming(Math.min(1, (tick + 1) / total), { duration: 1000, easing: Easing.linear }));
  }, [tick, total, ring]);

  function start() {
    tickRef.current = 0;
    ring.set(0);
    scale.set(SMALL);
    setTick(0);
  }

  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: scale.value * 1.18 }] }));
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - ring.value) }));

  if (finished) {
    return (
      <GameShell title={info.title}>
        <View style={styles.resultWrap}>
          <ResultPanel
            eyebrow={`${pattern.name} breathing`}
            value={`${pattern.rounds}`}
            unit="rounds"
            line="Well done. Notice how your body feels now."
            color={color}
            stats={[
              { label: 'Minutes', value: (total / 60).toFixed(1) },
              { label: 'Sessions', value: `${sessions}` },
            ]}
            againLabel="Breathe again"
            onAgain={() => setTick(null)}
            onDone={() => router.back()}
          />
        </View>
      </GameShell>
    );
  }

  return (
    <GameShell title={info.title} stat={running ? <StatPill label={`${round}/${pattern.rounds}`} color={color} /> : undefined}>
      <View style={styles.stage}>
        <View style={styles.orbBox}>
          <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
            <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={t.line} strokeWidth={STROKE} fill="none" />
            <AnimatedCircle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke={color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${CIRC} ${CIRC}`}
              animatedProps={ringProps}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          <Animated.View style={[styles.glow, { backgroundColor: color }, glowStyle]} />
          <Animated.View style={[styles.orb, orbStyle]}>
            <LinearGradient colors={dark ? ['#D6CDFA', '#6E62B0'] : ['#E3DCFB', '#7A6FB8']} start={{ x: 0.2, y: 0.1 }} end={{ x: 0.85, y: 0.95 }} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{ x: 0.3, y: 0 }} end={{ x: 0.5, y: 0.55 }} style={styles.shine} />
          </Animated.View>
        </View>

        {running ? (
          <View style={styles.copy}>
            <Animated.View key={`${where.index}-${round}`} entering={FadeIn.duration(350)} exiting={FadeOut.duration(150)}>
              <Text variant="hero" center style={{ color }}>
                {pattern.phases[where.index].label}
              </Text>
            </Animated.View>
            <Text variant="title" color="textSecondary" center>
              {where.left}
            </Text>
          </View>
        ) : (
          <View style={styles.copy}>
            <Text variant="title" center>
              {pattern.name} breathing
            </Text>
            <Text variant="body" color="textSecondary" center>
              {pattern.recipe} · {pattern.rounds} rounds · about {Math.round(total / 6) / 10} min
            </Text>
          </View>
        )}
      </View>

      {!running && (
        <View style={{ gap: 12 }}>
          <Choice options={PATTERNS.map((p) => ({ label: p.name, value: p.key }))} value={patternKey} onChange={setPatternKey} />
          <Button title="Begin" icon="arrow" onPress={start} />
        </View>
      )}
      {running && <Button title="Stop" kind="quiet" onPress={() => setTick(null)} />}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 30 },
  orbBox: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 220, height: 220, borderRadius: 110 },
  orb: { width: 230, height: 230, borderRadius: 115, overflow: 'hidden' },
  shine: { position: 'absolute', top: '6%', left: '16%', width: '62%', height: '42%', borderRadius: 999 },
  copy: { gap: 4, minHeight: 96, alignItems: 'center' },
  resultWrap: { flex: 1, justifyContent: 'center' },
});
