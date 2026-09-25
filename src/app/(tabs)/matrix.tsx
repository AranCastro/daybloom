import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { QuadrantChip, TaskRow, TaskSheet, useQuadrantColors } from '@/components/tasks';
import { Text } from '@/components/text';
import { Screen, tap } from '@/components/ui';
import { TabBarInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey } from '@/lib/dates';
import { QUADRANTS, quadrantOf } from '@/lib/quadrants';
import { openTasks, Quadrant, Task, useAppState } from '@/lib/store';

/** '#RRGGBB' -> 'rgba(r,g,b,a)' so gradients fade within the same hue. */
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export default function Matrix() {
  const t = useTheme();
  const tasks = useAppState((s) => s.tasks);
  const [sheet, setSheet] = useState<{ open: boolean; task?: Task | null }>({ open: false });
  const today = dayKey();

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

        <View style={styles.grid}>
          {[0, 2].map((start) => (
            <View key={start} style={styles.gridRow}>
              {QUADRANTS.slice(start, start + 2).map((info, i) => (
                <Animated.View
                  key={info.id}
                  entering={FadeInDown.delay(80 * (start + i)).duration(420)}
                  style={{ flex: 1 }}>
                  <QuadrantCard q={info.id} tasks={tasks} today={today} onOpen={(task) => setSheet({ open: true, task })} />
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
          style={({ pressed }) => [styles.fabBtn, { backgroundColor: t.brand, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
          <Icon name="plus" color={t.brandText} size={28} strokeWidth={2.4} />
        </Pressable>
      </Animated.View>

      <TaskSheet visible={sheet.open} task={sheet.task} onClose={() => setSheet({ open: false })} />
    </View>
  );
}

function QuadrantCard({ q, tasks, today, onOpen }: { q: Quadrant; tasks: Task[]; today: string; onOpen: (t: Task) => void }) {
  const t = useTheme();
  const { color, soft } = useQuadrantColors(q);
  const info = quadrantOf(q);
  const list = openTasks(tasks, q);
  // Keep today's completions visible (struck through) so ticking something off feels rewarded.
  const doneToday = tasks.filter((x) => x.quadrant === q && x.done && x.doneAt && dayKey(new Date(x.doneAt)) === today);

  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
      <LinearGradient colors={[soft, withAlpha(soft, 0)]} style={styles.cardTint} pointerEvents="none" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${info.action}, ${info.meaning}, ${list.length} open`}
        onPress={() => (tap(), router.push({ pathname: '/quadrant/[q]', params: { q: String(q) } }))}
        style={styles.cardHead}>
        <View style={styles.cardTitleRow}>
          <QuadrantChip q={q} size={24} />
          <Text variant="heading" style={{ color, fontSize: 17, lineHeight: 21, flex: 1 }} numberOfLines={1}>
            {info.action}
          </Text>
          {list.length > 0 && (
            <View style={[styles.count, { backgroundColor: color }]}>
              <Text variant="bodyStrong" style={{ color: '#fff', fontSize: 11.5, lineHeight: 15 }}>
                {list.length}
              </Text>
            </View>
          )}
        </View>
        <Text variant="small" style={{ fontSize: 11.5, lineHeight: 15 }} numberOfLines={1}>
          {info.meaning}
        </Text>
      </Pressable>

      {list.length === 0 && doneToday.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="small" color="textMuted" center style={{ fontSize: 12.5 }}>
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
  header: { gap: 2, marginTop: 8 },
  calBtn: { position: 'absolute', right: 0, top: 0, width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  grid: { flex: 1, gap: 12, marginTop: 4 },
  gridRow: { flex: 1, flexDirection: 'row', gap: 12 },
  card: { flex: 1, borderRadius: 24, borderWidth: 1, paddingHorizontal: 14, paddingTop: 14, overflow: 'hidden' },
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
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
});
