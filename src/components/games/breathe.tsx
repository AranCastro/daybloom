/** Breathe: an orb that grows and shrinks. In 4 s, hold 2 s, out 6 s; five rounds. */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { GameShell, StatPill } from '@/components/games/shell';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { useIsDark } from '@/hooks/use-theme';
import { gameOf } from '@/lib/games';
import { recordGame } from '@/lib/store';

const PHASES = [
  { label: 'Breathe in', secs: 4, scale: 1 },
  { label: 'Hold', secs: 2, scale: 1 },
  { label: 'Breathe out', secs: 6, scale: 0.55 },
] as const;
const CYCLE = PHASES.reduce((n, p) => n + p.secs, 0);
/** Second (within a cycle) at which each phase begins: 0, 4, 6. */
const STARTS = PHASES.map((_, i) => PHASES.slice(0, i).reduce((n, p) => n + p.secs, 0));
const ROUNDS = 5;

function phaseAt(secInCycle: number) {
  let acc = 0;
  for (let i = 0; i < PHASES.length; i++) {
    acc += PHASES[i].secs;
    if (secInCycle < acc) return { index: i, left: acc - secInCycle };
  }
  return { index: 0, left: PHASES[0].secs };
}

export function BreatheGame() {
  const dark = useIsDark();
  const info = gameOf('breathe')!;
  const color = dark ? info.color.dark : info.color.light;
  const [tick, setTick] = useState<number | null>(null); // null = not started
  const scale = useSharedValue(0.55);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const running = tick !== null && tick < CYCLE * ROUNDS;
  const finished = tick !== null && tick >= CYCLE * ROUNDS;
  const phase = phaseAt((tick ?? 0) % CYCLE);
  const round = Math.min(ROUNDS, Math.floor((tick ?? 0) / CYCLE) + 1);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((n) => (n === null ? n : n + 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Animate the orb at the start of each phase.
  const phaseStart = running && STARTS.includes((tick ?? 0) % CYCLE);
  useEffect(() => {
    if (!phaseStart) return;
    const p = PHASES[phase.index];
    scale.set(withTiming(p.scale, { duration: p.secs * 1000, easing: Easing.inOut(Easing.sin) }));
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  }, [phaseStart, phase.index, scale]);

  useEffect(() => {
    if (finished) {
      recordGame('breathe', ROUNDS);
      scale.set(withTiming(0.8, { duration: 800 }));
    }
  }, [finished, scale]);

  return (
    <GameShell title={info.title} stat={running ? <StatPill label={`${round}/${ROUNDS}`} color={color} /> : undefined}>
      <View style={styles.stage}>
        <View style={styles.orbBox}>
          <View style={[styles.ring, { borderColor: color }]} />
          <Animated.View style={[styles.orb, anim]}>
            <LinearGradient
              colors={dark ? ['#C9BFF2', '#6E62B0'] : ['#D8D0F6', '#7A6FB8']}
              start={{ x: 0.2, y: 0.1 }}
              end={{ x: 0.85, y: 0.95 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        {!running && !finished && (
          <View style={styles.copy}>
            <Text variant="title" center>
              Five slow breaths
            </Text>
            <Text variant="body" color="textSecondary" center>
              In for 4, hold for 2, out for 6. Let the orb lead.
            </Text>
          </View>
        )}
        {running && (
          <View style={styles.copy}>
            <Text variant="hero" center style={{ color }}>
              {PHASES[phase.index].label}
            </Text>
            <Text variant="title" color="textSecondary" center>
              {phase.left}
            </Text>
          </View>
        )}
        {finished && (
          <View style={styles.copy}>
            <Text variant="title" center>
              Well done.
            </Text>
            <Text variant="quote" color="textSecondary" center>
              Five slow breaths. Notice how you feel now.
            </Text>
          </View>
        )}
      </View>

      {!running && <Button title={finished ? 'Breathe again' : 'Begin'} onPress={() => setTick(0)} />}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 36 },
  orbBox: { width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 1.5, borderStyle: 'dashed', opacity: 0.5 },
  orb: { width: 240, height: 240, borderRadius: 120, overflow: 'hidden' },
  copy: { gap: 6, minHeight: 100, alignItems: 'center' },
});
