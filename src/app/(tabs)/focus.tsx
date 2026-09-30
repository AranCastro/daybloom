/** Pomodoro focus timer with a Focus Garden: each finished session grows a flower. */
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';

import { Bud, Flower } from '@/components/flower';
import { Confetti, haptic } from '@/components/games/fx';
import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Button, Card, Choice, Screen, tap } from '@/components/ui';
import { Radius, Spacing, TabBarInset } from '@/constants/theme';
import { useAppActive } from '@/hooks/use-app-active';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { FlowerKind, GOLDEN_EVERY, RARITY_LABEL } from '@/lib/flowers';
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
import { Bloom, getState, openTasks, setSettings, toggleTask, useAppState } from '@/lib/store';
import { dndSupported, openDndAccess, useDndAccess } from '@/lib/focus-dnd';
import { QUADRANTS } from '@/lib/quadrants';
import { GardenBed } from '@/components/garden';
import { NowPlaying, SoundPicker } from '@/components/sound-picker';

const RING = 280;
const STROKE = 10;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
/** The drawing box has room around the ring for the glow, which is wider than the stroke. */
const PAD = 8;
const BOX = RING + PAD * 2;
/** Faint tick marks every five minutes of the session. */
const TICK_MS = 5 * 60_000;

/**
 * A preset name from a link or widget. `in` would also accept inherited keys, so
 * daybloom://focus?preset=constructor gave "Start NaN-minute focus".
 */
