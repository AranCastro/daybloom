/** Building blocks for the Eisenhower matrix: checkbox, task row, due badge, quadrant chip and the task sheet. */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { MonthCalendar } from '@/components/calendar';
import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Button, Input, tap } from '@/components/ui';
import { Fonts, Radius } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { addDays, dayKey, fromKey, prettyDate } from '@/lib/dates';
import { dueBadge, QUADRANTS, quadrantOf } from '@/lib/quadrants';
import { addTask, deleteTask, editTask, moveTask, openTasks, Quadrant, Task, toggleTask, useAppState } from '@/lib/store';

export function useQuadrantColors(q: Quadrant) {
  const dark = useIsDark();
  const info = quadrantOf(q);
  return { color: dark ? info.color.dark : info.color.light, soft: dark ? info.soft.dark : info.soft.light };
}

export function QuadrantChip({ q, size = 26 }: { q: Quadrant; size?: number }) {
  const { color } = useQuadrantColors(q);
  const info = quadrantOf(q);
  return (
    <View style={[styles.chip, { backgroundColor: color, width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: '#fff', fontFamily: Fonts.display, fontSize: size * 0.46, lineHeight: size * 0.62 }}>
        {info.numeral}
      </Text>
    </View>
  );
}

export function Checkbox({ checked, color, onPress, size = 22 }: { checked: boolean; color: string; onPress: () => void; size?: number }) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      hitSlop={10}
      accessibilityRole="checkbox"
      aria-checked={checked}
      onPress={() => {
        s.set(withSequence(withSpring(0.8, { stiffness: 600, damping: 20 }), withSpring(1, { damping: 10 })));
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}>
      <Animated.View
        style={[
          styles.box,
          { width: size, height: size, borderColor: color, backgroundColor: checked ? color : 'transparent' },
          anim,
        ]}>
        {checked && <Icon name="check" color="#fff" size={size - 6} strokeWidth={2.6} />}
      </Animated.View>
    </Pressable>
  );
}

export function DueBadge({ due, today }: { due?: string; today: string }) {
  const t = useTheme();
  const dark = useIsDark();
  const b = dueBadge(due, today);
  if (!b) return null;
  const color =
    b.tone === 'late' || b.tone === 'today'
      ? dark ? '#F08A74' : '#C9503B'
      : b.tone === 'soon'
        ? dark ? '#EDB65A' : '#B57A12'
        : t.textMuted;
  return (
    <Text variant="small" style={{ color, fontSize: 12, fontFamily: Fonts.bodyStrong }}>
      {b.text}
    </Text>
  );
}

export function TaskRow({ task, today, onOpen, compact }: { task: Task; today: string; onOpen: (t: Task) => void; compact?: boolean }) {
  const { color } = useQuadrantColors(task.quadrant);
  return (
    <Animated.View entering={FadeIn.duration(250)} style={[styles.row, compact && { paddingVertical: 5 }]}>
      <Checkbox checked={task.done} color={color} onPress={() => toggleTask(task.id)} size={compact ? 20 : 22} />
      <Pressable style={{ flex: 1 }} onPress={() => (tap(), onOpen(task))}>
        <Text
          variant="body"
          color={task.done ? 'textMuted' : 'text'}
          numberOfLines={2}
          style={[{ fontSize: compact ? 14.5 : 16, lineHeight: compact ? 19 : 22 }, task.done && styles.struck]}>
          {task.title}
        </Text>
        {!task.done && <DueBadge due={task.due} today={today} />}
      </Pressable>
    </Animated.View>
  );
}

// ── Add / edit sheet ────────────────────────────────────────────────────────

type DueChoice = { label: string; days: number | null };
const DUE_CHOICES: DueChoice[] = [
  { label: 'No date', days: null },
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
];

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Existing task to edit; omit to create. */
  task?: Task | null;
  defaultQuadrant?: Quadrant;
  /** Due date for a new task (e.g. the day picked in the calendar). */
  defaultDue?: string;
};

export function TaskSheet(props: SheetProps) {
  // Remount the form each time the sheet opens so it starts from the right values.
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      {props.visible && <SheetBody {...props} />}
    </Modal>
  );
}

