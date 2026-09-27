import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { QuadrantChip, TaskRow, TaskSheet, useQuadrantColors } from '@/components/tasks';
import { Text } from '@/components/text';
import { EmptyState, Screen, Tappable, tap } from '@/components/ui';
import { Radius, Shadow, Spacing, TabBarInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { useQuadrantNames } from '@/lib/labels';
import { dayKey } from '@/lib/dates';
import { QUADRANTS, quadrantOf } from '@/lib/quadrants';
import { deepFirst, fitEnergy } from '@/lib/effort';
import { openTasks, Quadrant, Task, useAppState } from '@/lib/store';

/** Energy tints, from the status colours of the current scheme. */
const ENERGY_TINT = { 1: 'danger', 2: 'warning', 3: 'success' } as const;

/** '#RRGGBB' -> 'rgba(r,g,b,a)' so gradients fade within the same hue. */
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export default function Matrix() {
  const t = useTheme();
  const tasks = useAppState((s) => s.tasks);
  const [sheet, setSheet] = useState<{ open: boolean; task?: Task | null }>({ open: false });
  const today = useToday();

  const energy = useAppState((s) => s.energy[today]);
  const [showAll, setShowAll] = useState(false);
  const filtering = !!energy && !showAll;
  const shown = filtering ? fitEnergy(tasks, energy) : tasks;
  const open = tasks.filter((x) => !x.done);
  const dueToday = open.filter((x) => x.due && x.due <= today).length;

  return (
    <View style={{ flex: 1 }}>
      <Screen scroll={false} bottomInset={TabBarInset + 6}>
        <Animated.View entering={FadeInDown.duration(450)} style={styles.header}>
          <Pressable
            onPress={() => (tap(), router.push('/calendar'))}
            accessibilityRole="button"
            accessibilityLabel="Calendar"
            hitSlop={8}
            style={[styles.calBtn, { backgroundColor: t.surface, borderColor: t.line }]}>
            <Icon name="calendar" color={t.text} size={20} />
          </Pressable>
          <Text variant="label">Priorities</Text>
          <Text variant="title">Eisenhower Matrix</Text>
          <Text variant="small">
            {open.length === 0
              ? 'Sort what matters from what is merely loud.'
              : `${open.length} open${dueToday ? ` · ${dueToday} due today or late` : ''}`}
          </Text>
        </Animated.View>

        {!!energy && (
          <Tappable
            onPress={() => setShowAll(!showAll)}
            radius={Radius.sm}
            style={[styles.energy, { backgroundColor: withAlpha(t[ENERGY_TINT[energy]], 0.09), borderColor: withAlpha(t[ENERGY_TINT[energy]], 0.33) }]}>
            <Text variant="body">{energy === 1 ? '🪫' : energy === 2 ? '🔋' : '⚡'}</Text>
            <Text variant="caption" color="text" style={{ flex: 1 }}>
              {!filtering
                ? 'Showing every task.'
                : energy === 1
                  ? 'Low energy: showing Quick tasks only.'
                  : energy === 2
                    ? 'Medium energy: Deep work is hidden for today.'
                    : 'High energy: Deep work first.'}
            </Text>
            <Text variant="caption" strong color="accent">
              {filtering ? (energy === 3 ? 'Usual order' : 'Show all') : 'Fit my energy'}
            </Text>
          </Tappable>
        )}

        {tasks.length === 0 && (
          <Animated.View entering={FadeInDown.delay(120).duration(420)} style={[styles.emptyAll, { backgroundColor: t.surface, borderColor: t.line }]}>
            <EmptyState size={52} line="An empty matrix. Add one thing on your mind and sort it by urgency and importance." action="Add your first task" onAction={() => setSheet({ open: true, task: null })} />
          </Animated.View>
        )}

        <View style={styles.grid}>
          {[0, 2].map((start) => (
            <View key={start} style={styles.gridRow}>
              {QUADRANTS.slice(start, start + 2).map((info, i) => (
                <Animated.View
                  key={info.id}
                  entering={FadeInDown.delay(80 * (start + i)).duration(420)}
                  style={{ flex: 1 }}>
                  <QuadrantCard q={info.id} tasks={shown} keepOrder={filtering && energy === 3} today={today} onOpen={(task) => setSheet({ open: true, task })} />
                </Animated.View>
              ))}
            </View>
          ))}
        </View>
      </Screen>

      <Animated.View entering={ZoomIn.delay(350).springify()} style={[styles.fab, { bottom: TabBarInset + 18 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add task"
          onPress={() => (tap('medium'), setSheet({ open: true, task: null }))}
          style={({ pressed }) => [styles.fabBtn, { backgroundColor: t.brand, transform: [{ scale: pressed ? 0.94 : 1 }] }, Shadow.md]}>
          <Icon name="plus" color={t.brandText} size={28} strokeWidth={2.4} />
        </Pressable>
      </Animated.View>

      <TaskSheet visible={sheet.open} task={sheet.task} onClose={() => setSheet({ open: false })} />
    </View>
  );
}

function QuadrantCard({ q, tasks, today, onOpen, keepOrder }: { q: Quadrant; tasks: Task[]; today: string; onOpen: (t: Task) => void; keepOrder?: boolean }) {
  const t = useTheme();
  const { color, soft } = useQuadrantColors(q);
  const info = quadrantOf(q);
  const name = useQuadrantNames()(q);
  // On a high-energy day deep work comes first; otherwise the usual order (arranged, then due).
  const list = keepOrder ? deepFirst(openTasks(tasks, q)) : openTasks(tasks, q);
  // Keep today's completions visible (struck through) so ticking something off feels rewarded.
  const doneToday = tasks.filter((x) => x.quadrant === q && x.done && x.doneAt && dayKey(new Date(x.doneAt)) === today);

  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
      <LinearGradient colors={[soft, withAlpha(soft, 0)]} style={styles.cardTint} pointerEvents="none" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${info.meaning}, ${list.length} open`}
        onPress={() => (tap(), router.push({ pathname: '/quadrant/[q]', params: { q: String(q) } }))}
        style={styles.cardHead}>
        <View style={styles.cardTitleRow}>
          <QuadrantChip q={q} size={24} />
          <Text variant="headingSm" style={{ color, flex: 1 }} numberOfLines={1}>
            {name}
          </Text>
          {list.length > 0 && (
            <View style={[styles.count, { backgroundColor: color }]}>
              <Text variant="micro" strong style={[styles.tabular, { color: '#fff' }]}>
                {list.length}
              </Text>
            </View>
          )}
        </View>
        <Text variant="caption" numberOfLines={1}>
          {info.meaning}
        </Text>
      </Pressable>

      {list.length === 0 && doneToday.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="caption" color="textMuted" center>
            No tasks
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6 }}>
          {[...list, ...doneToday].map((task) => (
            <TaskRow key={task.id} task={task} today={today} onOpen={onOpen} compact />
          ))}
        </ScrollView>
      )}
      <LinearGradient colors={[withAlpha(t.surface, 0), t.surface]} style={styles.fade} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  energy: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 1 },
  emptyAll: { borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 10 },
  tabular: { fontVariant: ['tabular-nums'] },
  header: { gap: 2, marginTop: 8 },
  calBtn: { position: 'absolute', right: 0, top: 0, width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  grid: { flex: 1, gap: 12, marginTop: 4 },
  gridRow: { flex: 1, flexDirection: 'row', gap: 12 },
  card: { flex: 1, borderRadius: Radius.lg, borderWidth: 1, paddingHorizontal: Spacing.cardCompact, paddingTop: Spacing.cardCompact, overflow: 'hidden' },
  cardTint: { position: 'absolute', top: 0, left: 0, right: 0, height: 90 },
  cardHead: { gap: 3, marginBottom: 8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 28 },
  empty: { flex: 1, justifyContent: 'center', paddingBottom: 24 },
  fab: { position: 'absolute', right: 22 },
  fabBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
