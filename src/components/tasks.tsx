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
import { Effort, EFFORTS, effortInfo, rewardLine, stepProgress } from '@/lib/effort';
import { Text } from '@/components/text';
import { Button, Input, tap } from '@/components/ui';
import { defaultRepeat, RepeatDraft, RepeatEditor } from '@/components/repeat-editor';
import { Fonts, Radius } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { useQuadrantNames } from '@/lib/labels';
import { confirmThen } from '@/lib/confirm';
import { addDays, dayKey, fromKey, prettyDate } from '@/lib/dates';
import { dueBadge, QUADRANTS, quadrantOf } from '@/lib/quadrants';
import { clockText } from '@/lib/routines';
import { syncRoutinesNow } from '@/lib/routine-sync';
import {
  addRoutine,
  addStep,
  addTask,
  deleteRoutine,
  deleteStep,
  deleteTask,
  editRoutine,
  editTask,
  getRoutine,
  hapticsOn,
  logProgress,
  makeRoutineFrom,
  moveTask,
  openTasks,
  Quadrant,
  Routine,
  RoutineInput,
  Task,
  toggleStep,
  toggleTask,
  useAppState,
} from '@/lib/store';

export function useQuadrantColors(q: Quadrant) {
  const dark = useIsDark();
  const info = quadrantOf(q);
  return { color: dark ? info.color.dark : info.color.light, soft: dark ? info.soft.dark : info.soft.light };
}

/** White or near-black, whichever reads better on the given colour (WCAG relative luminance). */
function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => lin(c / 255));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? '#1D1B18' : '#FFFFFF';
}

