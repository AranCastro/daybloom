/** One quadrant, full screen: every open task, today's completions and older completed tasks. */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { QuadrantChip, TaskRow, TaskSheet, useQuadrantColors } from '@/components/tasks';
import { Text } from '@/components/text';
import { Button, Card, Divider, Screen, tap } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { dayKey } from '@/lib/dates';
import { quadrantOf } from '@/lib/quadrants';
import { clearCompleted, openTasks, Quadrant, Task, useAppState } from '@/lib/store';

export default function QuadrantScreen() {
  const t = useTheme();
  const params = useLocalSearchParams<{ q: string }>();
  const q = (Math.min(4, Math.max(1, Number(params.q) || 1)) as Quadrant);
  const info = quadrantOf(q);
  const { color, soft } = useQuadrantColors(q);
  const tasks = useAppState((s) => s.tasks);
  const [sheet, setSheet] = useState<{ open: boolean; task?: Task | null }>({ open: false });
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
        <Text variant="label">Open · {open.length}</Text>
        {open.length === 0 ? (
          <Text variant="small">Nothing waiting here.</Text>
        ) : (
          open.map((task, i) => (
            <View key={task.id}>
              {i > 0 && <Divider />}
              <TaskRow task={task} today={today} onOpen={onOpen} />
            </View>
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

const styles = StyleSheet.create({
  top: { height: 32, justifyContent: 'center' },
  hero: { borderRadius: 26, padding: 22, gap: 6 },
  doneHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
