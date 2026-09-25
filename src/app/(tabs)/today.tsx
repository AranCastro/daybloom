import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { MoodOrb } from '@/components/mood-orb';
import { Text } from '@/components/text';
import { Card, Screen, tap } from '@/components/ui';
import { TabBarInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { addDays, dayKey, greeting, prettyDate, weekdayShort } from '@/lib/dates';
import { MOODS, MoodValue, moodOf } from '@/lib/moods';
import { recordMood, useAppState } from '@/lib/store';

export default function Today() {
  const t = useTheme();
  const name = useAppState((s) => s.name);
  const checkins = useAppState((s) => s.checkins);
  const buddy = useAppState((s) => s.buddy);
  const nudges = useAppState((s) => s.nudges);
  const [editing, setEditing] = useState(false);

  const today = dayKey();
  const todayMood = moodOf(checkins[today]);
  const nudgedToday = nudges.some((n) => n.kind === 'auto' && dayKey(new Date(n.at)) === today);
  const showPicker = !todayMood || editing;

  async function choose(v: MoodValue) {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEditing(false);
    await recordMood(v);
  }

  return (
    <Screen bottomInset={TabBarInset + 24}>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
        <Text variant="label">{prettyDate(new Date())}</Text>
        <Text variant="title">
          {greeting()}
          {name ? `, ${name}` : ''}
        </Text>
      </Animated.View>

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
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  weekDay: { alignItems: 'center', gap: 6 },
  emptyDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderStyle: 'dashed' },
});
