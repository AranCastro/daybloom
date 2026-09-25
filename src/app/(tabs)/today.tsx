import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { MoodOrb } from '@/components/mood-orb';
import { Avatar, ReachButtons } from '@/components/people';
import { TaskRow, TaskSheet } from '@/components/tasks';
import { Text } from '@/components/text';
import { Card, Screen, tap } from '@/components/ui';
import { TabBarInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, dayKey, greeting, prettyDate, weekdayShort } from '@/lib/dates';
import { isLow, MOODS, MoodValue, moodOf } from '@/lib/moods';
import { circleOf } from '@/lib/circle';
import { BadgeCelebration } from '@/components/badge';
import { Flower } from '@/components/flower';
import { flowerOf } from '@/lib/flowers';
import { remaining, sessionsOn } from '@/lib/focus';
import { gameForMood } from '@/lib/games';
import { awardBadges, openTasks, peopleIn, Person, recordMood, Task, useAppState } from '@/lib/store';
import { Badge, streakInfo } from '@/lib/badges';

export default function Today() {
  const t = useTheme();
  const name = useAppState((s) => s.name);
  const checkins = useAppState((s) => s.checkins);
  const buddy = useAppState((s) => s.buddy);
  const nudges = useAppState((s) => s.nudges);
  const [editing, setEditing] = useState(false);
  const [celebrate, setCelebrate] = useState<Badge[]>([]);
  const streak = streakInfo(checkins);

  const today = dayKey();
  const todayMood = moodOf(checkins[today]);
  const nudgedToday = nudges.some((n) => n.kind === 'auto' && dayKey(new Date(n.at)) === today);
  const showPicker = !todayMood || editing;

  async function choose(v: MoodValue) {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEditing(false);
    await recordMood(v);
    const fresh = awardBadges();
    if (fresh.length) setCelebrate(fresh);
  }

  return (
    <Screen bottomInset={TabBarInset + 24}>
      <BadgeCelebration badges={celebrate} onClose={() => setCelebrate([])} />
      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <View style={[styles.inline, { justifyContent: 'space-between' }]}>
          <Text variant="label">{prettyDate(new Date())}</Text>
          <View style={styles.inline}>
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${streak.current} day streak. Badges`}
            onPress={() => (tap(), router.push('/badges'))}
            style={[styles.streakChip, { backgroundColor: streak.checkedToday ? t.accentSoft : t.surface, borderColor: t.line }]}>
            <Icon name="flame" color={t.accent} size={18} fill={streak.checkedToday ? t.accent : 'none'} />
            <Text variant="bodyStrong" style={{ fontSize: 14 }}>
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
        <Text variant="title">
          {greeting()}
          {name ? `, ${name}` : ''}
        </Text>
      </Animated.View>

      <TodayBlooms />

      {showPicker ? (
        <Animated.View entering={FadeIn.duration(400)} key="picker">
          <Card style={styles.hero}>
            <Text variant="heading" center>
              How does today feel?
            </Text>
            <Text variant="small" center>
              One tap. No words needed.
            </Text>
            <View style={styles.moods}>
              {MOODS.map((m, i) => (
                <Animated.View key={m.value} entering={ZoomIn.delay(80 * i).springify().damping(14)}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={m.label}
                    onPress={() => choose(m.value)}
                    style={({ pressed }) => [styles.moodBtn, pressed && { transform: [{ scale: 0.92 }] }]}>
                    <MoodOrb mood={m} size={54} />
                    <Text variant="small" color="text" style={styles.moodLabel}>
                      {m.label}
                    </Text>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </Card>
        </Animated.View>
      ) : (
        todayMood && (
          <Animated.View entering={FadeIn.duration(500)} key="done">
            <Card style={styles.hero}>
              <View style={styles.orbWrap}>
                <MoodOrb mood={todayMood} size={148} breathe />
              </View>
              <Text variant="label" center>
                Today
              </Text>
              <Text variant="title" center>
                {todayMood.label}
              </Text>
              <Text variant="quote" color="textSecondary" center style={{ paddingHorizontal: 12 }}>
                {todayMood.line}
              </Text>
              <Pressable
                onPress={() => {
                  tap();
                  setEditing(true);
                }}
                style={styles.change}>
                <Text variant="bodyStrong" color="accent" style={{ fontSize: 14 }}>
                  Change today&apos;s answer
                </Text>
              </Pressable>
            </Card>
          </Animated.View>
        )
      )}

      {todayMood?.value === 1 && !editing && <SupportCard />}

      {nudgedToday && buddy && (
        <Animated.View entering={FadeInDown.delay(150)}>
          <Card tone="accent">
            <View style={styles.inline}>
              <Icon name="heart" color={t.accent} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                We asked {buddy.name} to call you today
              </Text>
            </View>
            <Text variant="small">They were only told to say hello. Nothing about your answers was shared.</Text>
          </Card>
        </Animated.View>
      )}

      {isLow(checkins[today]) && !editing && <ReachOutCard />}

      <FocusCard lowDay={isLow(checkins[today]) && !editing} />

      <FocusTimerCard />

      {todayMood && !editing && <GameLink mood={todayMood.value} />}

      <WeekStrip checkins={checkins} />

      <Card>
        <Pressable onPress={() => router.navigate('/circle')} style={styles.inline}>
          <View style={[styles.avatar, { backgroundColor: buddy ? t.brand : t.surfaceAlt }]}>
            <Text variant="bodyStrong" style={{ color: buddy ? t.brandText : t.textSecondary }}>
              {buddy ? buddy.name.slice(0, 1).toUpperCase() : '+'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{buddy ? buddy.name : 'Choose your buddy'}</Text>
            <Text variant="small">
              {buddy
                ? buddy.joined
                  ? 'Connected. Quietly on standby.'
                  : 'Invite sent. Waiting for them to join.'
                : 'One person who would want to know.'}
            </Text>
          </View>
          <Icon name="arrow" color={t.textMuted} size={20} />
        </Pressable>
      </Card>
    </Screen>
  );
}

/** Today's flowers from every activity, one tap from the garden. */
function TodayBlooms() {
  const t = useTheme();
  const garden = useAppState((s) => s.garden);
  const today = garden.filter((b) => dayKey(new Date(b.at)) === dayKey());
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${today.length} flowers today. Open garden`}
      onPress={() => (tap(), router.navigate('/journey'))}
      style={[styles.blooms, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Icon name="leaf" color="#3A9477" size={18} />
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
    </Pressable>
  );
}

/** Pomodoro entry point with today's flowers. */
function FocusTimerCard() {
  const t = useTheme();
  const active = useAppState((s) => s.focus.active);
  const sessions = useAppState((s) => s.focus.sessions);
  const todays = sessionsOn(sessions, dayKey());
  const [now, setNow] = useState(() => Date.now());
  const ticking = !!active && active.endAt !== null;
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
    <Pressable
      accessibilityRole="button"
      onPress={() => (tap(), router.push('/focus'))}
      style={({ pressed }) => [styles.gameLink, { backgroundColor: ready ? t.accentSoft : t.surface, borderColor: t.line, opacity: pressed ? 0.85 : 1 }]}>
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
    </Pressable>
  );
}

