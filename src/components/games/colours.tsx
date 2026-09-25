/**
 * Colour Clash: a colour word is printed in a different ink. Tap the INK colour.
 * 30 seconds. Streaks multiply points (×2 from 5, ×3 from 10). After 10 correct answers
 * the buttons start to shuffle.
 */
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';

import { Confetti, Countdown, haptic, ResultPanel, TimeBar } from '@/components/games/fx';
import { GameShell, StatPill } from '@/components/games/shell';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { gameOf } from '@/lib/games';
import { recordGame, useAppState } from '@/lib/store';

const SECONDS = 30;
const SHUFFLE_AFTER = 10;
const INKS = [
  { name: 'Red', light: '#D64545', dark: '#F07A7A' },
  { name: 'Blue', light: '#3B6FD4', dark: '#86A9F2' },
  { name: 'Green', light: '#2E9A58', dark: '#62CC8E' },
  { name: 'Yellow', light: '#C99312', dark: '#F0C24B' },
];

type Round = { word: number; ink: number };
type Phase = 'intro' | 'countdown' | 'play' | 'over';

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

function shuffled(): number[] {
  const a = [0, 1, 2, 3];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const multiplierFor = (streak: number) => (streak >= 10 ? 3 : streak >= 5 ? 2 : 1);

export function ColoursGame() {
  const t = useTheme();
  const dark = useIsDark();
  const info = gameOf('colours')!;
  const color = dark ? info.color.dark : info.color.light;
  const best = useAppState((s) => s.games.best.colours);

  const [phase, setPhase] = useState<Phase>('intro');
  const [left, setLeft] = useState(SECONDS);
  const [round, setRound] = useState<Round>(() => nextRound());
  const [order, setOrder] = useState<number[]>([0, 1, 2, 3]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [shuffling, setShuffling] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; id: number } | null>(null);
  const [result, setResult] = useState<{ score: number; correct: number; answers: number; bestStreak: number; newBest: boolean } | null>(null);

  const s = useRef({ score: 0, correct: 0, answers: 0, streak: 0, bestStreak: 0, left: SECONDS });
  const shake = useSharedValue(0);
  const pop = useSharedValue(1);
  const wordStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }, { scale: pop.value }] }));

  // Round clock; it ends the round itself so the result is recorded exactly once.
  useEffect(() => {
    if (phase !== 'play') return;
    const id = setInterval(() => {
      s.current.left -= 1;
      setLeft(s.current.left);
      if (s.current.left <= 3 && s.current.left > 0) haptic.light();
      if (s.current.left <= 0) {
        clearInterval(id);
        const r = s.current;
        const newBest = r.score > 0 && recordGame('colours', r.score);
        if (newBest) haptic.success();
        setResult({ score: r.score, correct: r.correct, answers: r.answers, bestStreak: r.bestStreak, newBest });
        setPhase('over');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  function start() {
    s.current = { score: 0, correct: 0, answers: 0, streak: 0, bestStreak: 0, left: SECONDS };
    setScore(0);
    setStreak(0);
    setLeft(SECONDS);
    setOrder([0, 1, 2, 3]);
    setRound(nextRound());
    setFeedback(null);
    setShuffling(false);
    setResult(null);
    setPhase('countdown');
  }

  function answer(i: number) {
    if (phase !== 'play') return;
    const r = s.current;
    r.answers += 1;
    if (i === round.ink) {
      r.correct += 1;
      r.streak += 1;
      r.bestStreak = Math.max(r.bestStreak, r.streak);
      r.score += multiplierFor(r.streak);
      pop.set(withSequence(withTiming(1.12, { duration: 70 }), withSpring(1, { damping: 9 })));
      haptic.select();
      setFeedback({ ok: true, id: r.answers });
    } else {
      r.streak = 0;
      shake.set(withSequence(withTiming(-12, { duration: 50 }), withTiming(12, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 })));
      haptic.warning();
      setFeedback({ ok: false, id: r.answers });
    }
    setScore(r.score);
    setStreak(r.streak);
    setRound((prev) => nextRound(prev));
    if (r.correct >= SHUFFLE_AFTER) {
      setShuffling(true);
      setOrder(shuffled());
    }
  }

  const ink = (i: number) => (dark ? INKS[i].dark : INKS[i].light);
  const mult = multiplierFor(streak);

  if (phase === 'over' && result) {
    const accuracy = result.answers ? Math.round((result.correct / result.answers) * 100) : 0;
    return (
      <GameShell title={info.title}>
        {result.newBest && <Confetti />}
        <View style={styles.centerFill}>
          <ResultPanel
            eyebrow="Time's up"
            value={`${result.score}`}
            unit={result.score === 1 ? 'point' : 'points'}
            newBest={result.newBest}
            line={accuracy >= 90 ? 'Laser focus.' : accuracy >= 70 ? 'Sharp work.' : 'Tricky, isn’t it? Slow down a touch.'}
            color={color}
            stats={[
              { label: 'Accuracy', value: `${accuracy}%` },
              { label: 'Best streak', value: `${result.bestStreak}` },
              { label: 'Your best', value: `${Math.max(best ?? 0, result.score)}` },
            ]}
            onAgain={start}
            onDone={() => router.back()}
          />
        </View>
      </GameShell>
    );
  }

  return (
    <GameShell title={info.title} stat={phase === 'play' ? <StatPill label={`${score}`} color={color} /> : undefined}>
      {phase === 'intro' && (
        <>
          <View style={styles.center}>
            <View style={[styles.wordCard, { backgroundColor: t.surface, borderColor: t.line }]}>
              <Text style={[styles.word, { color: ink(0) }]}>BLUE</Text>
            </View>
            <Text variant="title" center>
              Tap the ink, not the word
            </Text>
            <Text variant="body" color="textSecondary" center>
              This says Blue, but it is printed in red, so the answer is Red.
            </Text>
            <View style={styles.rules}>
              <Rule text="30 seconds. Answer as many as you can." />
              <Rule text="Streaks multiply points: ×2 from 5, ×3 from 10." />
              <Rule text="After 10 correct, the buttons start to shuffle." />
            </View>
            {best !== undefined && <Text variant="small">Your best: {best} points</Text>}
          </View>
          <Button title="Start" icon="arrow" onPress={start} />
        </>
      )}

      {phase === 'countdown' && <Countdown color={color} onDone={() => setPhase('play')} />}

      {phase === 'play' && (
        <>
          <View style={{ gap: 6 }}>
            <TimeBar fraction={left / SECONDS} color={left <= 5 ? ink(0) : color} />
            <View style={styles.hud}>
              <Text variant="small">{left}s</Text>
              {mult > 1 ? (
                <Animated.View key={mult} entering={ZoomIn.springify()} style={[styles.mult, { backgroundColor: color }]}>
                  <Text variant="bodyStrong" style={{ color: '#fff', fontSize: 12.5 }}>
                    ×{mult} · streak {streak}
                  </Text>
                </Animated.View>
              ) : (
                <Text variant="small">{streak > 0 ? `Streak ${streak}` : ' '}</Text>
              )}
            </View>
          </View>
          <View style={styles.center}>
            <Animated.View
              style={[
                styles.wordCard,
                { backgroundColor: t.surface, borderColor: feedback ? (feedback.ok ? '#3FA86B' : '#E0664F') : t.line },
                wordStyle,
              ]}>
              <Animated.Text key={`${round.word}-${round.ink}-${feedback?.id ?? 0}`} entering={FadeIn.duration(120)} style={[styles.word, { color: ink(round.ink) }]}>
                {INKS[round.word].name.toUpperCase()}
              </Animated.Text>
            </Animated.View>
            {shuffling && (
              <Text variant="small" style={{ color }}>
                Buttons shuffling
              </Text>
            )}
          </View>
          <View style={styles.pad}>
            {order.map((i) => (
              <ColourKey key={INKS[i].name} name={INKS[i].name} swatch={ink(i)} onDown={() => answer(i)} />
            ))}
          </View>
        </>
      )}
    </GameShell>
  );
}

/** Answer key. A touch responder answers on touch-down, which keeps quick taps from being lost. */
function ColourKey({ name, swatch, onDown }: { name: string; swatch: string; onDown: () => void }) {
  const t = useTheme();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={name}
      onStartShouldSetResponder={() => true}
      onResponderGrant={() => {
        scale.set(withTiming(0.94, { duration: 60 }));
        onDown();
      }}
      onResponderRelease={() => scale.set(withSpring(1, { damping: 12 }))}
      onResponderTerminate={() => scale.set(withSpring(1, { damping: 12 }))}
      style={styles.keyWrap}>
      <Animated.View pointerEvents="none" style={[styles.key, { backgroundColor: t.surface, borderColor: t.line }, style]}>
        <View style={[styles.swatch, { backgroundColor: swatch }]} />
        <Text variant="bodyStrong" style={{ fontSize: 17 }}>
          {name}
        </Text>
      </Animated.View>
    </View>
  );
}

function Rule({ text }: { text: string }) {
  const t = useTheme();
  return (
    <View style={styles.rule}>
      <View style={[styles.ruleDot, { backgroundColor: t.textMuted }]} />
      <Text variant="small" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  wordCard: { minWidth: 250, paddingHorizontal: 28, paddingVertical: 24, borderRadius: 28, borderWidth: 2, alignItems: 'center' },
  word: { fontFamily: Fonts.display, fontSize: 60, lineHeight: 70, letterSpacing: 1 },
  rules: { alignSelf: 'stretch', gap: 6, marginTop: 6 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ruleDot: { width: 5, height: 5, borderRadius: 3 },
  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 26 },
  mult: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  keyWrap: { width: '48%', flexGrow: 1 },
  key: { height: 72, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  swatch: { width: 24, height: 24, borderRadius: 12 },
});
