/**
 * First-run flow: welcome → how it works → your name → your buddy → reminder.
 * Each step is a full screen with a single decision.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated';

import { Icon, IconName } from '@/components/icons';
import { MoodOrb } from '@/components/mood-orb';
import { Text } from '@/components/text';
import { Button, Choice, Input, Screen, tap } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { prettyTime } from '@/lib/dates';
import { shareInvite } from '@/lib/invite';
import { MOODS } from '@/lib/moods';
import { newTopic } from '@/lib/ntfy';
import { scheduleDailyReminder } from '@/lib/reminders';
import { getState, update } from '@/lib/store';

const STEPS = 5;

export default function Onboarding() {
  const t = useTheme();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(getState().name);
  const [buddyName, setBuddyName] = useState('');
  const [hour, setHour] = useState(21);
  const [shareNote, setShareNote] = useState('');

  const next = () => setStep((s) => Math.min(s + 1, STEPS - 1));
  const back = () => (tap(), setStep((s) => Math.max(s - 1, 0)));

  async function invite() {
    const bn = buddyName.trim();
    if (!bn) return;
    const topic = getState().buddy?.topic ?? newTopic();
    update({ buddy: { name: bn, topic, joined: false } });
    const r = await shareInvite(bn, name.trim(), topic);
    if (r === 'copied') setShareNote('Invite copied. Paste it into WhatsApp or SMS.');
    next();
  }

  async function finish() {
    update({ onboarded: true, reminder: { enabled: true, hour, minute: 0 } });
    await scheduleDailyReminder(hour, 0);
    router.replace('/today');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <Screen contentStyle={{ paddingBottom: 12 }}>
        <View style={styles.topRow}>
          {step > 0 ? (
            <Pressable hitSlop={12} onPress={back} accessibilityLabel="Back">
              <Icon name="back" color={t.textSecondary} />
            </Pressable>
          ) : (
            <View style={{ width: 22 }} />
          )}
          <View style={styles.dots}>
            {Array.from({ length: STEPS }, (_, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: i <= step ? t.brand : t.line, width: i === step ? 22 : 7 }]}
              />
            ))}
          </View>
          <View style={{ width: 22 }} />
        </View>

        <Animated.View key={step} entering={FadeIn.duration(380)} exiting={FadeOut.duration(150)} style={styles.body}>
          {step === 0 && <Welcome onNext={next} />}

          {step === 1 && (
            <>
              <View style={{ gap: 10 }}>
                <Text variant="label">How it works</Text>
                <Text variant="title">Help that arrives{'\n'}without asking.</Text>
              </View>
              <View style={{ gap: 18, marginTop: 8 }}>
                <HowRow n="1" icon="sun" title="Tap once a day" text="Choose how today feels. No writing, no journaling." />
                <HowRow n="2" icon="people" title="Pick one buddy" text="Someone who would want to know you are having a hard time." />
                <HowRow n="3" icon="bell" title="We nudge, quietly" text="After a few low days in a row, they get one line: “Call you today.”" />
                <HowRow n="4" icon="lock" title="Nothing else leaves your phone" text="They never see your moods or learn why." />
              </View>
              <View style={{ flex: 1 }} />
              <Button title="Sounds good" onPress={next} />
            </>
          )}

          {step === 2 && (
            <>
              <View style={{ gap: 10 }}>
                <Text variant="label">About you</Text>
                <Text variant="title">What should your buddy call you?</Text>
                <Text variant="body" color="textSecondary">
                  This is the only word about you they will ever see.
                </Text>
              </View>
              <Input value={name} onChangeText={setName} placeholder="Your first name" autoCapitalize="words" autoFocus />
              <View style={{ flex: 1 }} />
              <Button
                title="Continue"
                disabled={!name.trim()}
                onPress={() => {
                  update({ name: name.trim() });
                  next();
                }}
              />
            </>
          )}

          {step === 3 && (
            <>
              <View style={{ gap: 10 }}>
                <Text variant="label">Your buddy</Text>
                <Text variant="title">Who would pick up the phone for you?</Text>
                <Text variant="body" color="textSecondary">
                  A sibling, a close friend, a parent. You will send them a short invite on WhatsApp or SMS.
                </Text>
              </View>
              <Input value={buddyName} onChangeText={setBuddyName} placeholder="Their first name" autoCapitalize="words" />
              <View style={{ flex: 1 }} />
              <Button title="Send invite" icon="share" disabled={!buddyName.trim()} onPress={invite} />
              <Pressable onPress={next} style={styles.skip}>
                <Text variant="small" color="textMuted">
                  I will choose later
                </Text>
              </Pressable>
            </>
          )}

          {step === 4 && (
            <>
              <View style={{ gap: 10 }}>
                <Text variant="label">A gentle reminder</Text>
                <Text variant="title">When should we ask how your day was?</Text>
                <Text variant="body" color="textSecondary">
                  Once a day, at the time you choose. You can change it any time.
                </Text>
              </View>
              {!!shareNote && <Text variant="small">{shareNote}</Text>}
              <Choice
                options={[
                  { label: '8 AM', value: 8 },
                  { label: '1 PM', value: 13 },
                  { label: '7 PM', value: 19 },
                  { label: '9 PM', value: 21 },
                ]}
                value={hour}
                onChange={setHour}
              />
              <Text variant="small" center>
                Every day at {prettyTime(hour, 0)}
              </Text>
              <View style={{ flex: 1 }} />
              <Button title="Start" onPress={finish} />
            </>
          )}
        </Animated.View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <>
      <View style={styles.orbs}>
        {MOODS.map((m, i) => (
          <Animated.View
            key={m.value}
            entering={FadeInUp.delay(120 * i).springify().damping(13)}
            style={{ marginTop: [30, 0, 40, 8, 26][i] }}>
            <MoodOrb mood={m} size={[58, 72, 64, 52, 46][i]} breathe={i === 1} />
          </Animated.View>
        ))}
      </View>
      <Animated.View entering={FadeInDown.delay(500).duration(600)} style={{ gap: 14 }}>
        <Text variant="hero">Nudge a Friend</Text>
        <Text variant="quote" color="textSecondary">
          People who are struggling rarely ask for help. So let help find them.
        </Text>
      </Animated.View>
      <View style={{ flex: 1 }} />
      <Animated.View entering={FadeInDown.delay(800)}>
        <Button title="Begin" icon="arrow" onPress={onNext} />
      </Animated.View>
    </>
  );
}

function HowRow({ n, icon, title, text }: { n: string; icon: IconName; title: string; text: string }) {
  const t = useTheme();
  return (
    <View style={styles.how}>
      <View style={[styles.howIcon, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Icon name={icon} color={t.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">
          {n}. {title}
        </Text>
        <Text variant="small">{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 32 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 7, borderRadius: 4 },
  body: { flex: 1, gap: 22, paddingTop: 20, paddingBottom: 12, minHeight: 560 },
  orbs: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 24, marginBottom: 36 },
  how: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  howIcon: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  skip: { alignSelf: 'center', padding: 8 },
});
