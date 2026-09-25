/** Calendar: a month of due dates, coloured by quadrant. Pick a day to see, tick or add its tasks. */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { HeatLegend, MonthCalendar } from '@/components/calendar';
import { Icon } from '@/components/icons';
import { MoodOrb } from '@/components/mood-orb';
import { TaskRow, TaskSheet } from '@/components/tasks';
import { Text } from '@/components/text';
import { Button, Card, Divider, Screen, tap } from '@/components/ui';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { dayKey, fromKey, prettyDate } from '@/lib/dates';
import { moodOf } from '@/lib/moods';
import { HeatLevel, levelOf, workByDay, workLine } from '@/lib/productivity';
import { quadrantOf, sortOpen } from '@/lib/quadrants';
import { Task, useAppState } from '@/lib/store';

export default function CalendarScreen() {
  const t = useTheme();
  const dark = useIsDark();
  const tasks = useAppState((s) => s.tasks);
  const checkins = useAppState((s) => s.checkins);
  const garden = useAppState((s) => s.garden);
  const sessions = useAppState((s) => s.focus.sessions);
  const today = dayKey();
  const [day, setDay] = useState(today);
  const [sheet, setSheet] = useState<{ open: boolean; task?: Task | null }>({ open: false });

  // One dot per task due that day, in its quadrant colour (finished ones fade).
  const marks: Record<string, string[]> = {};
  for (const x of sortOpen(tasks.filter((x) => x.due))) {
    const c = quadrantOf(x.quadrant).color[dark ? 'dark' : 'light'];
    (marks[x.due!] ??= []).push(x.done ? t.textMuted : c);
  }

  // Past days are shaded by how much got done: tasks finished plus focus sessions.
  const work = workByDay(tasks, sessions);
  const heat: Record<string, HeatLevel> = Object.fromEntries(Object.entries(work).map(([k, w]) => [k, levelOf(w.score)]));

  const open = sortOpen(tasks.filter((x) => x.due === day && !x.done)).sort((a, b) => a.quadrant - b.quadrant);
  const done = tasks.filter((x) => x.due === day && x.done);
  const late = day === today ? tasks.filter((x) => !x.done && x.due && x.due < today) : [];
  const mood = moodOf(checkins[day]);
  const blooms = garden.filter((b) => dayKey(new Date(b.at)) === day).length;
  const onOpen = (task: Task) => setSheet({ open: true, task });

  return (
    <Screen>
      <Pressable hitSlop={12} onPress={() => (tap(), router.back())} accessibilityLabel="Back" style={{ height: 32, justifyContent: 'center' }}>
        <Icon name="back" color={t.textSecondary} />
      </Pressable>
      <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 4 }}>
        <Text variant="label">Calendar</Text>
        <Text variant="title">Your month</Text>
      </Animated.View>

      <Card>
        <MonthCalendar selected={day} onSelect={setDay} marks={marks} heat={heat} />
        <HeatLegend />
        <Text variant="small" color="textMuted" style={{ fontSize: 12 }}>
          Past days are shaded by tasks finished and focus sessions. Dots show tasks due.
        </Text>
      </Card>

      <Card>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text variant="label">{day === today ? 'Today' : 'Selected day'}</Text>
            <Text variant="heading">{prettyDate(fromKey(day))}</Text>
          </View>
          {mood && <MoodOrb mood={mood} size={34} face={false} />}
        </View>
        {day <= today && (
          <Text variant="small">
            {[workLine(work[day]), mood && `Mood: ${mood.label}`, blooms > 0 && `${blooms} ${blooms === 1 ? 'flower' : 'flowers'}`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}

        {open.length === 0 && done.length === 0 && late.length === 0 && <Text variant="small">Nothing due on this day.</Text>}
        {late.length > 0 && (
          <>
            <Text variant="label" style={{ color: t.accent }}>
              Late · {late.length}
            </Text>
            {late.map((task) => (
              <TaskRow key={task.id} task={task} today={today} onOpen={onOpen} />
            ))}
            {open.length > 0 && <Divider />}
          </>
        )}
        {open.map((task) => (
          <TaskRow key={task.id} task={task} today={today} onOpen={onOpen} />
        ))}
        {done.map((task) => (
          <TaskRow key={task.id} task={task} today={today} onOpen={onOpen} />
        ))}
        <Button title="Add a task on this day" icon="plus" kind="secondary" onPress={() => setSheet({ open: true, task: null })} style={{ marginTop: 6 }} />
      </Card>

      <TaskSheet visible={sheet.open} task={sheet.task} defaultDue={day} onClose={() => setSheet({ open: false })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
