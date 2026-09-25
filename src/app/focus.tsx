/** Pomodoro focus timer with a Focus Garden: each finished session grows a flower. */
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedProps, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Bud, Flower } from '@/components/flower';
import { Confetti, haptic } from '@/components/games/fx';
import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Button, Card, Choice, Screen, tap } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { dayKey } from '@/lib/dates';
import { FlowerKind, flowerOf, FLOWERS, RARITY_LABEL } from '@/lib/flowers';
import {
  completeBreak,
  completeFocus,
  FocusPreset,
  FocusSession,
  focusStreak,
  fmtClock,
  pauseTimer,
  PRESETS,
  remaining,
  resumeTimer,
  sessionsOn,
  startBreak,
  startFocus,
  stopTimer,
} from '@/lib/focus';
import { isLow } from '@/lib/moods';
import { getState, openTasks, toggleTask, useAppState } from '@/lib/store';

const RING = 280;
const STROKE = 10;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function confirmStop(onYes: () => void) {
  const title = 'Stop this session?';
  const msg = 'The flower will not grow if you stop now.';
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${msg}`)) onYes();
    return;
  }
  Alert.alert(title, msg, [
    { text: 'Keep going', style: 'cancel' },
    { text: 'Stop', style: 'destructive', onPress: onYes },
  ]);
}

export default function FocusScreen() {
  const t = useTheme();
  const dark = useIsDark();
  const params = useLocalSearchParams<{ task?: string }>();
  const active = useAppState((s) => s.focus.active);
  const sessions = useAppState((s) => s.focus.sessions);
  const tasks = useAppState((s) => s.tasks);
  const lowToday = useAppState((s) => isLow(s.checkins[dayKey()]));

  const [now, setNow] = useState(() => Date.now());
  const [reward, setReward] = useState<{ flower: FlowerKind; session: FocusSession } | null>(null);
  const [breakOver, setBreakOver] = useState(false);
  const [preset, setPreset] = useState<FocusPreset>(active?.preset ?? (lowToday ? 'gentle' : 'classic'));
  const [taskId, setTaskId] = useState<string | undefined>(params.task);

  // One ticker: refreshes the clock and completes a timer that has run out (also after the app was closed).
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      const a = getState().focus.active;
      if (!a || a.endAt === null || a.endAt > Date.now()) return;
      if (a.kind === 'focus') {
        const r = completeFocus();
        if (r) {
          haptic.success();
          setReward(r);
        }
      } else if (completeBreak()) {
        haptic.success();
        setBreakOver(true);
      }
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 250);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const running = !!active && active.endAt !== null;
  useEffect(() => {
    if (!running) return;
    activateKeepAwakeAsync('focus').catch(() => {});
    return () => {
      deactivateKeepAwake('focus').catch(() => {});
    };
  }, [running]);

  const left = active ? remaining(active, now) : PRESETS[preset].focus * 60_000;
  const total = active ? active.total : PRESETS[preset].focus * 60_000;
  const progress = active ? 1 - left / total : 0;
  const ringColor = active?.kind === 'break' ? (dark ? '#6CC4A6' : '#3A9477') : t.accent;

  const ring = useSharedValue(0);
  useEffect(() => {
    ring.set(withTiming(progress, { duration: 300, easing: Easing.linear }));
  }, [progress, ring]);
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - ring.value) }));

  const today = sessionsOn(sessions, dayKey());
  const focusTask = tasks.find((x) => x.id === (active?.taskId ?? taskId));
  // The task saved with the finished session (survives the app being closed mid-session).
  const rewardTask = reward?.session.taskId ? tasks.find((x) => x.id === reward.session.taskId) : undefined;
  const candidates = [...openTasks(tasks, 1), ...openTasks(tasks, 2)].slice(0, 6);

  function begin() {
    setBreakOver(false);
    setReward(null);
    haptic.medium();
    startFocus(preset, taskId);
  }

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable hitSlop={12} onPress={() => (tap(), router.back())} accessibilityLabel="Back">
          <Icon name="back" color={t.textSecondary} />
        </Pressable>
        <View style={[styles.todayPill, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Icon name="leaf" color="#3A9477" size={15} />
          <Text variant="bodyStrong" style={{ fontSize: 13 }}>
            {today.length} today
          </Text>
        </View>
      </View>

      {reward ? (
        <RewardView
          reward={reward}
          todayCount={today.length}
          total={sessions.length}
          taskTitle={rewardTask && !rewardTask.done ? rewardTask.title : undefined}
          onTaskDone={() => reward.session.taskId && toggleTask(reward.session.taskId)}
          restMinutes={PRESETS[preset].rest}
          onBreak={() => {
            setReward(null);
            startBreak(preset);
          }}
          onSkip={() => setReward(null)}
        />
      ) : (
        <>
          <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 2 }}>
            <Text variant="label">{active?.kind === 'break' ? 'Break' : 'Focus'}</Text>
            <Text variant="title">
              {active?.kind === 'break' ? 'Rest your eyes.' : breakOver ? 'Break over.' : active ? 'Growing…' : 'Grow a flower.'}
            </Text>
            <Text variant="small">
              {active?.kind === 'break'
                ? 'Stand up, stretch, drink some water.'
                : active
                  ? focusTask
                    ? `On: ${focusTask.title}`
                    : 'Stay with one thing until the bud opens.'
                  : 'Finish a focus session and a new flower joins your garden.'}
            </Text>
          </Animated.View>

          <View style={styles.ringBox}>
            <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
              <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={t.surfaceAlt} strokeWidth={STROKE} fill="none" />
              <AnimatedCircle
                cx={RING / 2}
                cy={RING / 2}
                r={R}
                stroke={ringColor}
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${CIRC} ${CIRC}`}
                animatedProps={ringProps}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            </Svg>
            <View style={[styles.face, { backgroundColor: t.surface }]}>
              <Bud size={92} grow={active?.kind === 'focus' ? progress : 0} />
              <Text style={{ fontFamily: Fonts.display, fontSize: 52, lineHeight: 58, color: t.text }} accessibilityLabel={`${fmtClock(left)} remaining`}>
                {fmtClock(left)}
              </Text>
              <Text variant="small">
                {active ? (active.endAt === null ? 'Paused' : active.kind === 'break' ? 'Break' : 'Focus') : `${PRESETS[preset].focus} min focus · ${PRESETS[preset].rest} min break`}
              </Text>
            </View>
          </View>

          {!active && (
            <View style={{ gap: 14 }}>
              <Choice
                options={(Object.keys(PRESETS) as FocusPreset[]).map((k) => ({ label: `${PRESETS[k].label} ${PRESETS[k].focus}`, value: k }))}
                value={preset}
                onChange={setPreset}
              />
              {lowToday && preset === 'gentle' && (
                <Text variant="small" center>
                  A low day: we picked the gentle 15-minute session.
                </Text>
              )}
              {candidates.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text variant="label">Focus on (optional)</Text>
                  <View style={styles.chips}>
                    {candidates.map((task) => {
                      const on = task.id === taskId;
                      return (
                        <Pressable
                          key={task.id}
                          onPress={() => (tap(), setTaskId(on ? undefined : task.id))}
                          style={[styles.chip, { borderColor: on ? t.text : t.line, backgroundColor: on ? t.text : 'transparent' }]}>
                          <Text variant="small" numberOfLines={1} style={{ color: on ? t.background : t.text, fontFamily: Fonts.bodyStrong, maxWidth: 220 }}>
                            {task.title}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
              <Button title={`Start ${PRESETS[preset].focus}-minute focus`} icon="play" onPress={begin} />
            </View>
          )}

          {active?.kind === 'focus' && (
            <View style={styles.controls}>
              {active.endAt === null ? (
                <Button title="Resume" icon="play" onPress={resumeTimer} style={{ flex: 1 }} />
              ) : (
                <Button title="Pause" kind="secondary" onPress={pauseTimer} style={{ flex: 1 }} />
              )}
              <Button title="Stop" kind="quiet" onPress={() => confirmStop(stopTimer)} style={{ flex: 1 }} />
            </View>
          )}
          {active?.kind === 'break' && <Button title="Skip break" kind="secondary" onPress={stopTimer} />}
        </>
      )}

      <Garden sessions={sessions} />
    </Screen>
  );
}

function RewardView({
  reward,
  todayCount,
  total,
  taskTitle,
  onTaskDone,
  restMinutes,
  onBreak,
  onSkip,
}: {
  reward: { flower: FlowerKind; session: FocusSession };
  todayCount: number;
  total: number;
  taskTitle?: string;
  onTaskDone: () => void;
  restMinutes: number;
  onBreak: () => void;
  onSkip: () => void;
}) {
  const t = useTheme();
  const [taskMarked, setTaskMarked] = useState(false);
  const f = reward.flower;
  const rareColor = f.rarity === 'legendary' ? '#C98A1E' : f.rarity === 'rare' ? '#7E6FD0' : '#3A9477';
  return (
    <View>
      <Confetti count={f.rarity === 'common' ? 30 : 60} />
      <Animated.View entering={FadeIn.duration(300)} style={[styles.reward, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text variant="label" center>
          Session complete · {reward.session.minutes} min
        </Text>
        <Animated.View entering={ZoomIn.delay(150).springify().damping(10)} style={styles.bloom}>
          <View style={[styles.bloomGlow, { backgroundColor: f.petalInner }]} />
          <Flower kind={f} size={170} stem />
        </Animated.View>
        <Animated.View entering={ZoomIn.delay(450).springify()} style={[styles.rarity, { backgroundColor: rareColor }]}>
          <Text variant="bodyStrong" style={{ color: '#fff', fontSize: 12.5 }}>
            {RARITY_LABEL[f.rarity]}
          </Text>
        </Animated.View>
        <Text variant="title" center>
          You grew a {f.name}
        </Text>
        <Text variant="quote" color="textSecondary" center style={{ fontSize: 17 }}>
          {f.line}
        </Text>
        <View style={[styles.statsRow, { borderColor: t.line }]}>
          <Stat label="Today" value={`${todayCount}`} />
          <Stat label="Garden" value={`${total}`} />
          <Stat label="Next golden" value={`${10 - (total % 10)}`} />
        </View>
        {taskTitle && !taskMarked && (
          <Button
            title={`Mark “${taskTitle.length > 24 ? taskTitle.slice(0, 23) + '…' : taskTitle}” done`}
            icon="check"
            kind="secondary"
            onPress={() => {
              onTaskDone();
              setTaskMarked(true);
              haptic.success();
            }}
            style={{ alignSelf: 'stretch' }}
          />
        )}
        <Button title={`Take a ${restMinutes}-minute break`} icon="leaf" onPress={onBreak} style={{ alignSelf: 'stretch' }} />
        <Button title="Skip break" kind="quiet" onPress={onSkip} style={{ alignSelf: 'stretch' }} />
      </Animated.View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text variant="bodyStrong" style={{ fontSize: 18 }}>
        {value}
      </Text>
      <Text variant="small" style={{ fontSize: 11.5 }}>
        {label}
      </Text>
    </View>
  );
}

function Garden({ sessions }: { sessions: FocusSession[] }) {
  const t = useTheme();
  const found = new Set(sessions.map((s) => s.flower));
  const minutes = sessions.reduce((n, s) => n + s.minutes, 0);
  return (
    <Card>
      <Text variant="label">Your Focus Garden</Text>
      <View style={styles.gardenStats}>
        <Stat label="Flowers" value={`${sessions.length}`} />
        <Stat label="Day streak" value={`${focusStreak(sessions)}`} />
        <Stat label="Hours" value={(minutes / 60).toFixed(1)} />
      </View>

      {sessions.length === 0 ? (
        <Text variant="small" center style={{ paddingVertical: 10 }}>
          Your garden is empty for now. One focus session plants the first flower.
        </Text>
      ) : (
        <View style={[styles.bed, { backgroundColor: t.surfaceAlt }]}>
          {sessions.slice(0, 24).map((s) => (
            <View key={s.at} style={styles.bedCell}>
              <Flower kind={flowerOf(s.flower)} size={46} stem />
            </View>
          ))}
        </View>
      )}

      <Text variant="label" style={{ marginTop: 6 }}>
        Collection · {found.size} of {FLOWERS.length}
      </Text>
      <View style={styles.collection}>
        {FLOWERS.map((f) =>
          found.has(f.id) ? (
            <View key={f.id} style={styles.collCell}>
              <Flower kind={f} size={40} />
              <Text variant="small" numberOfLines={1} style={{ fontSize: 10.5 }}>
                {f.name}
              </Text>
            </View>
          ) : (
            <View key={f.id} style={styles.collCell}>
              <View style={[styles.locked, { borderColor: t.line }]}>
                <Text variant="bodyStrong" color="textMuted">
                  ?
                </Text>
              </View>
              <Text variant="small" color="textMuted" style={{ fontSize: 10.5 }}>
                {RARITY_LABEL[f.rarity]}
              </Text>
            </View>
          ),
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 36 },
  todayPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  ringBox: { width: RING, height: RING, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
  face: { width: RING - 44, height: RING - 44, borderRadius: RING, alignItems: 'center', justifyContent: 'center', gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  controls: { flexDirection: 'row', gap: 10 },
  reward: { borderRadius: 30, borderWidth: 1, padding: 22, gap: 10, alignItems: 'center' },
  bloom: { width: 190, height: 190, alignItems: 'center', justifyContent: 'center' },
  bloomGlow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, opacity: 0.45 },
  rarity: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  statsRow: { flexDirection: 'row', alignSelf: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  gardenStats: { flexDirection: 'row', paddingVertical: 6 },
  bed: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 18, padding: 8, gap: 2 },
  bedCell: { width: '16.66%', alignItems: 'center' },
  collection: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  collCell: { width: '25%', alignItems: 'center', gap: 2 },
  locked: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