/** One-line suggestion of today's game, matched to the mood. */
function GameLink({ mood }: { mood: MoodValue }) {
  const t = useTheme();
  const game = gameForMood(mood);
  if (!game) return null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (tap(), router.push({ pathname: '/game/[id]', params: { id: game.id } }))}
      style={({ pressed }) => [styles.gameLink, { backgroundColor: t.surface, borderColor: t.line, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[styles.gameIcon, { backgroundColor: t.surfaceAlt }]}>
        <Icon name="play" color={t.text} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">A small break: {game.title}</Text>
        <Text variant="small">{game.tagline}</Text>
      </View>
      <Icon name="arrow" color={t.textMuted} size={20} />
    </Pressable>
  );
}

/**
 * On a low day: one person to call and one to message, taken from the circle matrix.
 * Least recently reached first, so the same person is not always asked.
 */
function ReachOutCard() {
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
            <Text variant="quote" color="textSecondary" style={{ fontSize: 16, lineHeight: 22 }}>
              A short hello can change the shape of a day.
            </Text>
            {picks.map((person) => (
              <View key={person.id} style={styles.reach}>
                <View style={styles.inline}>
                  <Avatar person={person} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{person.name}</Text>
                    <Text variant="small">{circleOf(person.quadrant).title}</Text>
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
function FocusCard({ lowDay }: { lowDay: boolean }) {
  const tasks = useAppState((s) => s.tasks);
  const [editing, setEditing] = useState<Task | null>(null);
  const today = dayKey();

  // Anything due today or late comes first (any quadrant), then the rest of "Do first".
  const dueNow = tasks
    .filter((x) => !x.done && x.due && x.due <= today)
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '') || a.quadrant - b.quadrant);
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
        <Text variant="quote" color="textSecondary" style={{ fontSize: 16, lineHeight: 22 }}>
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

function WeekStrip({ checkins }: { checkins: Record<string, number> }) {
  const t = useTheme();
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <Card>
      <Text variant="label">Last seven days</Text>
      <View style={styles.week}>
        {days.map((d) => {
          const m = moodOf(checkins[dayKey(d)]);
          const isToday = dayKey(d) === dayKey(today);
          return (
            <View key={dayKey(d)} style={styles.weekDay}>
              {m ? (
                <MoodOrb mood={m} size={30} face={false} />
              ) : (
                <View style={[styles.emptyDot, { borderColor: t.line }]} />
              )}
              <Text variant="small" color={isToday ? 'text' : 'textMuted'} style={{ fontSize: 12 }}>
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
  return (
    <Animated.View entering={FadeInDown.delay(200)}>
      <Card style={{ borderColor: t.accent }}>
        <Text variant="heading">If today feels too heavy</Text>
        <Text variant="small">
          You can talk to a trained counsellor now, free and confidential, any time of day. Tele-MANAS is run by the
          Government of India.
        </Text>
        <Pressable onPress={() => Linking.openURL('tel:14416')} style={styles.inline}>
          <Icon name="phone" color={t.accent} />
          <Text variant="heading" color="accent">
            Call 14416
          </Text>
        </Pressable>
        <Text variant="small" color="textMuted">
          In an emergency, call 112.
        </Text>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, marginTop: 8 },
  hero: { paddingVertical: 28, alignItems: 'stretch', gap: 6 },
  moods: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
  moodBtn: { alignItems: 'center', gap: 8, paddingHorizontal: 1 },
  moodLabel: { fontSize: 12.5 },
  orbWrap: { alignItems: 'center', marginBottom: 20, marginTop: 8 },
  change: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16, marginTop: 6 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gameLink: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 26, borderWidth: 1 },
  gameIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  streakChip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 40, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1 },
  blooms: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  bloomRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  gear: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  reach: { gap: 10, paddingTop: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  weekDay: { alignItems: 'center', gap: 6 },
  emptyDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderStyle: 'dashed' },
});