function presetFrom(value: string | undefined): FocusPreset | undefined {
  return value !== undefined && Object.hasOwn(PRESETS, value) ? (value as FocusPreset) : undefined;
}

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
  const reduceMotion = useReduceMotion();
  const { width } = useWindowDimensions();
  const ringSize = Math.min(RING, Math.min(width, 520) - Spacing.screen * 2);
  const params = useLocalSearchParams<{ task?: string; preset?: string }>();
  const active = useAppState((s) => s.focus.active);
  const sessions = useAppState((s) => s.focus.sessions);
  const garden = useAppState((s) => s.garden);
  const gardenSize = useAppState((s) => s.bloomCount);
  // The Golden Lotus follows every flower ever grown, so unticking cannot move it.
  const bloomsEver = useAppState((s) => s.bloomsEver);
  const tasks = useAppState((s) => s.tasks);
  const todayKey = useToday();
  const lowMood = useAppState((s) => isLow(s.checkins[todayKey]));
  const lowEnergy = useAppState((s) => s.energy[todayKey] === 1);
  const lowToday = lowMood || lowEnergy;
  const highEnergy = useAppState((s) => s.energy[todayKey] === 3);
  const defaultPreset = useAppState((s) => s.settings.focusPreset);

  const [now, setNow] = useState(() => Date.now());
  const [reward, setReward] = useState<{ flower: FlowerKind; session: FocusSession } | null>(null);
  const [breakOver, setBreakOver] = useState(false);
  const [preset, setPreset] = useState<FocusPreset>(
    active?.preset ?? presetFrom(params.preset) ?? (lowToday ? 'gentle' : highEnergy ? 'deep' : defaultPreset),
  );
  const [taskId, setTaskId] = useState<string | undefined>(params.task);
  const [allTasks, setAllTasks] = useState(false);
  const [askDnd, setAskDnd] = useState(false);
  const [rememberDnd, setRememberDnd] = useState(false);
  const dndMode = useAppState((s) => s.settings.focusDnd);
  const dndAccess = useDndAccess();
  const dark = useIsDark();

  // The tab stays mounted, so pick up a preset or task passed later (widget buttons, "Focus on this task").
  const [seen, setSeen] = useState({ preset: params.preset, task: params.task });
  if (seen.preset !== params.preset || seen.task !== params.task) {
    setSeen({ preset: params.preset, task: params.task });
    const linked = presetFrom(params.preset);
    if (!active && linked) setPreset(linked);
    if (!active && params.task !== seen.task) setTaskId(params.task);
  }

  const running = !!active && active.endAt !== null;
  const appActive = useAppActive();
  // A tab stays mounted: tick and keep the screen awake only while this tab is on show.
  const focused = useIsFocused();

  // One ticker while a timer runs (once a second, only in the foreground): refreshes the clock and
  // completes a timer that has run out, also one that ran out while the app was closed.
  useEffect(() => {
    if (!running || !appActive || !focused) return;
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
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [running, appActive, focused]);

  useEffect(() => {
    if (!running || !focused) return;
    activateKeepAwakeAsync('focus').catch(() => {});
    return () => {
      deactivateKeepAwake('focus').catch(() => {});
    };
  }, [running, focused]);

  const left = active ? remaining(active, now) : PRESETS[preset].focus * 60_000;
  const total = active ? active.total : PRESETS[preset].focus * 60_000;
  const progress = active ? 1 - left / total : 0;
  const ringColor = active?.kind === 'break' ? t.success : t.accent;

  // One linear sweep over the time that is left, rather than a step each second. It restarts
  // on pause, resume and return to the tab. Under Reduce motion the ring steps with the clock.
  const ring = useSharedValue(0);
  const visible = focused && appActive;
  const step = reduceMotion ? now : 0;
  useEffect(() => {
    cancelAnimation(ring);
    if (!active) {
      ring.set(0);
      return;
    }
    const leftNow = remaining(active, Date.now());
    ring.set(1 - leftNow / active.total);
    if (active.endAt === null || reduceMotion || !visible || leftNow <= 0) return;
    // A progress indicator rather than decoration: the sweep itself is not skipped by the
    // app-wide reduced-motion config (that case is handled above by stepping).
    ring.set(withTiming(1, { duration: leftNow, easing: Easing.linear, reduceMotion: ReduceMotion.Never }));
    return () => cancelAnimation(ring);
  }, [active, reduceMotion, visible, step, ring]);
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - ring.value) }));
  const ticks = Math.floor(total / TICK_MS);
  // The face stops just inside the tick marks.
  const faceSize = Math.round((R - STROKE / 2 - 11) * 2 * (ringSize / BOX));

  const today = sessionsOn(sessions, todayKey);
  const focusTask = tasks.find((x) => x.id === (active?.taskId ?? taskId));
  // The task saved with the finished session (survives the app being closed mid-session).
  const rewardTask = reward?.session.taskId ? tasks.find((x) => x.id === reward.session.taskId) : undefined;
  // Every open task can be focused on, Do first to Later; the first few show until "Show all".
  const allOpen = ([1, 2, 3, 4] as const).flatMap((q) => openTasks(tasks, q));
  const picked = allOpen.find((x) => x.id === taskId);
  const firstFew = allOpen.slice(0, 6);
  const candidates = allTasks ? allOpen : picked && !firstFew.includes(picked) ? [...firstFew.slice(0, 5), picked] : firstFew;

  function start(dnd: boolean) {
    setAskDnd(false);
    setBreakOver(false);
    setReward(null);
    haptic.medium();
    startFocus(preset, taskId, dnd);
  }

  /** Start: asks about Do Not Disturb first when Settings says "Ask" (Android only). */
  function begin() {
    if (!dndSupported || dndMode === 'never') start(false);
    else if (dndMode === 'always') start(true);
    else {
      setRememberDnd(false);
      setAskDnd(true);
    }
  }

  function answerDnd(yes: boolean) {
    if (rememberDnd) setSettings({ focusDnd: yes ? 'always' : 'never' });
    start(yes);
  }

  return (
    <Screen bottomInset={TabBarInset + 24}>
      <View style={[styles.top, { justifyContent: 'flex-end' }]}>
        <View style={[styles.todayPill, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Icon name="leaf" color={t.success} size={15} />
          <Text variant="small" strong color="text" style={styles.tabular}>
            {today.length} today
          </Text>
        </View>
      </View>

      {reward ? (
        <RewardView
          reward={reward}
          todayCount={today.length}
          total={gardenSize}
          ever={bloomsEver}
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

          <View style={[styles.ringBox, { width: ringSize, height: ringSize }]}>
            <Svg width={ringSize} height={ringSize} viewBox={`${-PAD} ${-PAD} ${BOX} ${BOX}`} style={StyleSheet.absoluteFill}>
              <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={t.surfaceAlt} strokeWidth={STROKE} fill="none" />
              {Array.from({ length: ticks > 1 ? ticks : 0 }, (_, i) => {
                const a = (i / ticks) * 2 * Math.PI - Math.PI / 2;
                const r1 = R - STROKE / 2 - 9;
                const r2 = R - STROKE / 2 - 4;
                return (
                  <Line
                    key={i}
                    x1={RING / 2 + r1 * Math.cos(a)}
                    y1={RING / 2 + r1 * Math.sin(a)}
                    x2={RING / 2 + r2 * Math.cos(a)}
                    y2={RING / 2 + r2 * Math.sin(a)}
                    stroke={t.textMuted}
                    strokeOpacity={0.35}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                );
              })}
              {/* A soft glow in the ring colour, under the progress stroke. */}
              <AnimatedCircle
                cx={RING / 2}
                cy={RING / 2}
                r={R}
                stroke={ringColor}
                strokeOpacity={active ? 0.16 : 0}
                strokeWidth={STROKE + 10}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${CIRC} ${CIRC}`}
                animatedProps={ringProps}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
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
            <View style={[styles.face, { width: faceSize, height: faceSize, backgroundColor: t.surface }]}>
              <Bud size={92} grow={active?.kind === 'focus' ? progress : 0} />
              <Text variant="display" accessibilityLabel={`${fmtClock(left)} remaining`}>
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
                  {lowEnergy && !lowMood ? 'Low energy today: we picked the gentle 15-minute session.' : 'A low day: we picked the gentle 15-minute session.'}
                </Text>
              )}
              {candidates.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text variant="label">Focus on (optional)</Text>
                  <View style={styles.chips}>
                    {candidates.map((task) => {
                      const on = task.id === taskId;
                      const q = QUADRANTS[task.quadrant - 1];
                      return (
                        <Pressable
                          key={task.id}
                          onPress={() => (tap(), setTaskId(on ? undefined : task.id))}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={`${task.title}, ${q.action}`}
                          style={[styles.chip, styles.taskChip, { borderColor: on ? t.text : t.line, backgroundColor: on ? t.text : 'transparent' }]}>
                          <View style={[styles.qDot, { backgroundColor: dark ? q.color.dark : q.color.light }]} />
                          <Text variant="small" strong numberOfLines={1} style={{ color: on ? t.background : t.text, maxWidth: 220 }}>
                            {task.title}
                          </Text>
                        </Pressable>
                      );
                    })}
                    {allOpen.length > 6 && (
                      <Pressable
                        onPress={() => (tap(), setAllTasks(!allTasks))}
                        accessibilityRole="button"
                        style={[styles.chip, { borderColor: t.line, borderStyle: 'dashed' }]}>
                        <Text variant="small" strong color="accent">
                          {allTasks ? 'Show fewer' : `Show all ${allOpen.length}`}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}
              <Button title={`Start ${PRESETS[preset].focus}-minute focus`} icon="play" onPress={begin} />
            </View>
          )}

          {active?.kind === 'focus' && active.endAt !== null && <NowPlaying />}
          {active?.kind === 'focus' && active.dnd && dndSupported && (
            <View style={[styles.dndRow, { borderColor: t.line, backgroundColor: t.surface }]}>
              <Icon name="mute" color={t.textSecondary} size={16} />
              {dndAccess ? (
                <Text variant="caption" color="text" style={{ flex: 1 }}>
                  {active.endAt !== null ? 'Do Not Disturb is on until this session ends.' : 'Do Not Disturb is off while paused.'}
                </Text>
              ) : (
                <>
                  <Text variant="caption" color="text" style={{ flex: 1 }}>
                    Allow Daybloom to use Do Not Disturb, then come back: it turns on for this session.
                  </Text>
                  <Pressable onPress={() => (tap(), openDndAccess())} accessibilityRole="button" hitSlop={8}>
                    <Text variant="caption" strong color="accent">
                      Allow
                    </Text>
                  </Pressable>
                </>
              )}
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

      {!reward && <SoundPicker running={!!active && active.kind === 'focus' && active.endAt !== null} />}

      <FocusStats sessions={sessions} garden={garden} />
      <Modal visible={askDnd} transparent animationType="fade" onRequestClose={() => setAskDnd(false)}>
        <Pressable style={styles.scrim} onPress={() => setAskDnd(false)} accessibilityLabel="Close" />
        <View style={styles.askWrap} pointerEvents="box-none">
          <Card tone="raised" style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="mute" color={t.text} size={22} />
              <Text variant="heading" style={{ flex: 1 }}>
                Silence notifications?
              </Text>
            </View>
            <Text variant="bodySm" color="textSecondary">
              Turns on Do Not Disturb for this {PRESETS[preset].focus}-minute session and turns it off when it ends. Alarms and your starred
              contacts still come through.
            </Text>
            {!dndAccess && (
              <Text variant="caption">The first time, Android asks you to allow Daybloom in its Do Not Disturb settings.</Text>
            )}
            <Pressable onPress={() => (tap(), setRememberDnd(!rememberDnd))} accessibilityRole="checkbox" accessibilityState={{ checked: rememberDnd }} style={styles.remember}>
              <View style={[styles.box, { borderColor: rememberDnd ? t.brand : t.line, backgroundColor: rememberDnd ? t.brand : 'transparent' }]}>
                {rememberDnd && <Icon name="check" color={t.brandText} size={14} />}
              </View>
              <Text variant="small" color="text">
                Remember my choice (change it in Settings)
              </Text>
            </Pressable>
            <Button title="Yes, silence" icon="check" onPress={() => answerDnd(true)} />
            <Button title="No, just focus" kind="secondary" onPress={() => answerDnd(false)} />
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}

function RewardView({
  reward,
  todayCount,
  total,
  ever,
  taskTitle,
  onTaskDone,
  restMinutes,
  onBreak,
  onSkip,
}: {
  reward: { flower: FlowerKind; session: FocusSession };
  todayCount: number;
  total: number;
  ever: number;
  taskTitle?: string;
  onTaskDone: () => void;
  restMinutes: number;
  onBreak: () => void;
  onSkip: () => void;
}) {
  const t = useTheme();
  const [taskMarked, setTaskMarked] = useState(false);
  const f = reward.flower;
  const rareColor = f.rarity === 'legendary' ? t.legendary : f.rarity === 'rare' ? t.rare : t.success;
  return (
    <View>
      <Confetti count={f.rarity === 'common' ? 30 : 60} />
      <Animated.View entering={FadeIn.duration(300)}>
        <Card tone="raised" style={styles.reward}>
        <Text variant="label" center>
          Session complete · {reward.session.minutes} min
        </Text>
        <Animated.View entering={ZoomIn.delay(150).springify().damping(10)} style={styles.bloom}>
          <View style={[styles.bloomGlow, { backgroundColor: f.petalInner }]} />
          <Flower kind={f} size={170} stem />
        </Animated.View>
        <Animated.View entering={ZoomIn.delay(450).springify()} style={[styles.rarity, { backgroundColor: rareColor }]}>
          <Text variant="caption" strong color="onStatus">
            {RARITY_LABEL[f.rarity]}
          </Text>
        </Animated.View>
        <Text variant="title" center>
          You grew a {f.name}
        </Text>
        <Text variant="quoteSm" color="textSecondary" center>
          {f.line}
        </Text>
        <View style={[styles.statsRow, { borderColor: t.line }]}>
          <Stat label="Today" value={`${todayCount}`} />
          <Stat label="Garden" value={`${total}`} />
          <Stat label="Next golden" value={`${GOLDEN_EVERY - (ever % GOLDEN_EVERY)}`} />
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
        </Card>
      </Animated.View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text variant="numeral">{value}</Text>
      <Text variant="caption">
        {label}
      </Text>
    </View>
  );
}

function FocusStats({ sessions, garden }: { sessions: FocusSession[]; garden: Bloom[] }) {
  // Sessions older than the kept list still count, as per-day totals.
  const cleared = useAppState((s) => s.clearedFocus);
  const old = Object.values(cleared).reduce((n, d) => ({ sessions: n.sessions + d.sessions, minutes: n.minutes + d.minutes }), { sessions: 0, minutes: 0 });
  const minutes = sessions.reduce((n, s) => n + s.minutes, 0) + old.minutes;
  return (
    <Card onPress={() => router.navigate('/journey')} accessibilityLabel="Open your garden">
        <View style={styles.gardenHead}>
          <Text variant="label">Your garden · {garden.length} blooms</Text>
          <Text variant="small" color="accent">
            Open garden
          </Text>
        </View>
        <GardenBed blooms={garden} max={12} height={150} />
        <View style={styles.gardenStats}>
          <Stat label="Focus sessions" value={`${sessions.length + old.sessions}`} />
          <Stat label="Focus streak" value={`${focusStreak(sessions, undefined, cleared)} d`} />
          <Stat label="Focus hours" value={(minutes / 60).toFixed(1)} />
        </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 36 },
  todayPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  ringBox: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
  face: { borderRadius: RING, alignItems: 'center', justifyContent: 'center', gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1 },
  taskChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qDot: { width: 8, height: 8, borderRadius: 4 },
  dndRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: Radius.sm, borderWidth: 1 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  askWrap: { flex: 1, justifyContent: 'center', padding: Spacing.screen },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  controls: { flexDirection: 'row', gap: 10 },
  reward: { borderRadius: Radius.xl, padding: 22, gap: 10, alignItems: 'center' },
  bloom: { width: 190, height: 190, alignItems: 'center', justifyContent: 'center' },
  bloomGlow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, opacity: 0.45 },
  rarity: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.pill },
  statsRow: { flexDirection: 'row', alignSelf: 'stretch', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  gardenStats: { flexDirection: 'row', paddingTop: 10 },
  gardenHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
});