function SheetBody({ onClose, task, defaultQuadrant = 1, defaultDue }: SheetProps) {
  const t = useTheme();
  const today = dayKey();
  const [title, setTitle] = useState(task?.title ?? '');
  const [q, setQ] = useState<Quadrant>(task?.quadrant ?? defaultQuadrant);
  const [due, setDue] = useState<string | undefined>(task ? task.due : defaultDue);
  const [picking, setPicking] = useState(false);
  const presets = DUE_CHOICES.map((c) => (c.days === null ? undefined : dayKey(addDays(fromKey(today), c.days))));
  const custom = !!due && !presets.includes(due);
  // Position of this task among the open tasks of its quadrant (for Move up / Move down).
  const siblings = useAppState((s) => s.tasks);
  const list = task && !task.done ? openTasks(siblings, task.quadrant).map((x) => x.id) : [];
  const index = task ? list.indexOf(task.id) : -1;

  function save() {
    const clean = title.trim();
    if (!clean) return;
    if (task) editTask(task.id, { title: clean, quadrant: q, due });
    else addTask(clean, q, due);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: t.surface }]}>
        <View style={[styles.grabber, { backgroundColor: t.line }]} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 18 }}>
          <Text variant="heading">{task ? 'Edit task' : 'New task'}</Text>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="What needs doing?"
            autoFocus={!task}
            returnKeyType="done"
            onSubmitEditing={save}
          />

          <View style={{ gap: 10 }}>
            <Text variant="label">Where does it belong?</Text>
            <View style={styles.qGrid}>
              {QUADRANTS.map((info) => (
                <QuadrantOption key={info.id} q={info.id} selected={q === info.id} onPress={() => setQ(info.id)} />
              ))}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text variant="label">Due</Text>
            <View style={styles.dueWrap}>
              {DUE_CHOICES.map((c) => {
                const value = c.days === null ? undefined : dayKey(addDays(fromKey(today), c.days));
                const on = value === due;
                return (
                  <Pressable
                    key={c.label}
                    onPress={() => (tap(), setDue(value), setPicking(false))}
                    style={[styles.dueChip, { borderColor: on ? t.text : t.line, backgroundColor: on ? t.text : 'transparent' }]}>
                    <Text variant="small" style={{ color: on ? t.background : t.text, fontFamily: Fonts.bodyStrong }}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => (tap(), setPicking((v) => !v))}
              accessibilityRole="button"
              accessibilityLabel="Pick a date"
              style={[styles.dueChip, styles.pick, { borderColor: custom || picking ? t.text : t.line, backgroundColor: custom ? t.text : 'transparent' }]}>
              <Icon name="calendar" color={custom ? t.background : t.text} size={16} />
              <Text variant="small" style={{ color: custom ? t.background : t.text, fontFamily: Fonts.bodyStrong }}>
                {custom && due ? prettyDate(fromKey(due)) : 'Pick a date'}
              </Text>
            </Pressable>
            {picking && (
              <View style={[styles.calendar, { borderColor: t.line }]}>
                <MonthCalendar
                  compact
                  selected={due}
                  onSelect={(d) => {
                    setDue(d);
                    setPicking(false);
                  }}
                />
              </View>
            )}
            {due && !picking && <Text variant="small">{prettyDate(fromKey(due))}</Text>}
          </View>

          <Button title={task ? 'Save changes' : 'Add task'} icon={task ? 'check' : 'plus'} onPress={save} disabled={!title.trim()} />
          {index >= 0 && list.length > 1 && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Move up" kind="secondary" disabled={index === 0} onPress={() => moveTask(task!.id, 'up')} style={{ flex: 1 }} />
              <Button title="Move down" kind="secondary" disabled={index === list.length - 1} onPress={() => moveTask(task!.id, 'down')} style={{ flex: 1 }} />
            </View>
          )}
          {task && !task.done && (
            <Button
              title="Focus on this task"
              icon="clock"
              kind="secondary"
              onPress={() => {
                onClose();
                router.push({ pathname: '/focus', params: { task: task.id } });
              }}
            />
          )}
          {task && (
            <Pressable
              onPress={() => {
                deleteTask(task.id);
                onClose();
              }}
              style={styles.delete}>
              <Icon name="trash" color={t.textMuted} size={18} />
              <Text variant="small" color="textMuted">
                Delete task
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function QuadrantOption({ q, selected, onPress }: { q: Quadrant; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const { color, soft } = useQuadrantColors(q);
  const info = quadrantOf(q);
  return (
    <Pressable
      onPress={() => (tap(), onPress())}
      accessibilityRole="radio"
      aria-selected={selected}
      style={[styles.qOption, { backgroundColor: selected ? soft : t.background, borderColor: selected ? color : t.line }]}>
      <QuadrantChip q={q} size={24} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" style={{ color: selected ? color : t.text, fontSize: 14.5 }}>
          {info.action}
        </Text>
        <Text variant="small" style={{ fontSize: 11.5, lineHeight: 15 }}>
          {info.meaning}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', justifyContent: 'center' },
  box: { borderWidth: 2, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 7 },
  struck: { textDecorationLine: 'line-through' },
  scrim: { flex: 1, backgroundColor: 'rgba(10,8,6,0.38)' },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 36,
    maxHeight: '88%',
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  qGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qOption: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  dueWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  calendar: { borderWidth: 1, borderRadius: Radius.md, padding: 10 },
  dueChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1 },
  delete: { flexDirection: 'row', gap: 8, alignSelf: 'center', alignItems: 'center', padding: 8 },
});
