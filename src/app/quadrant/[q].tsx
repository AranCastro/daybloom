/** One quadrant, full screen: every open task, today's completions and older completed tasks. */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { DueBadge, QuadrantChip, TaskRow, TaskSheet, useQuadrantColors } from '@/components/tasks';
import { Text } from '@/components/text';
import { Button, Card, Divider, Screen, tap } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey } from '@/lib/dates';
import { quadrantOf } from '@/lib/quadrants';
import { clearCompleted, moveTask, openTasks, Quadrant, Task, useAppState } from '@/lib/store';

export default function QuadrantScreen() {
  const t = useTheme();
  const params = useLocalSearchParams<{ q: string }>();
  const q = (Math.min(4, Math.max(1, Number(params.q) || 1)) as Quadrant);
  const info = quadrantOf(q);
  const { color, soft } = useQuadrantColors(q);
  const tasks = useAppState((s) => s.tasks);
  const [sheet, setSheet] = useState<{ open: boolean; task?: Task | null }>({ open: false });
  const [arranging, setArranging] = useState(false);
  const today = dayKey();

  const open = openTasks(tasks, q);
  const done = tasks.filter((x) => x.quadrant === q && x.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  const onOpen = (task: Task) => setSheet({ open: true, task });

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable hitSlop={12} onPress={() => (tap(), router.back())} accessibilityLabel="Back">
          <Icon name="back" color={t.textSecondary} />
        </Pressable>
      </View>

      <Animated.View entering={FadeInDown.duration(400)} style={[styles.hero, { backgroundColor: soft }]}>
        <QuadrantChip q={q} size={40} />
        <Text variant="title" style={{ color }}>
          {info.action}
        </Text>
        <Text variant="label">{info.meaning}</Text>
        <Text variant="body" color="textSecondary">
          {info.hint}
        </Text>
      </Animated.View>

      <Card>
        <View style={styles.doneHead}>
          <Text variant="label">Open · {open.length}</Text>
          {open.length > 1 && (
            <Pressable onPress={() => (tap(), setArranging((a) => !a))} hitSlop={8} accessibilityRole="button">
              <Text variant="small" color="accent" style={{ fontFamily: Fonts.bodyStrong }}>
                {arranging ? 'Done' : 'Arrange'}
              </Text>
            </Pressable>
          )}
        </View>
        {arranging && open.length > 1 && (
          <Text variant="small">Use the arrows to put your tasks in the order you want. The home screen widget follows it.</Text>
        )}
        {open.length === 0 ? (
          <Text variant="small">Nothing waiting here.</Text>
        ) : (
          open.map((task, i) => (
            <Animated.View key={task.id} layout={LinearTransition.duration(220)}>
              {i > 0 && <Divider />}
              {arranging && open.length > 1 ? (
                <ArrangeRow task={task} today={today} first={i === 0} last={i === open.length - 1} color={color} />
              ) : (
                <TaskRow task={task} today={today} onOpen={onOpen} />
              )}
            </Animated.View>
          ))
        )}
        <Button title="Add a task here" icon="plus" kind="secondary" onPress={() => setSheet({ open: true, task: null })} style={{ marginTop: 6 }} />
      </Card>

      {done.length > 0 && (
        <Card>
          <View style={styles.doneHead}>
            <Text variant="label">Completed · {done.length}</Text>
            <Pressable onPress={() => (tap(), clearCompleted())} hitSlop={8}>
              <Text variant="small" color="accent">
                Clear all completed
              </Text>
            </Pressable>
          </View>
          {done.slice(0, 20).map((task) => (
            <TaskRow key={task.id} task={task} today={today} onOpen={onOpen} />
          ))}
        </Card>
      )}

      <TaskSheet visible={sheet.open} task={sheet.task} defaultQuadrant={q} onClose={() => setSheet({ open: false })} />
    </Screen>
  );
}

/** A task in Arrange mode: title, due badge and up/down arrows. */
function ArrangeRow({ task, today, first, last, color }: { task: Task; today: string; first: boolean; last: boolean; color: string }) {
  const t = useTheme();
  const arrow = (dir: 'up' | 'down', disabled: boolean) => (
    <Pressable
      disabled={disabled}
      onPress={() => (tap(), moveTask(task.id, dir))}
      onLongPress={() => (tap('medium'), moveTask(task.id, dir === 'up' ? 'top' : 'bottom'))}
      accessibilityRole="button"
      accessibilityLabel={`Move ${dir}: ${task.title}`}
      hitSlop={4}
      style={({ pressed }) => [styles.arrow, { backgroundColor: t.surfaceAlt, opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}>
      <View style={{ transform: [{ rotate: dir === 'up' ? '-90deg' : '90deg' }] }}>
        <Icon name="arrow" color={color} size={18} />
      </View>
    </Pressable>
  );
  return (
    <View style={styles.arrange}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" numberOfLines={2}>
          {task.title}
        </Text>
        <DueBadge due={task.due} today={today} />
      </View>
      {arrow('up', first)}
      {arrow('down', last)}
    </View>
  );
}

const styles = StyleSheet.create({
  arrange: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  arrow: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  top: { height: 32, justifyContent: 'center' },
  hero: { borderRadius: 26, padding: 22, gap: 6 },
  doneHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
