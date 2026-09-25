/**
 * Colour Clash: a colour word appears in a different ink. Tap the INK colour.
 * 30 seconds; one point per correct tap; a wrong tap only breaks the streak.
 */
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { GameShell, StatPill } from '@/components/games/shell';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { gameOf } from '@/lib/games';
import { recordGame, useAppState } from '@/lib/store';

const SECONDS = 30;
const INKS = [
  { name: 'Red', light: '#D64545', dark: '#F07A7A' },
  { name: 'Blue', light: '#3B6FD4', dark: '#86A9F2' },
  { name: 'Green', light: '#2E9A58', dark: '#62CC8E' },
  { name: 'Yellow', light: '#C99312', dark: '#F0C24B' },
];

type Round = { word: number; ink: number };

function nextRound(prev?: Round): Round {
  let r: Round;
  do {
    const word = Math.floor(Math.random() * INKS.length);
    // Three times in four the ink differs from the word.
    const ink = Math.random() < 0.75 ? (word + 1 + Math.floor(Math.random() * (INKS.length - 1))) % INKS.length : word;
    r = { word, ink };
  } while (prev && r.word === prev.word && r.ink === prev.ink);
  return r;
}

export function ColoursGame() {
  const t = useTheme();
  const dark = useIsDark();
  const info = gameOf('colours')!;
  const best = useAppState((s) => s.games.best.colours);
  const [phase, setPhase] = useState<'ready' | 'play' | 'over'>('ready');
  const [left, setLeft] = useState(SECONDS);
  const [round, setRound] = useState<Round>(() => nextRound());
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const scoreRef = useRef(0);
  const leftRef = useRef(SECONDS);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  // The countdown ends the round itself, so the score is recorded exactly once.
  useEffect(() => {
    if (phase !== 'play') return;
    const id = setInterval(() => {
      leftRef.current -= 1;
      setLeft(leftRef.current);
      if (leftRef.current <= 0) {
        clearInterval(id);
        setPhase('over');
        setNewBest(recordGame('colours', scoreRef.current));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  function start() {
    scoreRef.current = 0;
    setScore(0);
    setStreak(0);
    leftRef.current = SECONDS;
    setLeft(SECONDS);
    setRound(nextRound());
    setNewBest(false);
    setPhase('play');
  }

  function answer(i: number) {
    if (phase !== 'play') return;
    if (i === round.ink) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setStreak((s) => s + 1);
      if (Platform.OS !== 'web') Haptics.selectionAsync();
    } else {
      setStreak(0);
      shake.set(withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 })));
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    setRound((r) => nextRound(r));
  }

  const ink = (i: number) => (dark ? INKS[i].dark : INKS[i].light);

  return (
    <GameShell
      title={info.title}
      stat={phase === 'play' ? <StatPill label={`${left}s`} color={left <= 5 ? ink(0) : undefined} /> : undefined}>
      {phase === 'ready' && (
        <View style={styles.center}>
          <Text variant="hero" center style={{ color: ink(0) }}>
            BLUE
          </Text>
          <Text variant="body" color="textSecondary" center>
            This word says Blue, but the ink is red.{'\n'}Tap the <Text variant="bodyStrong">ink colour</Text>, not the word.
          </Text>
          <Text variant="small" center>
            {SECONDS} seconds{best !== undefined ? ` · your best ${best}` : ''}
          </Text>
        </View>
      )}

      {phase === 'play' && (
        <View style={styles.center}>
          <View style={styles.scoreRow}>
            <Text variant="small">Score {score}</Text>
            {streak >= 3 && <Text variant="small" style={{ color: ink(2) }}>Streak {streak}</Text>}
          </View>
          <Animated.View style={shakeStyle}>
            <Text style={{ fontFamily: Fonts.display, fontSize: 64, lineHeight: 74, color: ink(round.ink), textAlign: 'center' }}>
              {INKS[round.word].name.toUpperCase()}
            </Text>
          </Animated.View>
        </View>
      )}

      {phase === 'over' && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.center}>
          <Text variant="label">Time&apos;s up</Text>
          <Text style={{ fontFamily: Fonts.display, fontSize: 72, lineHeight: 80, color: t.text }}>{score}</Text>
          <Text variant="small">{score === 1 ? 'point' : 'points'}</Text>
          <Text variant="quote" color="textSecondary" center>
            {newBest ? 'A new personal best.' : best !== undefined ? `Your best is ${best}.` : 'Nice start.'}
          </Text>
        </Animated.View>
      )}

      {phase === 'play' ? (
        <View style={styles.pad}>
          {INKS.map((c, i) => (
            <Pressable
              key={c.name}
              accessibilityRole="button"
              accessibilityLabel={c.name}
              onPress={() => answer(i)}
              style={({ pressed }) => [styles.key, { backgroundColor: t.surface, borderColor: t.line, transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
              <View style={[styles.swatch, { backgroundColor: ink(i) }]} />
              <Text variant="bodyStrong">{c.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Button title={phase === 'over' ? 'Play again' : 'Start'} icon={phase === 'over' ? 'refresh' : 'arrow'} onPress={start} />
      )}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  scoreRow: { flexDirection: 'row', gap: 16 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  key: {
    width: '48%',
    flexGrow: 1,
    height: 68,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  swatch: { width: 22, height: 22, borderRadius: 11 },
});
