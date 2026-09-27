/**
 * Routines: tasks that come back on their own. Lists each routine with how often it repeats, its
 * times and whether it reminds; tap one to change it, or add a new one.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { TaskSheet, useQuadrantColors } from '@/components/tasks';
import { Text } from '@/components/text';
import { Button, Card, EmptyState, Screen, Tappable, tap } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { effortInfo } from '@/lib/effort';
import { useQuadrantNames } from '@/lib/labels';
import { clockText, occursOn, repeatLabel } from '@/lib/routines';
import { Routine, useAppState } from '@/lib/store';

export default function RoutinesScreen() {
  const t = useTheme();
  const routines = useAppState((s) => s.routines);
  const [editing, setEditing] = useState<Routine | null>(null);
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
          <View style={{ gap: 10 }}>
            {routines.map((r) => (
              <RoutineRow key={r.id} r={r} onOpen={() => setEditing(r)} />
            ))}
          </View>
        )}

        {routines.length > 0 && <Button title="Add a routine" icon="plus" onPress={() => setAdding(true)} />}
      </Screen>
      <TaskSheet visible={!!editing} routine={editing} onClose={() => setEditing(null)} />
      <TaskSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}

function RoutineRow({ r, onOpen }: { r: Routine; onOpen: () => void }) {
  const t = useTheme();
  const today = useToday();
  const names = useQuadrantNames();
  const { color } = useQuadrantColors(r.quadrant);
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
      </View>
      {dueToday && !!status && (
        <Text variant="caption" strong color={current?.done ? 'success' : 'textSecondary'}>
          {status}
        </Text>
      )}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, overflow: 'hidden' },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
