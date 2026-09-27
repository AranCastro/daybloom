/**
 * Jar of good days. On a Good or Bright day the app asks for one line about what went well;
 * on a Heavy day it hands one of those lines back, in the user's own words.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Button, Card, Input, tap } from '@/components/ui';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { fromKey, prettyDate } from '@/lib/dates';
import { setGoodNote, useAppState } from '@/lib/store';

const JAR = { light: ['#FFF4DC', '#FCE3C0'], dark: ['#3A2E1C', '#2E2618'] } as const;

/** Good or Bright day: "What went well today?" (one line, optional). */
export function GoodDayPrompt({ day }: { day: string }) {
  const dark = useIsDark();
  const t = useTheme();
  const saved = useAppState((s) => s.goodNotes[day]);
  const count = useAppState((s) => Object.keys(s.goodNotes).length);
  const [draft, setDraft] = useState(saved ?? '');
  const [editing, setEditing] = useState(!saved);

  if (!editing && saved) {
    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <Card style={{ backgroundColor: dark ? JAR.dark[0] : JAR.light[0], borderColor: dark ? '#5A4526' : '#F1D29B' }}>
          <View style={styles.head}>
            <Icon name="jar" color={t.legendary} size={22} />
            <Text variant="label" style={{ flex: 1 }}>
              In your jar of good days · {count}
            </Text>
            <Pressable onPress={() => (tap(), setEditing(true))} hitSlop={8} accessibilityRole="button">
              <Text variant="small" color="accent">
                Edit
              </Text>
            </Pressable>
          </View>
          <Text variant="quote">
            “{saved}”
          </Text>
          <Text variant="small">On a heavier day, Daybloom will hand this back to you.</Text>
        </Card>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(350)}>
      <Card style={{ backgroundColor: dark ? JAR.dark[0] : JAR.light[0], borderColor: dark ? '#5A4526' : '#F1D29B' }}>
        <View style={styles.head}>
          <Icon name="jar" color={t.legendary} size={22} />
          <Text variant="label" style={{ flex: 1 }}>
            Jar of good days
          </Text>
        </View>
        <Text variant="heading">What went well today?</Text>
        <Input value={draft} onChangeText={setDraft} placeholder="One line is enough" maxLength={160} returnKeyType="done" />
        <Button
          title={saved ? 'Save' : 'Put it in the jar'}
          icon="jar"
          kind="secondary"
          disabled={!draft.trim()}
          onPress={() => {
            tap();
            setGoodNote(day, draft);
            setEditing(false);
          }}
        />
      </Card>
    </Animated.View>
  );
}

/** Heavy day: one line from an earlier good day, with a way to see another. */
export function GoodDayMemory({ day }: { day: string }) {
  const dark = useIsDark();
  const t = useTheme();
  const notes = useAppState((s) => s.goodNotes);
  const past = Object.entries(notes)
    .filter(([d]) => d < day)
    .sort(([a], [b]) => b.localeCompare(a));
  // Start from a note picked by the date, so the same one shows all day until "Another" is tapped.
  const seed = [...day].reduce((n, c) => n + c.charCodeAt(0), 0);
  const [shift, setShift] = useState(0);
  if (!past.length) return null;
  const [when, text] = past[(seed + shift) % past.length];

  return (
    <Animated.View entering={FadeInDown.duration(450)}>
      <Card style={{ backgroundColor: dark ? JAR.dark[1] : JAR.light[1], borderColor: dark ? '#5A4526' : '#EBC380' }}>
        <View style={styles.head}>
          <Icon name="jar" color={t.legendary} size={22} />
          <Text variant="label" style={{ flex: 1 }}>
            From your jar of good days
          </Text>
        </View>
        <Text variant="quote" color="text">
          “{text}”
        </Text>
        <Text variant="small">You wrote this on {prettyDate(fromKey(when))}. Days like that come back.</Text>
        {past.length > 1 && (
          <Pressable onPress={() => (tap(), setShift(shift + 1))} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
            <Text variant="bodySm" strong color="accent">
              Another from the jar
            </Text>
          </Pressable>
        )}
      </Card>
    </Animated.View>
  );
}

/** Garden tab: how full the jar is, and the latest lines. */
export function GoodDaysJar() {
  const t = useTheme();
  const notes = useAppState((s) => s.goodNotes);
  const entries = Object.entries(notes).sort(([a], [b]) => b.localeCompare(a));
  const [open, setOpen] = useState(false);
  if (!entries.length) return null;
  const shown = open ? entries : entries.slice(0, 3);
  return (
    <Card>
      <View style={styles.head}>
        <Icon name="jar" color={t.legendary} size={22} />
        <Text variant="label" style={{ flex: 1 }}>
          Jar of good days · {entries.length}
        </Text>
      </View>
      {shown.map(([d, text]) => (
        <View key={d} style={{ gap: 2 }}>
          <Text variant="body">“{text}”</Text>
          <Text variant="caption">
            {prettyDate(fromKey(d))}
          </Text>
        </View>
      ))}
      {entries.length > 3 && (
        <Pressable onPress={() => (tap(), setOpen(!open))} hitSlop={8} accessibilityRole="button">
          <Text variant="small" color="accent">
            {open ? 'Show fewer' : `Show all ${entries.length}`}
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
