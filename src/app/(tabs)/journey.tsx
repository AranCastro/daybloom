import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { MoodOrb } from '@/components/mood-orb';
import { Text } from '@/components/text';
import { Card, Screen, tap } from '@/components/ui';
import { TabBarInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey } from '@/lib/dates';
import { MOODS, moodOf } from '@/lib/moods';
import { BADGES, badgeOf, streakInfo } from '@/lib/badges';
import { Medal } from '@/components/badge';
import { router } from 'expo-router';
import { useAppState } from '@/lib/store';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function Journey() {
  const t = useTheme();
  const checkins = useAppState((s) => s.checkins);
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
        <Text variant="label">Your journey</Text>
        <Text variant="title">Every day counts,{'\n'}even the grey ones.</Text>
      </Animated.View>

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

const styles = StyleSheet.create({
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