export function QuadrantChip({ q, size = 26 }: { q: Quadrant; size?: number }) {
  const { color } = useQuadrantColors(q);
  const info = quadrantOf(q);
  return (
    <View style={[styles.chip, { backgroundColor: color, width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: inkOn(color), fontFamily: Fonts.display, fontSize: size * 0.46, lineHeight: size * 0.62 }}>
        {info.numeral}
      </Text>
    </View>
  );
}

export function Checkbox({ checked, color, onPress, size = 22, label }: { checked: boolean; color: string; onPress: () => void; size?: number; label?: string }) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      aria-checked={checked}
      onPress={() => {
        s.set(withSequence(withSpring(0.8, { stiffness: 600, damping: 20 }), withSpring(1, { damping: 10 })));
        if (hapticsOn()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
  const b = dueBadge(due, today);
  if (!b) return null;
  const color = b.tone === 'late' || b.tone === 'today' ? 'danger' : b.tone === 'soon' ? 'warningText' : 'textMuted';
  return (
    <Text variant="caption" strong color={color}>
      {b.text}
    </Text>
  );
}

export function TaskRow({ task, today, onOpen, compact }: { task: Task; today: string; onOpen: (t: Task) => void; compact?: boolean }) {
  const { color } = useQuadrantColors(task.quadrant);
  return (
    <Animated.View entering={FadeIn.duration(250)} style={[styles.row, compact && { paddingVertical: 5 }]}>
      <Checkbox checked={task.done} color={color} onPress={() => toggleTask(task.id)} size={compact ? 20 : 22} label={task.title} />
      <Pressable style={{ flex: 1 }} onPress={() => (tap(), onOpen(task))}>
        <Text
          variant={compact ? 'bodySm' : 'body'}
          color={task.done ? 'textMuted' : 'text'}
          numberOfLines={2}
          style={[!compact && styles.taskTitle, task.done && styles.struck]}>
          {task.title}
        </Text>
        <StepProgress task={task} compact={compact} />
        {!task.done && (task.due || task.effort) && (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {task.routineId && task.at && task.due === today ? (
              <View style={styles.routineMeta}>
                <Icon name="repeat" size={13} color={color} />
                <Text variant="caption" strong color="textSecondary">
                  {clockText(task.at)}
                </Text>
              </View>
            ) : (
              <DueBadge due={task.due} today={today} />
            )}
            {task.effort && (
              <Text variant="caption">
                {effortInfo(task.effort).emoji} {effortInfo(task.effort).label}
              </Text>
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** "2 of 5 steps" with a thin bar and the next step, for tasks split into steps. */
export function StepProgress({ task, compact }: { task: Task; compact?: boolean }) {
  const t = useTheme();
  const { color } = useQuadrantColors(task.quadrant);
  const p = stepProgress(task);
  if (!p || task.done) return null;
  return (
    <View style={{ gap: 3, marginTop: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={[styles.stepTrack, { backgroundColor: t.surfaceAlt, width: compact ? 44 : 64 }]}>
          <View style={{ width: `${Math.round((p.done / p.total) * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: color }} />
        </View>
        <Text variant="caption" style={styles.tabular}>
          {p.done}/{p.total} steps
        </Text>
      </View>
      {!!p.next && !compact && (
        <Text variant="caption" numberOfLines={1}>
          Next: {p.next}
        </Text>
      )}
    </View>
  );
}

/** Steps for a task that takes more than one sitting, and "I worked on it today". */
function StepsEditor({ task, big, draft, setDraft }: { task: Task | null; big: boolean; draft: string[]; setDraft: (s: string[]) => void }) {
  const t = useTheme();
  const today = useToday();
  const live = useAppState((s) => (task ? s.tasks.find((x) => x.id === task.id) : undefined));
  const [text, setText] = useState('');
  const steps = live?.steps ?? [];
  const worked = live?.workedOn ?? [];
  const hasSteps = task ? steps.length > 0 : draft.length > 0;

  function add() {
    const clean = text.trim();
    if (!clean) return;
    tap();
    if (task) addStep(task.id, clean);
    else setDraft([...draft, clean]);
    setText('');
  }

  return (
    <View style={{ gap: 10 }}>
      <Text variant="label">Steps{hasSteps ? '' : ' (optional)'}</Text>
      {big && !hasSteps && (
        <Text variant="caption">
          A bigger task rarely fits in one day. Break it into steps you can finish in one sitting; each day you make
          progress grows a flower.
        </Text>
      )}
      {task
        ? steps.map((st) => (
            <View key={st.id} style={styles.stepRow}>
              <Checkbox checked={st.done} color={t.brand} onPress={() => toggleStep(task.id, st.id)} size={20} label={st.title} />
              <Text variant="bodySm" style={[{ flex: 1 }, st.done && styles.struck]} color={st.done ? 'textMuted' : 'text'}>
                {st.title}
              </Text>
              <Pressable onPress={() => (tap(), deleteStep(task.id, st.id))} hitSlop={8} accessibilityLabel={`Remove step ${st.title}`}>
                <Icon name="close" color={t.textMuted} size={16} />
              </Pressable>
            </View>
          ))
        : draft.map((st, i) => (
            <View key={i} style={styles.stepRow}>
              <Text variant="small">{i + 1}.</Text>
              <Text variant="bodySm" color="text" style={{ flex: 1 }}>
                {st}
              </Text>
              <Pressable onPress={() => (tap(), setDraft(draft.filter((_, j) => j !== i)))} hitSlop={8} accessibilityLabel={`Remove step ${st}`}>
                <Icon name="close" color={t.textMuted} size={16} />
              </Pressable>
            </View>
          ))}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Input value={text} onChangeText={setText} placeholder="Add a step, e.g. Draft the introduction" onSubmitEditing={add} returnKeyType="done" maxLength={80} />
        </View>
        <Pressable onPress={add} accessibilityRole="button" accessibilityLabel="Add step" style={[styles.stepAdd, { backgroundColor: text.trim() ? t.brand : t.surfaceAlt }]}>
          <Icon name="plus" color={text.trim() ? t.brandText : t.textMuted} size={20} />
        </Pressable>
      </View>
      {task && live && !live.done && (
        <Pressable
          onPress={() => {
            if (logProgress(task.id)) tap('medium');
          }}
          disabled={worked.includes(today)}
          accessibilityRole="button"
          style={[styles.worked, { borderColor: worked.includes(today) ? t.success : t.line, backgroundColor: worked.includes(today) ? t.successSoft : 'transparent' }]}>
          <Text variant="numeral">{worked.includes(today) ? '🌱' : '⏳'}</Text>
          <View style={{ flex: 1 }}>
            <Text variant="bodySm" strong color="text">
              {worked.includes(today) ? 'Progress noted today' : 'I worked on it today'}
            </Text>
            <Text variant="caption">
              {worked.length ? `Worked on ${worked.length} ${worked.length === 1 ? 'day' : 'days'} so far. ` : ''}One flower for each day of progress.
            </Text>
          </View>
        </Pressable>
      )}
    </View>
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
  /** A routine to edit directly (from the Routines screen), when no task of it is open. */
  routine?: Routine | null;
};

export function TaskSheet(props: SheetProps) {
  // Remount the form each time the sheet opens so it starts from the right values.
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      {props.visible && <SheetBody {...props} />}
    </Modal>
  );
}

function SheetBody({ onClose, task, defaultQuadrant = 1, defaultDue, routine: routineProp }: SheetProps) {
  const t = useTheme();
  const today = useToday();
  // The routine behind this sheet: the one passed in, or the one that added this task.
  const [routine] = useState<Routine | undefined>(() => routineProp ?? getRoutine(task?.routineId));
  const [repeat, setRepeat] = useState<RepeatDraft>(() =>
    routine
      ? { kind: routine.kind, weekdays: routine.weekdays ?? [fromKey(today).getDay()], every: routine.every ?? 3, times: routine.times, remind: routine.remind }
      : defaultRepeat(fromKey(today)),
  );
  const repeating = repeat.kind !== 'once';
  const [title, setTitle] = useState(routine?.title ?? task?.title ?? '');
  const [q, setQ] = useState<Quadrant>(routine?.quadrant ?? task?.quadrant ?? defaultQuadrant);
  const [due, setDue] = useState<string | undefined>(task ? task.due : defaultDue);
  const [picking, setPicking] = useState(false);
  const [effort, setEffort] = useState<Effort | undefined>(routine ? routine.effort : task?.effort);
  // Steps typed for a new task are kept here until it is added.
  const [draftSteps, setDraftSteps] = useState<string[]>([]);
  const presets = DUE_CHOICES.map((c) => (c.days === null ? undefined : dayKey(addDays(fromKey(today), c.days))));
  const custom = !!due && !presets.includes(due);
  // Position of this task among the open tasks of its quadrant (for Move up / Move down).
  const siblings = useAppState((s) => s.tasks);
  const list = task && !task.done ? openTasks(siblings, task.quadrant).map((x) => x.id) : [];
  const index = task ? list.indexOf(task.id) : -1;

  function save() {
    const clean = title.trim();
    if (!clean) return;
    if (repeating) {
      const input: RoutineInput = {
        title: clean,
        quadrant: q,
        effort,
        kind: repeat.kind as Routine['kind'],
        times: repeat.times,
        remind: repeat.remind,
        ...(repeat.kind === 'weekly' ? { weekdays: repeat.weekdays } : {}),
        ...(repeat.kind === 'interval' ? { every: repeat.every } : {}),
      };
      if (routine) editRoutine(routine.id, input);
      else if (task) makeRoutineFrom(task.id, input);
      else addRoutine(input);
      // Asks for notification permission the first time a reminder is switched on.
      if (repeat.remind) void syncRoutinesNow(true);
      if (hapticsOn()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
      return;
    }
    // Switched back to One time: the routine stops, and today's task of it stays as an ordinary task.
    if (routine) deleteRoutine(routine.id);
    if (task) editTask(task.id, { title: clean, quadrant: q, due, effort });
    else if (!routine) {
      const created = addTask(clean, q, due, effort);
      for (const st of draftSteps) addStep(created.id, st);
    }
    if (hapticsOn()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: t.surface }]}>
        <View style={[styles.grabber, { backgroundColor: t.line }]} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 18 }}>
          <Text variant="heading">{routine ? 'Edit routine' : task ? 'Edit task' : repeating ? 'New routine' : 'New task'}</Text>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="What needs doing?"
            autoFocus={!task}
            returnKeyType="done"
            onSubmitEditing={save}
          />

          <RepeatEditor value={repeat} onChange={setRepeat} />

          <View style={{ gap: 10 }}>
            <Text variant="label">Where does it belong?</Text>
            <View style={styles.qGrid}>
              {QUADRANTS.map((info) => (
                <QuadrantOption key={info.id} q={info.id} selected={q === info.id} onPress={() => setQ(info.id)} />
              ))}
            </View>
          </View>

          {!repeating && (
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
                    <Text variant="small" strong style={{ color: on ? t.background : t.text }}>
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
              <Text variant="small" strong style={{ color: custom ? t.background : t.text }}>
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
          )}

          <View style={{ gap: 10 }}>
            <Text variant="label">Effort (optional)</Text>
            <View style={styles.effortGrid}>
              {EFFORTS.map((e) => {
                const on = effort === e.id;
                return (
                  <Pressable
                    key={e.id}
                    onPress={() => (tap(), setEffort(on ? undefined : e.id))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${e.label}: ${e.hint}`}
                    style={[styles.effort, { borderColor: on ? e.tint : t.line, backgroundColor: on ? e.tint + '1F' : 'transparent' }]}>
                    <Text variant="numeral">{e.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodySm" strong color="text">
                        {e.label}
                      </Text>
                      <Text variant="caption">{e.hint}</Text>
                      <Text variant="micro" strong style={{ color: e.tint }}>
                        {rewardLine(e.id)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Text variant="caption">
              Low energy shows Quick tasks only; medium hides Deep work; high shows everything, Deep work first.
            </Text>
          </View>

          {!repeating && !routine && (
            <StepsEditor task={task ?? null} big={effort === 'moderate' || effort === 'deep'} draft={draftSteps} setDraft={setDraftSteps} />
          )}

          <Button
            title={task || routine ? 'Save changes' : repeating ? 'Add routine' : 'Add task'}
            icon={task || routine ? 'check' : 'plus'}
            onPress={save}
            disabled={!title.trim()}
          />
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
          {routine && (
            <Pressable
              onPress={() =>
                confirmThen('Stop this routine?', `${routine.title} will not come back. Finished days keep their flowers.`, 'Stop', () => {
                  deleteRoutine(routine.id, true);
                  onClose();
                })
              }
              style={styles.delete}>
              <Icon name="repeat" color={t.textMuted} size={18} />
              <Text variant="small" color="textMuted">
                Stop repeating
              </Text>
            </Pressable>
          )}
          {task && (
            <Pressable
              onPress={() =>
                confirmThen(task.routineId ? 'Skip this one today?' : 'Delete this task?', task.title, task.routineId ? 'Skip' : 'Delete', () => {
                  deleteTask(task.id);
                  onClose();
                })
              }
              style={styles.delete}>
              <Icon name="trash" color={t.textMuted} size={18} />
              <Text variant="small" color="textMuted">
                {task.routineId ? 'Skip today' : 'Delete task'}
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
  const qName = useQuadrantNames();
  return (
    <Pressable
      onPress={() => (tap(), onPress())}
      accessibilityRole="radio"
      aria-selected={selected}
      style={[styles.qOption, { backgroundColor: selected ? soft : t.background, borderColor: selected ? color : t.line }]}>
      <QuadrantChip q={q} size={24} />
      <View style={{ flex: 1 }}>
        <Text variant="bodySm" strong style={{ color: selected ? color : t.text }}>
          {qName(q)}
        </Text>
        <Text variant="caption">
          {info.meaning}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stepTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 34 },
  stepAdd: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  worked: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: Radius.md, borderWidth: 1.5 },
  effortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  effort: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: Radius.md, borderWidth: 1.5 },
  chip: { alignItems: 'center', justifyContent: 'center' },
  box: { borderWidth: 2, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 7 },
  struck: { textDecorationLine: 'line-through' },
  // A task title reads as body text but a touch tighter, so two lines stay compact.
  taskTitle: { lineHeight: 22 },
  tabular: { fontVariant: ['tabular-nums'] },
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
  routineMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dueChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1 },
  delete: { flexDirection: 'row', gap: 8, alignSelf: 'center', alignItems: 'center', padding: 8 },
});
