import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Button, Card, Screen, tap } from '@/components/ui';
import { Fonts, TabBarInset } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { dayKey } from '@/lib/dates';
import { GameId, GameInfo, gameForMood, GAMES } from '@/lib/games';
import { moodOf } from '@/lib/moods';
import { useAppState } from '@/lib/store';

export default function Play() {
  const t = useTheme();
  const mood = useAppState((s) => s.checkins[dayKey()]);
  const pick = gameForMood(mood);
  const today = moodOf(mood);

  return (
    <Screen bottomInset={TabBarInset + 24}>
      <Animated.View entering={FadeInDown.duration(450)} style={{ gap: 4, marginTop: 8 }}>
        <Text variant="label">Play</Text>
        <Text variant="title">A small break{'\n'}for your mind.</Text>
      </Animated.View>

      {pick ? (
        <Animated.View entering={FadeInDown.delay(80).duration(450)}>
          <PickCard game={pick} moodLabel={today?.label ?? ''} />
        </Animated.View>
      ) : (
        <Card tone="accent">
          <Text variant="bodyStrong">Check in first</Text>
          <Text variant="small">Tap how today feels and we will pick the game that suits it.</Text>
          <Pressable onPress={() => (tap(), router.navigate('/today'))} style={{ paddingVertical: 6 }}>
            <Text variant="bodyStrong" color="accent">
              Go to Today
            </Text>
          </Pressable>
        </Card>
      )}

      <Text variant="label" style={{ marginTop: 6 }}>
        All games
      </Text>
      <View style={styles.grid}>
        {GAMES.map((g, i) => (
          <Animated.View key={g.id} entering={FadeInDown.delay(120 + 60 * i).duration(420)} style={styles.gridItem}>
            <GameCard game={g} highlighted={g.id === pick?.id} />
          </Animated.View>
        ))}
      </View>
      <Text variant="small" color="textMuted" center style={{ marginTop: 4, color: t.textMuted }}>
        Short, calm games. No ads, no timers you did not choose.
      </Text>
    </Screen>
  );
}

function useGameColors(g: GameInfo) {
  const dark = useIsDark();
  return { color: dark ? g.color.dark : g.color.light, soft: dark ? g.soft.dark : g.soft.light };
}

function PickCard({ game, moodLabel }: { game: GameInfo; moodLabel: string }) {
  const { color, soft } = useGameColors(game);
  return (
    <View style={[styles.pick, { backgroundColor: soft }]}>
      <View style={styles.pickTop}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="label" style={{ color }}>
            Picked for a {moodLabel.toLowerCase()} day
          </Text>
          <Text variant="title">{game.title}</Text>
        </View>
        <GameArt id={game.id} size={88} />
      </View>
      <Text variant="body" color="textSecondary">
        {game.why}
      </Text>
      <Button title={`Play ${game.title}`} icon="play" onPress={() => router.push({ pathname: '/game/[id]', params: { id: game.id } })} />
    </View>
  );
}

function GameCard({ game, highlighted }: { game: GameInfo; highlighted: boolean }) {
  const t = useTheme();
  const { color, soft } = useGameColors(game);
  const best = useAppState((s) => s.games.best[game.id]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${game.title}. ${game.tagline}`}
      onPress={() => (tap(), router.push({ pathname: '/game/[id]', params: { id: game.id } }))}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: t.surface, borderColor: highlighted ? color : t.line, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}>
      <View style={[styles.art, { backgroundColor: soft }]}>
        <GameArt id={game.id} size={64} />
      </View>
      <Text variant="heading" style={{ fontSize: 17 }}>
        {game.title}
      </Text>
      <Text variant="small" numberOfLines={2} style={{ fontSize: 12.5, lineHeight: 17 }}>
        {game.tagline}
      </Text>
      <View style={styles.meta}>
        <Icon name={best !== undefined ? 'spark' : 'play'} color={color} size={14} />
        <Text variant="small" style={{ color, fontSize: 12, fontFamily: Fonts.bodyStrong }}>
          {best !== undefined ? game.bestLabel(best) : game.minutes}
        </Text>
      </View>
    </Pressable>
  );
}

/** Tiny illustration per game, drawn with views so it themes with the app. */
function GameArt({ id, size }: { id: GameId; size: number }) {
  const dark = useIsDark();
  const s = size;
  if (id === 'breathe') {
    const c = dark ? '#B5ABEA' : '#7A6FB8';
    return (
      <View style={[styles.centerBox, { width: s, height: s }]}>
        {[1, 0.72, 0.46].map((k, i) => (
          <View
            key={k}
            style={{
              position: 'absolute',
              width: s * k,
              height: s * k,
              borderRadius: s,
              backgroundColor: c,
              opacity: [0.18, 0.35, 0.9][i],
            }}
          />
        ))}
      </View>
    );
  }
  if (id === 'bubbles') {
    const dots = [
      { x: 0.1, y: 0.45, r: 0.42, c: '#A8C6DA' },
      { x: 0.5, y: 0.1, r: 0.34, c: '#F7C873' },
      { x: 0.55, y: 0.55, r: 0.28, c: '#BDB5E8' },
    ];
    return (
      <View style={{ width: s, height: s }}>
        {dots.map((d, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: d.x * s,
              top: d.y * s,
              width: d.r * s,
              height: d.r * s,
              borderRadius: s,
              backgroundColor: d.c,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.8)',
            }}
          />
        ))}
      </View>
    );
  }
  if (id === 'memory') {
    const tiles = ['#D9962B', '#3A9477', '#3A9477', '#D65A45'];
    return (
      <View style={[styles.tiles, { width: s, height: s }]}>
        {tiles.map((c, i) => (
          <View
            key={i}
            style={{
              width: s * 0.44,
              height: s * 0.44,
              borderRadius: s * 0.1,
              backgroundColor: i === 1 || i === 2 ? c : 'transparent',
              borderWidth: 1.5,
              borderColor: c,
              opacity: i === 1 || i === 2 ? 0.9 : 0.5,
            }}
          />
        ))}
      </View>
    );
  }
  return (
    <View style={[styles.centerBox, { width: s, height: s }]}>
      <Text style={{ fontFamily: Fonts.display, fontSize: s * 0.34, lineHeight: s * 0.42, color: dark ? '#86A9F2' : '#3B6FD4' }}>
        RED
      </Text>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
        {['#D64545', '#3B6FD4', '#2E9A58', '#C99312'].map((c) => (
          <View key={c} style={{ width: s * 0.12, height: s * 0.12, borderRadius: s, backgroundColor: c }} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pick: { borderRadius: 28, padding: 22, gap: 12 },
  pickTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '47.5%', flexGrow: 1 },
  card: { borderRadius: 24, borderWidth: 1.5, padding: 14, gap: 4 },
  art: { height: 96, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  centerBox: { alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignContent: 'space-between' },
});
