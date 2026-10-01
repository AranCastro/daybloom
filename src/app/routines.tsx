/**
 * Routines: tasks that come back on their own. This week across all routines at the top, then each
 * routine with how often it repeats, its times, the last two weeks and how often it was done; tap
 * one for its full history (routine/[id]), or add a new one.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { DayStrip, ProgressRing, WeekColumns } from '@/components/routine-charts';
import { TaskSheet, useQuadrantColors } from '@/components/tasks';
import { Text } from '@/components/text';
import { Button, Card, EmptyState, Screen, Tappable, tap } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { effortInfo } from '@/lib/effort';
import { useQuadrantNames } from '@/lib/labels';
import { clockText, occursOn, repeatLabel } from '@/lib/routines';
import { allRoutinesWeek, lastDays, percent } from '@/lib/routine-stats';
import { fromKey } from '@/lib/dates';
import { Routine, useAppState } from '@/lib/store';

export default function RoutinesScreen() {
  const t = useTheme();
  const routines = useAppState((s) => s.routines);
  const [adding, setAdding] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Pressable hitSlop={12} onPress={() => (tap(), router.back())} accessibilityLabel="Back" style={{ height: 32, justifyContent: 'center' }}>
          <Icon name="back" color={t.textSecondary} />
        </Pressable>
        <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 4 }}>
          <Text variant="label">Routines</Text>
          <Text variant="title">Things that come back.</Text>
          <Text variant="small">
            Each routine adds itself to its quadrant on the days it is due, once, twice or three times a day, with a quiet reminder if
            you want one.
          </Text>
        </Animated.View>

        {routines.length === 0 ? (
          <Card>
            <EmptyState line="No routines yet. Medicines, a walk, watering the plants: add one and it will appear by itself." action="Add a routine" onAction={() => setAdding(true)} />
          </Card>
        ) : (
          <>
            <WeekSummary routines={routines} />
            <View style={{ gap: 10 }}>
              {routines.map((r, i) => (
                <Animated.View key={r.id} entering={FadeInDown.delay(80 + i * 40).duration(350)}>
                  <RoutineRow r={r} onOpen={() => router.push({ pathname: '/routine/[id]', params: { id: r.id } })} />
                </Animated.View>
              ))}
            </View>
          </>
        )}

        {routines.length > 0 && <Button title="Add a routine" icon="plus" onPress={() => setAdding(true)} />}
      </Screen>
      <TaskSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

/** This week across every routine: a ring, the count, and one column per day. */
function WeekSummary({ routines }: { routines: Routine[] }) {
  const today = useToday();
  const logs = useAppState((s) => s.routineLog);
  const weekStart = useAppState((s) => s.settings.weekStart);
  const week = allRoutinesWeek(routines, logs, today, weekStart);
  return (
    <Animated.View entering={FadeInDown.delay(40).duration(400)}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <ProgressRing value={week.due ? week.done / week.due : 0} size={84} stroke={9}>
            <Text variant="numeral">{week.due ? `${percent(week)}%` : '–'}</Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: 8 }}>
            <View>
              <Text variant="label">This week</Text>
              <Text variant="bodySm" strong color="text">
                {week.done} of {week.due} done
              </Text>
            </View>
            <WeekColumns days={week.days} weekStart={weekStart} today={fromKey(today).getDay()} />
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

function RoutineRow({ r, onOpen }: { r: Routine; onOpen: () => void }) {
  const t = useTheme();
  const today = useToday();
  const names = useQuadrantNames();
  const { color } = useQuadrantColors(r.quadrant);
  const log = useAppState((s) => s.routineLog[r.id]);
  const total = Object.values(log ?? {}).reduce((n, x) => n + x.length, 0);
  // The routine's one task in the matrix today (the current time of day), if any.
  const current = useAppState((s) => s.tasks.find((x) => x.routineId === r.id && x.due === today));
  const dueToday = occursOn(r, today);
  const last = current?.slot === r.times.length - 1;
  const status = !current
    ? null
    : current.done
      ? last
        ? 'Done for today'
        : `Done · next ${clockText(r.times[(current.slot ?? 0) + 1])}`
      : `Now · ${clockText(current.at ?? r.times[0])}`;
  return (
    <Tappable onPress={onOpen} radius={Radius.lg} style={[styles.row, { backgroundColor: t.surface, borderColor: t.line }]}>
      <View style={[styles.bar, { backgroundColor: color }]} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="bodySm" strong color="text" numberOfLines={2}>
          {r.effort ? `${effortInfo(r.effort).emoji} ` : ''}
          {r.title}
        </Text>
        <Text variant="caption">
          {repeatLabel(r)} · {names(r.quadrant)}
        </Text>
        <View style={styles.meta}>
          <Icon name={r.remind ? 'bell' : 'clock'} size={13} color={t.textMuted} />
          <Text variant="caption">{r.times.map(clockText).join(' · ')}</Text>
        </View>
        <View style={[styles.meta, { gap: 10, marginTop: 4 }]}>
          <DayStrip cells={lastDays(r, log, today)} />
          <Text variant="caption" strong color="textSecondary">
            {total}×
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        {dueToday && !!status && (
          <Text variant="caption" strong color={current?.done ? 'success' : 'textSecondary'}>
            {status}
          </Text>
        )}
        <Icon name="arrow" size={16} color={t.textMuted} />
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, overflow: 'hidden' },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
