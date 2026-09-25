/** Streak and badge collection. */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Medal, tierLabel } from '@/components/badge';
import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Card, Screen, tap } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BADGES, REST_DAY_AFTER, streakInfo } from '@/lib/badges';
import { addDays, dayKey, shortDate, weekdayShort } from '@/lib/dates';
import { awardBadges, useAppState } from '@/lib/store';

export default function BadgesScreen() {
  const t = useTheme();
  const checkins = useAppState((s) => s.checkins);
  const earned = useAppState((s) => s.badges);
  const s = streakInfo(checkins);

  // Catch up on anything earned before badges existed (no celebration here).
  useEffect(() => {
    awardBadges();
  }, []);

  const got = BADGES.filter((b) => earned[b.id]).length;
  const days = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i - 13));

  return (
    <Screen>
      <Pressable hitSlop={12} onPress={() => (tap(), router.back())} accessibilityLabel="Back" style={{ height: 32, justifyContent: 'center' }}>
        <Icon name="back" color={t.textSecondary} />
      </Pressable>

      <Animated.View entering={FadeInDown.duration(400)} style={[styles.hero, { backgroundColor: t.accentSoft }]}>
        <View style={styles.flameRow}>
          <Icon name="flame" color={t.accent} size={44} fill={s.current > 0 ? t.accent : 'none'} />
          <Text style={{ fontFamily: Fonts.display, fontSize: 64, lineHeight: 70, color: t.text }}>{s.current}</Text>
        </View>
        <Text variant="heading">day streak</Text>
        <Text variant="small" center>
          {s.checkedToday
            ? 'Checked in today. See you tomorrow.'
            : s.current > 0
              ? 'Check in today to keep it going.'
              : 'Check in today to start a new streak.'}
        </Text>
        <View style={styles.statRow}>
          <Stat label="Best streak" value={`${s.best}`} />
          <Stat label="Days noted" value={`${s.total}`} />
          <Stat label="Badges" value={`${got}/${BADGES.length}`} />
        </View>
      </Animated.View>

      <Card>
        <Text variant="label">Last two weeks</Text>
        <View style={styles.days}>
          {days.map((d) => {
            const k = dayKey(d);
            const on = checkins[k] !== undefined;
            const isToday = k === dayKey();
            return (
              <View key={k} style={styles.day}>
                <View
                  style={[
                    styles.dayDot,
                    { backgroundColor: on ? t.accent : 'transparent', borderColor: on ? t.accent : t.line },
                    isToday && !on && { borderStyle: 'dashed', borderColor: t.text },
                  ]}>
                  {on && <Icon name="check" color="#fff" size={12} strokeWidth={2.6} />}
                </View>
                <Text variant="small" style={{ fontSize: 10.5 }} color={isToday ? 'text' : 'textMuted'}>
                  {weekdayShort(d).slice(0, 1)}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.restNote}>
          <Icon name="leaf" color="#3A9477" size={16} />
          <Text variant="small" style={{ flex: 1 }}>
            Rest days: after {REST_DAY_AFTER} check-ins in a row, one missed day will not break your streak.
            {s.restDaysUsed > 0 ? ` You have used ${s.restDaysUsed} in this streak.` : ''}
          </Text>
        </View>
      </Card>

      <Text variant="label" style={{ marginTop: 4 }}>
        Badges · {got} of {BADGES.length}
      </Text>
      <View style={styles.grid}>
        {BADGES.map((b, i) => {
          const when = earned[b.id];
          return (
            <Animated.View key={b.id} entering={FadeInDown.delay(40 * i).duration(350)} style={styles.cell}>
              <View style={[styles.badgeCard, { backgroundColor: t.surface, borderColor: t.line, opacity: when ? 1 : 0.85 }]}>
                <Medal badge={b} size={58} locked={!when} />
                <Text variant="bodyStrong" center style={{ fontSize: 13.5, lineHeight: 17 }}>
                  {b.title}
                </Text>
                <Text variant="small" center style={{ fontSize: 11, lineHeight: 14 }}>
                  {when ? `${tierLabel(b.tier)} · ${shortDate(new Date(when))}` : b.goal}
                </Text>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text variant="bodyStrong" style={{ fontSize: 18 }}>
        {value}
      </Text>
      <Text variant="small" style={{ fontSize: 11.5 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 30, padding: 22, alignItems: 'center', gap: 4 },
  flameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statRow: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 12 },
  days: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  day: { alignItems: 'center', gap: 4 },
  dayDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  restNote: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  cell: { width: '33.33%', padding: 5 },
  badgeCard: { borderRadius: 20, borderWidth: 1, padding: 10, alignItems: 'center', gap: 6, minHeight: 150 },
});
