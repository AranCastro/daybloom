/**
 * One routine's history: how often it was done, streaks, a calendar of the last sixteen weeks,
 * weekly bars, and which times of day and weekdays go best. Opened from the Routines list.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { HeatMap, ProgressRing, ShareRows, slotRows, WeekBars, weekdayRows } from '@/components/routine-charts';
import { TaskSheet, useQuadrantColors } from '@/components/tasks';
import { Text } from '@/components/text';
import { Button, Card, EmptyState, Screen, tap } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { fromKey, shortDate, weekdayShort } from '@/lib/dates';
import { effortInfo } from '@/lib/effort';
import { useQuadrantNames } from '@/lib/labels';
import { clockText, repeatLabel } from '@/lib/routines';
import { percent, routineStats } from '@/lib/routine-stats';
import { useAppState } from '@/lib/store';

export default function RoutineScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = useToday();
  const routine = useAppState((s) => s.routines.find((r) => r.id === id));
  const log = useAppState((s) => s.routineLog[id ?? '']);
  const weekStart = useAppState((s) => s.settings.weekStart);
  const names = useQuadrantNames();
  const { color } = useQuadrantColors(routine?.quadrant ?? 1);
  const [editing, setEditing] = useState(false);

  const back = (
    <Pressable hitSlop={12} onPress={() => (tap(), router.back())} accessibilityLabel="Back" style={{ height: 32, justifyContent: 'center' }}>
      <Icon name="back" color={t.textSecondary} />
    </Pressable>
  );

  if (!routine) {
    return (
      <Screen>
        {back}
        <Card>
          <EmptyState line="This routine has been deleted." action="Back to routines" onAction={() => router.back()} />
        </Card>
      </Screen>
    );
  }

  const s = routineStats(routine, log, today, weekStart);
  const since = fromKey(s.since);
  const many = routine.times.length > 1;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {back}
        <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 6 }}>
          <Text variant="label">Routine</Text>
          <Text variant="title">
            {routine.effort ? `${effortInfo(routine.effort).emoji} ` : ''}
            {routine.title}
          </Text>
          <View style={styles.chips}>
            <View style={[styles.chip, { backgroundColor: t.surfaceAlt }]}>
              <View style={[styles.swatch, { backgroundColor: color }]} />
              <Text variant="caption" color="text">
                {names(routine.quadrant)}
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: t.surfaceAlt }]}>
              <Icon name="repeat" size={13} color={t.textSecondary} />
              <Text variant="caption" color="text">
                {repeatLabel(routine)}
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: t.surfaceAlt }]}>
              <Icon name={routine.remind ? 'bell' : 'clock'} size={13} color={t.textSecondary} />
              <Text variant="caption" color="text">
                {routine.times.map(clockText).join(' · ')}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Headline: the last 30 days as a ring, with the all-time count beside it. */}
        <Animated.View entering={FadeInDown.delay(60).duration(400)}>
          <Card>
            <View style={styles.hero}>
              <ProgressRing value={s.last30.due ? s.last30.done / s.last30.due : 0}>
                <Text variant="display" style={{ fontSize: 34, lineHeight: 40 }}>
                  {s.last30.due ? `${percent(s.last30)}%` : '–'}
                </Text>
                <Text variant="micro">last 30 days</Text>
              </ProgressRing>
              <View style={{ flex: 1, gap: 10 }}>
                <View>
                  <Text variant="display" style={{ fontSize: 40, lineHeight: 46 }}>
                    {s.total}
                  </Text>
                  <Text variant="small">{s.total === 1 ? 'time done' : 'times done'} in all</Text>
                </View>
                <Text variant="caption">
                  {s.last30.done} of {s.last30.due} in the last 30 days · {s.perfectDays} full {s.perfectDays === 1 ? 'day' : 'days'} since{' '}
                  {shortDate(since)}
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={styles.tiles}>
          <Tile icon="flame" value={s.streak} unit={s.streak === 1 ? 'day' : 'days'} label="Streak" tint={t.accent} />
          <Tile icon="star" value={s.best} unit={s.best === 1 ? 'day' : 'days'} label="Best" tint={t.legendary} />
          <Tile icon="calendar" value={`${s.thisWeek.done}/${s.thisWeek.due}`} label="This week" tint={t.brand} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(400)}>
          <Card>
            <Text variant="label">Last 16 weeks</Text>
            <HeatMap cells={s.heat} weekStart={weekStart} />
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).duration(400)}>
          <Card>
            <Text variant="label">Week by week</Text>
            <WeekBars weeks={s.weeks} />
          </Card>
        </Animated.View>

        {many && (
          <Card>
            <Text variant="label">Time of day · last 30 days</Text>
            <ShareRows rows={slotRows(s.slots)} />
          </Card>
        )}

        {routine.kind !== 'interval' && (
          <Card>
            <Text variant="label">Weekdays · last 12 weeks</Text>
            <ShareRows rows={weekdayRows(s.weekdays, weekStart).filter((d) => d.due || routine.kind === 'daily')} />
          </Card>
        )}

        <Card>
          <Text variant="label">Recent days</Text>
          {s.recent.length === 0 ? (
            <Text variant="small">Nothing yet. It starts {shortDate(fromKey(routine.start))}.</Text>
          ) : (
            <View style={{ gap: 2 }}>
              {s.recent.map((d) => {
                const date = fromKey(d.day);
                const all = d.slots.every(Boolean);
                return (
                  <View key={d.day} style={[styles.recent, { borderColor: t.line }]}>
                    <Text variant="small" color="text" style={{ flex: 1 }}>
                      {d.day === today ? 'Today' : `${weekdayShort(date)} ${shortDate(date)}`}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {d.slots.map((ok, i) => (
                        <View
                          key={i}
                          accessibilityLabel={`${routine.times[i] ? clockText(routine.times[i]) : `Time ${i + 1}`}: ${ok ? 'done' : 'not done'}`}
                          style={[styles.tick, ok ? { backgroundColor: t.brand, borderColor: t.brand } : { borderColor: t.line }]}>
                          {ok && <Icon name="check" size={12} color={t.brandText} strokeWidth={3} />}
                        </View>
                      ))}
                    </View>
                    <Text variant="caption" strong color={all ? 'success' : 'textMuted'} style={{ width: 64, textAlign: 'right' }}>
                      {all ? 'Done' : `${d.slots.filter(Boolean).length} of ${d.slots.length}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </Card>

        <Button title="Edit routine" kind="secondary" icon="settings" onPress={() => (tap(), setEditing(true))} />
      </Screen>
      <TaskSheet visible={editing} routine={routine} onClose={() => setEditing(false)} />
    </View>
  );
}

function Tile({ icon, value, unit, label, tint }: { icon: 'flame' | 'star' | 'calendar'; value: number | string; unit?: string; label: string; tint: string }) {
  const t = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: t.surface, borderColor: t.line }]}>
      <View style={[styles.tileIcon, { backgroundColor: tint + '22' }]}>
        <Icon name={icon} size={16} color={tint} />
      </View>
      <Text variant="numeral" color="text">
        {value}
        {unit ? <Text variant="caption"> {unit}</Text> : null}
      </Text>
      <Text variant="caption">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, gap: 4, padding: 12, borderRadius: Radius.lg, borderWidth: 1 },
  tileIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  tick: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
