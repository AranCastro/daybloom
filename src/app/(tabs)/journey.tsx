import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { MoodOrb } from '@/components/mood-orb';
import { Text } from '@/components/text';
import { Card, Screen, tap } from '@/components/ui';
import { TabBarInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey, shortDate } from '@/lib/dates';
import { FLOWERS, flowerOf, GOLDEN_EVERY, RARITY_LABEL } from '@/lib/flowers';
import { Flower } from '@/components/flower';
import { GardenBed, SOURCES } from '@/components/garden';
import { MOODS, moodOf } from '@/lib/moods';
import { BADGES, badgeOf, streakInfo } from '@/lib/badges';
import { Medal } from '@/components/badge';
import { router } from 'expo-router';
import { BloomSource, useAppState } from '@/lib/store';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Each way to grow opens the place where you do it. */
const GO: Record<BloomSource, () => void> = {
  checkin: () => router.navigate('/today'),
  task: () => router.navigate('/matrix'),
  focus: () => router.push('/focus'),
  game: () => router.navigate('/play'),
  reach: () => router.navigate('/circle'),
  badge: () => router.push('/badges'),
};

export default function Journey() {
  const t = useTheme();
  const checkins = useAppState((s) => s.checkins);
  const garden = useAppState((s) => s.garden);
  const todayBlooms = garden.filter((b) => dayKey(new Date(b.at)) === dayKey());
  const kinds = new Set(garden.map((b) => b.flower));
  const [offset, setOffset] = useState(0);

  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first grid
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1)),
  ];
  while (cells.length % 7) cells.push(null);

  const monthKeys = cells.filter(Boolean).map((d) => dayKey(d as Date));
  const logged = monthKeys.filter((k) => checkins[k] !== undefined);
  const counts = MOODS.map((m) => ({ mood: m, n: logged.filter((k) => checkins[k] === m.value).length }));
  const streak = streakInfo(checkins).current;
  const earned = useAppState((s) => s.badges);
  const recent = Object.entries(earned)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => badgeOf(id))
    .filter((b): b is NonNullable<typeof b> => !!b)
    .slice(0, 5);
  const today = dayKey();

  return (
    <Screen bottomInset={TabBarInset + 24}>
      <Animated.View entering={FadeInDown.duration(450)} style={{ gap: 4, marginTop: 8 }}>
        <Text variant="label">Your garden</Text>
        <Text variant="title">Everything you do,{'\n'}in bloom.</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(450)}>
        <GardenBed blooms={garden} max={30} height={250} />
      </Animated.View>

      <View style={styles.gardenStats}>
        <MiniStat label="Blooms" value={`${garden.length}`} />
        <MiniStat label="Today" value={`${todayBlooms.length}`} />
        <MiniStat label="Kinds found" value={`${kinds.size}/${FLOWERS.length}`} />
        <MiniStat label="Next golden" value={`${GOLDEN_EVERY - (garden.length % GOLDEN_EVERY)}`} />
      </View>

      <Card>
        <Text variant="label">Ways to grow today</Text>
        {(Object.keys(SOURCES) as BloomSource[]).map((src) => {
          const info = SOURCES[src];
          const n = todayBlooms.filter((b) => b.source === src).length;
          const total = garden.filter((b) => b.source === src).length;
          return (
            <Pressable key={src} onPress={() => (tap(), GO[src]())} style={styles.wayRow} accessibilityRole="button" accessibilityLabel={`${info.label}. ${info.rule}`}>
              <View style={[styles.wayIcon, { backgroundColor: n ? t.accentSoft : t.surfaceAlt }]}>
                <Icon name={n ? 'check' : info.icon} color={n ? t.accent : t.text} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" style={{ fontSize: 15 }}>
                  {info.label}
                </Text>
                <Text variant="small" style={{ fontSize: 12 }}>
                  {info.rule} · {total} so far
                </Text>
              </View>
              <Text variant="bodyStrong" style={{ color: n ? t.accent : t.textMuted, fontSize: 13 }}>
                {n ? `+${n} today` : 'Grow'}
              </Text>
            </Pressable>
          );
        })}
      </Card>

      {garden.length > 0 && (
        <Card>
          <Text variant="label">Latest blooms</Text>
          {garden.slice(0, 5).map((b) => {
            const f = flowerOf(b.flower);
            return (
              <View key={b.id} style={styles.latest}>
                <Flower kind={f} size={34} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" style={{ fontSize: 14.5 }}>
                    {f.name}
                    {f.rarity !== 'common' ? ` · ${RARITY_LABEL[f.rarity]}` : ''}
                  </Text>
                  <Text variant="small" numberOfLines={1} style={{ fontSize: 12 }}>
                    {b.note ?? SOURCES[b.source].label} · {shortDate(new Date(b.at))}
                  </Text>
                </View>
              </View>
            );
          })}
        </Card>
      )}

      <Card>
        <Text variant="label">Collection · {kinds.size} of {FLOWERS.length}</Text>
        <View style={styles.collection}>
          {FLOWERS.map((f) =>
            kinds.has(f.id) ? (
              <View key={f.id} style={styles.collCell}>
                <Flower kind={f} size={40} />
                <Text variant="small" numberOfLines={1} style={{ fontSize: 10.5 }}>
                  {f.name}
                </Text>
              </View>
            ) : (
              <View key={f.id} style={styles.collCell}>
                <View style={[styles.locked, { borderColor: t.line }]}>
                  <Text variant="bodyStrong" color="textMuted">
                    ?
                  </Text>
                </View>
                <Text variant="small" color="textMuted" style={{ fontSize: 10.5 }}>
                  {RARITY_LABEL[f.rarity]}
                </Text>
              </View>
            ),
          )}
        </View>
      </Card>

      <Text variant="label" style={{ marginTop: 6 }}>
        Mood journal
      </Text>
      <View style={styles.stats}>
        <Card style={styles.stat}>
          <Text variant="hero">{streak}</Text>
          <Text variant="small">day check-in streak</Text>
        </Card>
        <Card style={styles.stat}>
          <Text variant="hero">{logged.length}</Text>
          <Text variant="small">days noted this month</Text>
        </Card>
      </View>

      <Pressable onPress={() => (tap(), router.push('/badges'))} accessibilityRole="button" accessibilityLabel="Streak and badges">
        <Card>
          <View style={styles.badgeHead}>
            <Text variant="label">Badges · {recent.length ? Object.keys(earned).length : 0} of {BADGES.length}</Text>
            <Icon name="arrow" color={t.textMuted} size={18} />
          </View>
          {recent.length ? (
            <View style={styles.badgeRow}>
              {recent.map((b) => (
                <Medal key={b.id} badge={b} size={48} />
              ))}
            </View>
          ) : (
            <Text variant="small">Your first check-in earns your first badge.</Text>
          )}
        </Card>
      </Pressable>

      <Card>
        <View style={styles.monthHead}>
          <Pressable hitSlop={12} onPress={() => (tap(), setOffset(offset - 1))}>
            <Icon name="back" color={t.textSecondary} />
          </Pressable>
          <Text variant="heading">
            {MONTHS[first.getMonth()]} {first.getFullYear()}
          </Text>
          <Pressable hitSlop={12} disabled={offset >= 0} onPress={() => (tap(), setOffset(offset + 1))}>
            <Icon name="arrow" color={offset >= 0 ? t.line : t.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <View key={i} style={styles.cell}>
              <Text variant="small" color="textMuted" style={{ fontSize: 12 }}>
                {d}
              </Text>
            </View>
          ))}
          {cells.map((d, i) => {
            if (!d) return <View key={i} style={styles.cell} />;
            const k = dayKey(d);
            const m = moodOf(checkins[k]);
            return (
              <View key={i} style={styles.cell}>
                {m ? (
                  <MoodOrb mood={m} size={34} face={false} />
                ) : (
                  <View style={[styles.blank, k === today && { borderColor: t.text, borderWidth: 1.5 }]}>
                    <Text variant="small" color={k > today ? 'line' : 'textMuted'} style={{ fontSize: 12 }}>
                      {d.getDate()}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text variant="label">Mood mix this month</Text>
        {logged.length === 0 ? (
          <Text variant="small">Nothing noted yet. Your first tap starts the picture.</Text>
        ) : (
          <>
            <View style={styles.bar}>
              {counts
                .filter((c) => c.n > 0)
                .map((c) => (
                  <View key={c.mood.value} style={{ flex: c.n, backgroundColor: c.mood.colors[1] }} />
                ))}
            </View>
            <View style={styles.legend}>
              {counts.map((c) => (
                <View key={c.mood.value} style={styles.legendItem}>
                  <View style={[styles.swatch, { backgroundColor: c.mood.colors[1] }]} />
                  <Text variant="small">
                    {c.mood.label} {c.n}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>
    </Screen>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={[styles.miniStat, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Text variant="bodyStrong" style={{ fontSize: 18 }}>
        {value}
      </Text>
      <Text variant="small" numberOfLines={1} style={{ fontSize: 11 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gardenStats: { flexDirection: 'row', gap: 8 },
  miniStat: { flex: 1, borderRadius: 18, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  wayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
  wayIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  latest: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  collection: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  collCell: { width: '25%', alignItems: 'center', gap: 2 },
  locked: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 12 },
  badgeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  stat: { flex: 1, gap: 0 },
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  blank: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2, marginTop: 6 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
});
