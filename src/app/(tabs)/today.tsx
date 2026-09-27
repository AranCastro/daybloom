import * as Haptics from 'expo-haptics';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { NudgeReadyCard, useBuddy } from '@/components/buddy';
import { Icon, IconName } from '@/components/icons';
import { MoodTagPicker } from '@/components/mood-tags';
import { PlacePicker } from '@/components/place-picker';
import { EnergyCard } from '@/components/energy';
import { useScene } from '@/components/garden-sky';
import { checkInLine } from '@/lib/weather';
import { festivalNear } from '@/lib/thottam';
import { PookalamArt } from '@/components/pookalam';
import { GoodDayMemory, GoodDayPrompt } from '@/components/good-days';
import { MoodDot, MoodOrb } from '@/components/mood-orb';
import { Avatar, ReachButtons } from '@/components/people';
import { TaskRow, TaskSheet } from '@/components/tasks';
import { ProfileAvatar } from '@/components/profile';
import { Text } from '@/components/text';
import { Card, Screen, Tappable, tap } from '@/components/ui';
import { MaxContentWidth, Radius, Spacing, TabBarInset } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useAppActive } from '@/hooks/use-app-active';
import { useClock } from '@/hooks/use-today';
import { useTheme } from '@/hooks/use-theme';
import { useCircleNames } from '@/lib/labels';
import { addDays, dayKey, fromKey, greetingFor, prettyDate, weekdayShort } from '@/lib/dates';
import { isLow, MOODS, MoodValue, moodOf } from '@/lib/moods';
import { BadgeCelebration } from '@/components/badge';
import { WeeklyBackupCard } from '@/components/backup';
import { Flower } from '@/components/flower';
import { flowerOf } from '@/lib/flowers';
import { remaining, sessionsOn } from '@/lib/focus';
import { gameForMood } from '@/lib/games';
import { awardBadges, openTasks, peopleIn, Person, recordMood, Task, useAppState, hapticsOn } from '@/lib/store';
import { helpline } from '@/lib/region';
import { Badge, streakInfo } from '@/lib/badges';

/** How long the four other orbs take to step aside before the chosen one grows. */
const STEP_ASIDE_MS = 260;
/** The grow from a 54 px orb to the 148 px hero. */
const GROW_MS = 520;
/** Centre of the hero orb from the top of its card: padding 28 + margin 8 + half of 148. */
const HERO_CENTRE_Y = 28 + 8 + 74;

type Pick = { index: number; value: MoodValue };
type From = { dx: number; dy: number; scale: number };

