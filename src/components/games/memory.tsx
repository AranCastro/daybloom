/**
 * Pair Up: flip two cards; matching pairs stay open. Three levels. Stars reward few moves.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Confetti, haptic, ResultPanel } from '@/components/games/fx';
import { GameShell, StatPill } from '@/components/games/shell';
import { Icon, IconName } from '@/components/icons';
import { Text } from '@/components/text';
import { Choice } from '@/components/ui';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { gameOf } from '@/lib/games';
import { recordGame, useAppState } from '@/lib/store';

const SYMBOLS: { icon: IconName; color: string; soft: string }[] = [
  { icon: 'sun', color: '#D9962B', soft: '#FAEDD3' },
  { icon: 'heart', color: '#D65A45', soft: '#FBE5DF' },
  { icon: 'spark', color: '#7A6FB8', soft: '#ECE8F8' },
  { icon: 'bell', color: '#2C7FA3', soft: '#DDEEF6' },
  { icon: 'leaf', color: '#3A9477', soft: '#DDEFE7' },
  { icon: 'chat', color: '#8656AC', soft: '#EFE3F7' },
  { icon: 'moon', color: '#4F63B8', soft: '#E3E7F8' },
  { icon: 'star', color: '#C98A1E', soft: '#FBEFD6' },
];

type Level = 'easy' | 'normal' | 'hard';
const LEVELS: Record<Level, { label: string; pairs: number; cols: number; key: string }> = {
  easy: { label: 'Easy', pairs: 4, cols: 4, key: 'memory-easy' },
  normal: { label: 'Normal', pairs: 6, cols: 3, key: 'memory' },
  hard: { label: 'Hard', pairs: 8, cols: 4, key: 'memory-hard' },
};

type Card = { key: string; symbol: number };

function newDeck(pairs: number): Card[] {
  const picks = [...SYMBOLS.keys()].sort(() => Math.random() - 0.5).slice(0, pairs);
  const deck = [...picks, ...picks].map((symbol, i) => ({ key: `${Date.now()}-${i}`, symbol }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function starsFor(moves: number, pairs: number): number {
  if (moves <= pairs + 2) return 3;
  if (moves <= pairs * 2) return 2;
  return 1;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function MemoryGame() {
  const dark = useIsDark();
  const info = gameOf('memory')!;
  const color = dark ? info.color.dark : info.color.light;
  const bests = useAppState((s) => s.games.best);

  const [level, setLevel] = useState<Level>('normal');
  const cfg = LEVELS[level];
  const [deck, setDeck] = useState<Card[]>(() => newDeck(LEVELS.normal.pairs));
  const [open, setOpen] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<{ moves: number; seconds: number; stars: number; newBest: boolean } | null>(null);
  const lock = useRef(false);
  const secondsRef = useRef(0);
  /** Bumped on every reset so timers from an abandoned board do nothing. */
  const roundRef = useRef(0);

  // Clock runs from the first flip until the board is cleared.
  useEffect(() => {
    if (!started || result) return;
    const id = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [started, result]);

  function reset(next: Level = level) {
    roundRef.current += 1;
    lock.current = false;
    secondsRef.current = 0;
    setLevel(next);
    setDeck(newDeck(LEVELS[next].pairs));
    setOpen([]);
    setWrong([]);
    setMatched(new Set());
    setMoves(0);
    setSeconds(0);
    setStarted(false);
    setResult(null);
  }

  function flip(i: number) {
    if (lock.current || open.includes(i) || matched.has(deck[i].symbol)) return;
    if (!started) setStarted(true);
    haptic.select();
    const next = [...open, i];
    setOpen(next);
    if (next.length < 2) return;

    const movesNow = moves + 1;
    setMoves(movesNow);
    const [a, b] = next;
    const round = roundRef.current;
    lock.current = true;
    if (deck[a].symbol === deck[b].symbol) {
      const nowMatched = new Set(matched).add(deck[a].symbol);
      // Let the second card finish flipping before it settles as matched.
      setTimeout(() => {
        if (round !== roundRef.current) return;
        haptic.success();
        setMatched(nowMatched);
        setOpen([]);
        lock.current = false;
        if (nowMatched.size === cfg.pairs) {
          const stars = starsFor(movesNow, cfg.pairs);
          const newBest = recordGame(cfg.key, movesNow, true);
          setResult({ moves: movesNow, seconds: secondsRef.current, stars, newBest });
        }
      }, 320);
    } else {
      setTimeout(() => {
        if (round !== roundRef.current) return;
        haptic.warning();
        setWrong([a, b]);
      }, 380);
      setTimeout(() => {
        if (round !== roundRef.current) return;
        setWrong([]);
        setOpen([]);
        lock.current = false;
      }, 950);
    }
  }

  const best = bests[cfg.key];

  return (
    <GameShell title={info.title} stat={<StatPill label={fmt(seconds)} color={color} />}>
      {result && result.stars === 3 && <Confetti />}
      {result ? (
        <View style={styles.centerFill}>
          <ResultPanel
            eyebrow={`${cfg.label} · all ${cfg.pairs} pairs`}
            value={`${result.moves}`}
            unit="moves"
            stars={result.stars}
            newBest={result.newBest}
            line={result.stars === 3 ? 'A sharp memory today.' : result.stars === 2 ? 'Nicely done.' : 'Done. Every round warms the mind up.'}
            color={color}
            stats={[
              { label: 'Time', value: fmt(result.seconds) },
              { label: 'Best moves', value: `${Math.min(best ?? result.moves, result.moves)}` },
            ]}
            onAgain={() => reset()}
            onDone={() => router.back()}
          />
        </View>
      ) : (
        <>
          <Choice
            options={(Object.keys(LEVELS) as Level[]).map((k) => ({ label: LEVELS[k].label, value: k }))}
            value={level}
            onChange={(v) => reset(v)}
          />
          <View style={styles.metaRow}>
            <Text variant="small">
              {moves} {moves === 1 ? 'move' : 'moves'} · {matched.size}/{cfg.pairs} pairs
            </Text>
            <Text variant="small">{best !== undefined ? `Best ${best}` : 'No best yet'}</Text>
          </View>
          <View style={styles.gridWrap}>
            <View style={styles.grid}>
              {deck.map((card, i) => (
                <View key={card.key} style={[styles.cell, { width: `${100 / cfg.cols}%` }]}>
                  <FlipCard
                    symbol={card.symbol}
                    up={open.includes(i) || matched.has(card.symbol)}
                    matched={matched.has(card.symbol)}
                    wrong={wrong.includes(i)}
                    onPress={() => flip(i)}
                    small={cfg.cols === 4}
                  />
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </GameShell>
  );
}

function FlipCard({ symbol, up, matched, wrong, onPress, small }: { symbol: number; up: boolean; matched: boolean; wrong: boolean; onPress: () => void; small: boolean }) {
  const t = useTheme();
  const dark = useIsDark();
  const sym = SYMBOLS[symbol];
  const p = useSharedValue(up ? 1 : 0);
  const shake = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    p.set(withTiming(up ? 1 : 0, { duration: 300, easing: Easing.out(Easing.cubic) }));
  }, [up, p]);
  useEffect(() => {
    if (wrong) shake.set(withSequence(withTiming(-7, { duration: 60 }), withTiming(7, { duration: 60 }), withTiming(-4, { duration: 60 }), withTiming(0, { duration: 60 })));
  }, [wrong, shake]);
  useEffect(() => {
    if (matched) pop.set(withSequence(withTiming(1.08, { duration: 140 }), withSpring(1, { damping: 8 })));
  }, [matched, pop]);

  const wrap = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }, { scale: pop.value }] }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 800 }, { rotateY: `${p.value * 180}deg` }] }));
  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 800 }, { rotateY: `${180 + p.value * 180}deg` }] }));

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={up ? sym.icon : 'Hidden card'} onPress={onPress} style={{ flex: 1 }}>
      <Animated.View style={[{ flex: 1 }, wrap]}>
        <Animated.View style={[styles.face, { borderColor: t.line, backgroundColor: t.surface }, back]}>
          <LinearGradient colors={dark ? ['#2A3A33', '#1D2A25'] : ['#EAF2EE', '#D9E7E0']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <View style={[styles.backMark, { borderColor: dark ? '#6CC4A6' : '#3A9477' }]}>
            <View style={[styles.backDot, { backgroundColor: dark ? '#6CC4A6' : '#3A9477' }]} />
          </View>
        </Animated.View>
        <Animated.View
          style={[
            styles.face,
            { backgroundColor: dark ? t.surfaceAlt : sym.soft, borderColor: wrong ? '#E0664F' : sym.color, borderWidth: matched ? 2.5 : 1.5 },
            front,
          ]}>
          <Icon name={sym.icon} color={sym.color} size={small ? 28 : 36} strokeWidth={2} fill={matched ? sym.soft : 'none'} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, justifyContent: 'center' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 },
  gridWrap: { flex: 1, justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  cell: { aspectRatio: 0.82, padding: 5 },
  face: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  backMark: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', opacity: 0.8 },
  backDot: { width: 8, height: 8, borderRadius: 4 },
});
