/** Pair Up: twelve cards, six pairs. Fewer moves is better. */
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { GameShell, StatPill } from '@/components/games/shell';
import { Icon, IconName } from '@/components/icons';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { gameOf } from '@/lib/games';
import { recordGame, useAppState } from '@/lib/store';

const SYMBOLS: { icon: IconName; color: string; soft: string }[] = [
  { icon: 'sun', color: '#D9962B', soft: '#FAEDD3' },
  { icon: 'heart', color: '#D65A45', soft: '#FBE5DF' },
  { icon: 'spark', color: '#7A6FB8', soft: '#ECE8F8' },
  { icon: 'bell', color: '#2C7FA3', soft: '#DDEEF6' },
  { icon: 'flag', color: '#3A9477', soft: '#DDEFE7' },
  { icon: 'chat', color: '#8656AC', soft: '#EFE3F7' },
];

type Card = { key: number; symbol: number };

function newDeck(): Card[] {
  const deck = [...SYMBOLS.keys(), ...SYMBOLS.keys()].map((symbol, key) => ({ key, symbol }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function MemoryGame() {
  const t = useTheme();
  const dark = useIsDark();
  const info = gameOf('memory')!;
  const best = useAppState((s) => s.games.best.memory);
  const [deck, setDeck] = useState<Card[]>(newDeck);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const lock = useRef(false);

  const done = matched.size === SYMBOLS.length;

  function flip(i: number) {
    if (lock.current || open.includes(i) || matched.has(deck[i].symbol)) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    const next = [...open, i];
    setOpen(next);
    if (next.length < 2) return;
    const movesNow = moves + 1;
    setMoves(movesNow);
    const [a, b] = next;
    if (deck[a].symbol === deck[b].symbol) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const nowMatched = new Set(matched).add(deck[a].symbol);
      setMatched(nowMatched);
      setOpen([]);
      // Board cleared: record the round once, here, where it ends.
      if (nowMatched.size === SYMBOLS.length) setNewBest(recordGame('memory', movesNow, true));
    } else {
      lock.current = true;
      setTimeout(() => {
        setOpen([]);
        lock.current = false;
      }, 750);
    }
  }

  function restart() {
    setDeck(newDeck());
    setOpen([]);
    setMatched(new Set());
    setMoves(0);
    setNewBest(false);
  }

  return (
    <GameShell title={info.title} stat={<StatPill label={`${moves} moves`} color={dark ? info.color.dark : info.color.light} />}>
      <Text variant="small" center style={{ marginBottom: 14 }}>
        {best !== undefined ? `Your best: ${best} moves` : 'Find the six matching pairs.'}
      </Text>

      <View style={styles.grid}>
        {deck.map((card, i) => {
          const sym = SYMBOLS[card.symbol];
          const up = open.includes(i) || matched.has(card.symbol);
          const isMatched = matched.has(card.symbol);
          return (
            <Pressable
              key={card.key}
              accessibilityRole="button"
              accessibilityLabel={up ? sym.icon : 'Hidden card'}
              onPress={() => flip(i)}
              style={styles.cell}>
              {up ? (
                <Animated.View
                  entering={ZoomIn.duration(180)}
                  style={[
                    styles.card,
                    { backgroundColor: dark ? t.surfaceAlt : sym.soft, borderColor: sym.color, opacity: isMatched ? 0.75 : 1 },
                  ]}>
                  <Icon name={sym.icon} color={sym.color} size={34} strokeWidth={2} />
                </Animated.View>
              ) : (
                <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
                  <View style={[styles.back, { borderColor: t.line }]} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {done ? (
        <Animated.View entering={FadeIn.duration(400)} style={styles.result}>
          <Text variant="title" center>
            All pairs in {moves} moves
          </Text>
          <Text variant="quote" color="textSecondary" center>
            {newBest ? 'A new personal best.' : 'Nicely done.'}
          </Text>
          <Button title="Play again" icon="refresh" onPress={restart} style={{ alignSelf: 'stretch' }} />
        </Animated.View>
      ) : (
        <Button title="Shuffle" icon="refresh" kind="quiet" onPress={restart} />
      )}
    </GameShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  cell: { width: '33.333%', aspectRatio: 0.9, padding: 5 },
  card: { flex: 1, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  back: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderStyle: 'dashed' },
  result: { gap: 8, marginTop: 18, alignItems: 'center' },
});