export default function Today() {
  const scene = useScene();
  const t = useTheme();
  const reduceMotion = useReduceMotion();
  const { width } = useWindowDimensions();
  const name = useAppState((s) => s.name);
  const checkins = useAppState((s) => s.checkins);
  const { buddy, automatic } = useBuddy();
  const [editing, setEditing] = useState(false);
  const [celebrate, setCelebrate] = useState<Badge[]>([]);
  const { today, hour } = useClock();
  const streak = streakInfo(checkins, today);

  const todayMood = moodOf(checkins[today]);
  const showPicker = !todayMood || editing;

  // Five orbs across the card: sized from the window, so a 320 dp phone still fits them.
  const inner = Math.min(width, MaxContentWidth) - Spacing.screen * 2 - Spacing.card * 2 - 2;
  const orb = Math.max(36, Math.min(54, Math.floor(inner / 5) - 8));

  // The check-in choreography: the other orbs step aside, then the chosen one grows into the hero.
  const [picking, setPicking] = useState<Pick | null>(null);
  const [from, setFrom] = useState<From | null>(null);
  const [row, setRow] = useState({ x: 0, y: 0, width: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // First run: one "Start here" card until the first check-in, then the rest of the day appears.
  const fresh = Object.keys(checkins).length === 0;
  const [wasFresh] = useState(fresh);
  const reveal = wasFresh && !fresh;
  const enter = (i: number) => (reveal ? FadeInDown.delay(GROW_MS + 120 + 70 * i).duration(420) : undefined);

  async function commit(v: MoodValue) {
    setPicking(null);
    setEditing(false);
    await recordMood(v);
    const earned = awardBadges();
    if (earned.length) setCelebrate(earned);
  }

  function choose(v: MoodValue, index: number) {
    if (picking) return;
    if (hapticsOn()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (reduceMotion || !row.width) {
      setFrom(null);
      void commit(v);
      return;
    }
    const slot = (row.width - orb) / 4;
    setFrom({
      dx: row.x + orb / 2 + index * slot - (row.x + row.width / 2),
      dy: row.y + orb / 2 - HERO_CENTRE_Y,
      scale: orb / 148,
    });
    setPicking({ index, value: v });
    timer.current = setTimeout(() => void commit(v), STEP_ASIDE_MS);
  }

  const grow = from
    ? new Keyframe({
        0: { transform: [{ translateX: from.dx }, { translateY: from.dy }, { scale: from.scale }] },
        100: { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }], easing: Easing.out(Easing.cubic) },
      }).duration(GROW_MS)
    : undefined;
  // Tags and places slide in 150 ms after the orb lands.
  const after = (i: number) => (from ? FadeInDown.delay(GROW_MS + 150 + 60 * i).duration(360) : undefined);

  return (
    <Screen bottomInset={TabBarInset + 24}>
      <BadgeCelebration badges={celebrate} onClose={() => setCelebrate([])} />
      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <View style={[styles.inline, { justifyContent: 'space-between' }]}>
          <Text variant="label">{prettyDate(fromKey(today))}</Text>
          <View style={styles.inline}>
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${streak.current} day streak. Badges`}
            onPress={() => (tap(), router.push('/badges'))}
            style={[styles.streakChip, { backgroundColor: streak.checkedToday ? t.accentSoft : t.surface, borderColor: t.line }]}>
            <Icon name="flame" color={t.accent} size={18} fill={streak.checkedToday ? t.accent : 'none'} />
            <Text variant="bodySm" strong style={styles.tabular}>
              {streak.current}
            </Text>
          </Pressable>
          <Pressable
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => (tap(), router.push('/settings'))}
            style={[styles.gear, { backgroundColor: t.surface, borderColor: t.line }]}>
            <Icon name="settings" color={t.text} size={19} />
          </Pressable>
          </View>
        </View>
        <View style={[styles.inline, { gap: 12 }]}>
          <Pressable onPress={() => (tap(), router.push('/settings'))} accessibilityRole="button" accessibilityLabel="Profile and settings">
            <ProfileAvatar size={46} />
          </Pressable>
          <Text variant="title" style={{ flex: 1 }}>
            {greetingFor(hour)}
            {name ? `, ${name}` : ''}
          </Text>
        </View>
      </Animated.View>

      {!fresh && (
        <Animated.View entering={enter(0)} style={styles.stack}>
          <TodayBlooms today={today} />
          <FestivalCard today={today} />
          <WeeklyBackupCard />
        </Animated.View>
      )}

      {showPicker ? (
        <Animated.View entering={FadeIn.duration(400)} key="picker">
          <Card style={styles.hero} tone={fresh ? 'raised' : 'surface'}>
            {fresh && (
              <Text variant="label" color="accent" center>
                Start here
              </Text>
            )}
            <Text variant="heading" center>
              How does today feel?
            </Text>
            <Text variant="small" center>
              {checkInLine(scene.season, scene.live ? scene.sky : undefined)}
            </Text>
            <View
              style={styles.moods}
              onLayout={(e) => {
                const { x, y, width: w } = e.nativeEvent.layout;
                setRow({ x, y, width: w });
              }}>
              {MOODS.map((m, i) => (
                <PickerOrb key={m.value} index={i} size={orb} picking={picking} onPress={() => choose(m.value, i)} />
              ))}
            </View>
            {fresh && <StartSteps />}
          </Card>
        </Animated.View>
      ) : (
        todayMood && (
          <Animated.View entering={from ? undefined : FadeIn.duration(500)} key="done">
            <Card style={styles.hero} tone="raised">
              <Animated.View entering={grow} style={styles.orbWrap}>
                <MoodOrb mood={todayMood} size={148} breathe />
              </Animated.View>
              <Animated.View entering={from ? FadeIn.delay(GROW_MS - 180).duration(320) : undefined} style={{ gap: 6 }}>
                <Text variant="label" center>
                  Today
                </Text>
                <Text variant="title" center>
                  {todayMood.label}
                </Text>
                <Text variant="quote" color="textSecondary" center style={{ paddingHorizontal: 12 }}>
                  {todayMood.line}
                </Text>
              </Animated.View>
              <Animated.View entering={after(0)}>
                <MoodTagPicker day={today} mood={todayMood.value} />
              </Animated.View>
              <Animated.View entering={after(1)}>
                <PlacePicker day={today} />
              </Animated.View>
              <Animated.View entering={after(2)}>
                <Pressable
                  onPress={() => {
                    tap();
                    setEditing(true);
                  }}
                  style={styles.change}>
                  <Text variant="bodySm" strong color="accent">
                    Change today&apos;s answer
                  </Text>
                </Pressable>
              </Animated.View>
            </Card>
          </Animated.View>
        )
      )}

      {todayMood?.value === 1 && !editing && <GoodDayMemory day={today} />}
      {todayMood?.value === 1 && !editing && <SupportCard />}
      {todayMood && todayMood.value >= 4 && !editing && <GoodDayPrompt day={today} key={today} />}

      {!fresh && (
        <>
          <NudgeReadyCard />

          {isLow(checkins[today]) && !editing && <ReachOutCard />}

          <Animated.View entering={enter(1)}>
            <EnergyCard day={today} hour={hour} />
          </Animated.View>

          <Animated.View entering={enter(2)}>
            <FocusCard lowDay={isLow(checkins[today]) && !editing} today={today} />
          </Animated.View>

          <Animated.View entering={enter(3)}>
            <FocusTimerCard today={today} />
          </Animated.View>

          {todayMood && !editing && <GameLink mood={todayMood.value} />}

          <Animated.View entering={enter(4)}>
            <WeekStrip checkins={checkins} today={today} />
          </Animated.View>

          <Animated.View entering={enter(5)}>
            <Card onPress={() => router.navigate('/circle')} accessibilityLabel={buddy ? `Your buddy, ${buddy.name}` : 'Choose your buddy'}>
              <View style={styles.inline}>
                {buddy ? (
                  <Avatar person={buddy} size={40} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: t.surfaceAlt }]}>
                    <Text variant="bodyStrong" color="textSecondary">
                      +
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{buddy ? buddy.name : 'Choose your buddy'}</Text>
                  <Text variant="small">
                    {buddy
                      ? `Your buddy${automatic ? ' (automatic)' : ''}. One tap to reach them on hard days.`
                      : 'One person to reach on hard days.'}
                  </Text>
                </View>
                <Icon name="arrow" color={t.textMuted} size={20} />
              </View>
            </Card>
          </Animated.View>
        </>
      )}
    </Screen>
  );
}

/** One orb in the picker. When another is chosen it steps aside, nearest first. */
function PickerOrb({ index, size, picking, onPress }: { index: number; size: number; picking: Pick | null; onPress: () => void }) {
  const m = MOODS[index];
  const out = useSharedValue(0);
  const chosen = picking?.index === index;
  const order = picking ? Math.abs(picking.index - index) - 1 : 0;
  useEffect(() => {
    if (!picking) {
      out.set(0);
      return;
    }
    if (chosen) return;
    out.set(withDelay(order * 45, withTiming(1, { duration: 160, easing: Easing.in(Easing.quad) })));
  }, [picking, chosen, order, out]);
  const anim = useAnimatedStyle(() => ({ opacity: 1 - out.value, transform: [{ scale: 1 - out.value * 0.35 }] }));
  return (
    // The entrance and the step-aside both move `transform`, so they sit on separate views.
    <Animated.View entering={ZoomIn.delay(80 * index).springify().damping(14)}>
      <Animated.View style={anim}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={m.label}
          onPress={onPress}
          style={({ pressed }) => [styles.moodBtn, pressed && { transform: [{ scale: 0.92 }] }]}>
          <MoodOrb mood={m} size={size} />
          <Text variant="caption" color="text" style={{ opacity: chosen ? 0 : 1 }}>
            {m.label}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/** Under the first check-in: what comes next, one line each. */
function StartSteps() {
  const t = useTheme();
  const steps: { icon: IconName; text: string; go: () => void }[] = [
    { icon: 'grid', text: 'Sort a task into your matrix', go: () => router.navigate('/matrix') },
    { icon: 'clock', text: 'Grow a flower with a focus session', go: () => router.navigate('/focus') },
    { icon: 'people', text: 'Choose a buddy for hard days', go: () => router.navigate('/circle') },
  ];
  return (
    <View style={[styles.steps, { borderColor: t.line }]}>
      <Text variant="caption" center>
        Then, when you are ready
      </Text>
      {steps.map((s) => (
        <Tappable key={s.icon} onPress={s.go} radius={Radius.sm} style={styles.step} accessibilityLabel={s.text}>
          <View style={[styles.stepIcon, { backgroundColor: t.surfaceAlt }]}>
            <Icon name={s.icon} color={t.text} size={16} />
          </View>
          <Text variant="small" color="text" style={{ flex: 1 }}>
            {s.text}
          </Text>
          <Icon name="arrow" color={t.textMuted} size={16} />
        </Tappable>
      ))}
    </View>
  );
}

/** In the Onam, Diwali or Pongal season: an invitation to make a Poo Kolam in Thottam. */
function FestivalCard({ today: day }: { today: string }) {
  const t = useTheme();
  const festival = festivalNear(fromKey(day));
  if (!festival) return null;
  const line = festival === 'onam' ? 'Onam is near. Make a Poo Kolam from your flowers.' : festival === 'diwali' ? 'Diwali is near. Make a Poo Kolam with diyas.' : 'Pongal is near. Make a Poo Kolam with a kolam.';
  return (
    <Tappable onPress={() => router.push('/thottam')} radius={Radius.md} style={[styles.festival, { backgroundColor: t.accentSoft }]}>
      <PookalamArt design={{ center: 'marigold', rings: [{ flower: 'jasmine', pattern: 'petals' }, { flower: 'marigold', pattern: 'solid' }], festival }} size={48} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">Thottam</Text>
        <Text variant="small">{line}</Text>
      </View>
      <Icon name="arrow" color={t.textMuted} size={18} />
    </Tappable>
  );
}

/** Today's flowers from every activity, one tap from the garden. */
function TodayBlooms({ today: day }: { today: string }) {
  const t = useTheme();
  const garden = useAppState((s) => s.garden);
  const today = garden.filter((b) => dayKey(new Date(b.at)) === day);
  return (
    <Tappable
      accessibilityLabel={`${today.length} flowers today. Open garden`}
      onPress={() => router.navigate('/journey')}
      radius={Radius.md}
      style={[styles.blooms, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Icon name="leaf" color={t.success} size={18} />
      {today.length ? (
        <View style={styles.bloomRow}>
          {today.slice(0, 7).map((b) => (
            <Flower key={b.id} kind={flowerOf(b.flower)} size={24} />
          ))}
          <Text variant="small" style={{ marginLeft: 4 }}>
            {today.length} {today.length === 1 ? 'bloom' : 'blooms'} today
          </Text>
        </View>
      ) : (
        <Text variant="small" style={{ flex: 1 }}>
          Check in, finish a task or focus to grow today&apos;s first flower.
        </Text>
      )}
      <Icon name="arrow" color={t.textMuted} size={16} />
    </Tappable>
  );
}

/** Pomodoro entry point with today's flowers. */
function FocusTimerCard({ today }: { today: string }) {
  const t = useTheme();
  const active = useAppState((s) => s.focus.active);
  const sessions = useAppState((s) => s.focus.sessions);
  const todays = sessionsOn(sessions, today);
  const [now, setNow] = useState(() => Date.now());
  const appActive = useAppActive();
  const focused = useIsFocused();
  const ticking = !!active && active.endAt !== null && appActive && focused;
  // Re-render once a second while a timer runs, so the card flips to "Collect" on time.
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);
  const ready = active?.kind === 'focus' && active.endAt !== null && remaining(active, now) === 0;

  const line = ready
    ? 'Session complete. Your flower is ready to collect.'
    : active
      ? active.endAt === null
        ? 'Paused. Pick up where you left off.'
        : active.kind === 'break'
          ? 'On a break.'
          : 'Focus session in progress.'
      : todays.length
        ? `${todays.length} ${todays.length === 1 ? 'flower' : 'flowers'} grown today.`
        : 'One focus session grows one flower.';

  return (
    <Tappable
      onPress={() => router.push('/focus')}
      style={[styles.gameLink, { backgroundColor: ready ? t.accentSoft : t.surface, borderColor: t.line }]}>
      <View style={[styles.gameIcon, { backgroundColor: t.surfaceAlt }]}>
        <Icon name="clock" color={t.text} size={20} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{ready ? 'Collect your flower' : active ? 'Focus timer' : 'Start a focus session'}</Text>
        <Text variant="small">{line}</Text>
        {todays.length > 0 && (
          <View style={{ flexDirection: 'row', marginTop: 2 }}>
            {todays.slice(0, 8).map((s) => (
              <Flower key={s.at} kind={flowerOf(s.flower)} size={22} />
            ))}
          </View>
        )}
      </View>
      <Icon name="arrow" color={t.textMuted} size={20} />
    </Tappable>
  );
}

/** One-line suggestion of today's game, matched to the mood. */
function GameLink({ mood }: { mood: MoodValue }) {
  const t = useTheme();
  const game = gameForMood(mood);
  if (!game) return null;
  return (
    <Tappable
      onPress={() => router.push({ pathname: '/game/[id]', params: { id: game.id } })}
      style={[styles.gameLink, { backgroundColor: t.surface, borderColor: t.line }]}>
      <View style={[styles.gameIcon, { backgroundColor: t.surfaceAlt }]}>
        <Icon name="play" color={t.text} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">A small break: {game.title}</Text>
        <Text variant="small">{game.tagline}</Text>
      </View>
      <Icon name="arrow" color={t.textMuted} size={20} />
    </Tappable>
  );
}

/**
 * On a low day: one person to call and one to message, taken from the circle matrix.
 * Least recently reached first, so the same person is not always asked.
 */
function ReachOutCard() {
  const cName = useCircleNames();
  const people = useAppState((s) => s.people);
  const caller = peopleIn(people, 1)[0] ?? peopleIn(people, 2)[0];
  const texter = peopleIn(people, 3)[0] ?? peopleIn(people, 4)[0];
  const picks = [caller, texter].filter((p): p is Person => !!p);

  return (
    <Animated.View entering={FadeInDown.delay(120)}>
      <Card>
        <Text variant="label">Reach out today</Text>
        {picks.length === 0 ? (
          <>
            <Text variant="body" color="textSecondary">
              Add the people who lift you, and on days like this we will suggest who to call or message.
            </Text>
            <Pressable onPress={() => (tap(), router.navigate('/circle'))} style={{ paddingVertical: 6 }}>
              <Text variant="bodyStrong" color="accent">
                Build your circle
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text variant="quoteSm" color="textSecondary">
              A short hello can change the shape of a day.
            </Text>
            {picks.map((person) => (
              <View key={person.id} style={styles.reach}>
                <View style={styles.inline}>
                  <Avatar person={person} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{person.name}</Text>
                    <Text variant="small">{cName(person.quadrant)}</Text>
                  </View>
                </View>
                <ReachButtons person={person} compact />
              </View>
            ))}
          </>
        )}
      </Card>
    </Animated.View>
  );
}

/** Today's short list from the matrix: anything due today or late, then "Do first". Lighter on low days. */
function FocusCard({ lowDay, today }: { lowDay: boolean; today: string }) {
  const tasks = useAppState((s) => s.tasks);
  const [editing, setEditing] = useState<Task | null>(null);

  // Anything due today or late comes first (any quadrant), then the rest of "Do first".
  const dueNow = tasks
    .filter((x) => !x.done && x.due && x.due <= today)
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '') || a.quadrant - b.quadrant || (a.at ?? '').localeCompare(b.at ?? ''));
  const focus = [...dueNow, ...openTasks(tasks, 1).filter((x) => !dueNow.includes(x))];
  const limit = lowDay ? 1 : 3;
  const shown = focus.slice(0, limit);

  return (
    <Card>
      <View style={[styles.inline, { justifyContent: 'space-between' }]}>
        <Text variant="label">Focus today</Text>
        <Pressable hitSlop={10} onPress={() => (tap(), router.navigate('/matrix'))}>
          <Text variant="small" color="accent">
            Open matrix
          </Text>
        </Pressable>
      </View>
      {lowDay && focus.length > 0 && (
        <Text variant="quoteSm" color="textSecondary">
          A low day. One thing is enough.
        </Text>
      )}
      {shown.length === 0 ? (
        <Text variant="small">Nothing urgent. A good day to schedule something that matters.</Text>
      ) : (
        shown.map((task) => <TaskRow key={task.id} task={task} today={today} onOpen={setEditing} />)
      )}
      {focus.length > limit && (
        <Text variant="small" color="textMuted">
          +{focus.length - limit} more in your matrix
        </Text>
      )}
      <TaskSheet visible={!!editing} task={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

function WeekStrip({ checkins, today: key }: { checkins: Record<string, number>; today: string }) {
  const t = useTheme();
  const today = fromKey(key);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <Card>
      <Text variant="label">Last seven days</Text>
      <View style={styles.week}>
        {days.map((d) => {
          const m = moodOf(checkins[dayKey(d)]);
          const isToday = dayKey(d) === dayKey(today);
          return (
            <View
              key={dayKey(d)}
              style={styles.weekDay}
              accessible
              accessibilityLabel={`${prettyDate(d)}: ${m ? m.label : 'no check-in'}`}>
              {m ? (
                <MoodDot mood={m} size={30} />
              ) : (
                <View style={[styles.emptyDot, { borderColor: t.line }]} />
              )}
              <Text variant="caption" strong={isToday} color={isToday ? 'text' : 'textMuted'}>
                {weekdayShort(d).slice(0, 1)}
              </Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function SupportCard() {
  const t = useTheme();
  const h = helpline();
  const target = h.number ? `tel:${h.number}` : h.link!;
  return (
    <Animated.View entering={FadeInDown.delay(200)}>
      <Card style={{ borderColor: t.accent }}>
        <Text variant="heading">If today feels too heavy</Text>
        <Text variant="small">You can talk to a trained counsellor now. {h.detail}</Text>
        <Pressable
          onPress={() => Linking.openURL(target).catch(() => {})}
          accessibilityRole="button"
          accessibilityLabel={h.number ? `Call ${h.name}, ${h.number}` : `Open ${h.name}`}
          style={styles.inline}>
          <Icon name="phone" color={t.accent} />
          <Text variant="heading" color="accent">
            {h.number ? `Call ${h.number}` : h.name}
          </Text>
        </Pressable>
        <Text variant="small" color="textMuted">
          In an emergency, call {h.emergency}.
        </Text>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  festival: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: Radius.md },
  header: { gap: 4, marginTop: 8 },
  stack: { gap: Spacing.three },
  tabular: { fontVariant: ['tabular-nums'] },
  steps: { gap: 2, marginTop: 20, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 4 },
  stepIcon: { width: 30, height: 30, borderRadius: Radius.xs, alignItems: 'center', justifyContent: 'center' },
  hero: { paddingVertical: 28, alignItems: 'stretch', gap: 6 },
  moods: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
  moodBtn: { alignItems: 'center', gap: 8, paddingHorizontal: 1 },
  orbWrap: { alignItems: 'center', marginBottom: 20, marginTop: 8 },
  change: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16, marginTop: 6 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gameLink: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: Radius.lg, borderWidth: 1 },
  gameIcon: { width: 44, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  streakChip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 40, paddingHorizontal: 12, borderRadius: Radius.pill, borderWidth: 1 },
  blooms: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: Spacing.cardCompact, borderRadius: Radius.md, borderWidth: 1 },
  bloomRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  gear: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  reach: { gap: 10, paddingTop: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  weekDay: { alignItems: 'center', gap: 6 },
  emptyDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderStyle: 'dashed' },
});
