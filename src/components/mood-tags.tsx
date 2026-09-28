/** Optional feeling tags after the one-tap check-in, and a compact row that shows them. */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { Input, tap } from '@/components/ui';
import { confirmThen } from '@/lib/confirm';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MAX_CUSTOM_MOODS, MAX_TAGS_PER_DAY, MOOD_TAGS, MoodTag, tagOf } from '@/lib/mood-tags';
import { addCustomMood, deleteCustomMood, toggleMoodTag, useAppState } from '@/lib/store';

/** Quick emoji for the user's own mood (they can also type any emoji). */
const EMOJI_CHOICES = ['🙂', '😐', '🥲', '😵‍💫', '🤯', '🥳', '😎', '🤒', '😶', '🫠', '💪', '🌧️'];

/**
 * Twenty feelings as chips, then the user's own (one word and an emoji, added with "＋ Your own";
 * touch and hold one of your own to remove it). The ones that match the day's mood come first.
 */
export function MoodTagPicker({ day, mood }: { day: string; mood: number }) {
  const t = useTheme();
  const chosen = useAppState((s) => s.moodTags[day]) ?? [];
  const custom = useAppState((s) => s.customMoods);
  const [open, setOpen] = useState(chosen.length > 0);
  const [creating, setCreating] = useState(false);
  const first = mood >= 3 ? 'light' : 'heavy';
  const ordered = [...MOOD_TAGS, ...custom].sort((a, b) => Number(b.tone === first) - Number(a.tone === first));
  const full = chosen.length >= MAX_TAGS_PER_DAY;

  if (!open) {
    return (
      <Pressable
        onPress={() => (tap(), setOpen(true))}
        accessibilityRole="button"
        style={[styles.add, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
        <Text variant="small" strong color="text">
          ＋ Add how you feel (optional)
        </Text>
      </Pressable>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(300)} layout={LinearTransition} style={{ gap: 8, alignSelf: 'stretch' }}>
      <Text variant="label" center>
        {chosen.length ? `Feeling · ${chosen.length} of ${MAX_TAGS_PER_DAY}` : `How else does today feel? Pick up to ${MAX_TAGS_PER_DAY}`}
      </Text>
      <View style={styles.wrap}>
        {ordered.map((tag) => {
          const on = chosen.includes(tag.id);
          const warm = tag.tone === 'light';
          const mine = custom.includes(tag);
          return (
            <Pressable
              key={tag.id}
              onLongPress={
                mine
                  ? () => confirmThen(`Remove “${tag.label}”?`, 'It leaves your list; days already tagged keep it.', 'Remove', () => deleteCustomMood(tag.id))
                  : undefined
              }
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: !on && full }}
              accessibilityLabel={tag.label}
              disabled={!on && full}
              onPress={() => (tap(), toggleMoodTag(day, tag.id, MAX_TAGS_PER_DAY))}
              style={[
                styles.chip,
                {
                  borderColor: on ? (warm ? t.tagWarm : t.tagCool) : t.line,
                  backgroundColor: on ? (warm ? t.tagWarmSoft : t.tagCoolSoft) : t.surface,
                  opacity: !on && full ? 0.45 : 1,
                },
              ]}>
              <Text variant="bodySm">{tag.emoji}</Text>
              <Text variant="small" strong color="text">
                {tag.label}
              </Text>
            </Pressable>
          );
        })}
        {!creating && custom.length < MAX_CUSTOM_MOODS && (
          <Pressable
            onPress={() => (tap(), setCreating(true))}
            accessibilityRole="button"
            accessibilityLabel="Add your own mood"
            style={[styles.chip, { borderColor: t.line, borderStyle: 'dashed', backgroundColor: 'transparent' }]}>
            <Text variant="small" strong color="text">
              ＋ Your own
            </Text>
          </Pressable>
        )}
      </View>
      {creating && (
        <CustomMoodForm
          defaultTone={first}
          onDone={(m) => {
            setCreating(false);
            if (m && !chosen.includes(m.id)) toggleMoodTag(day, m.id, MAX_TAGS_PER_DAY);
          }}
        />
      )}
    </Animated.View>
  );
}

/** One word, an emoji and light or heavy: the user's own mood, kept for later days too. */
function CustomMoodForm({ defaultTone, onDone }: { defaultTone: MoodTag['tone']; onDone: (m: MoodTag | null) => void }) {
  const t = useTheme();
  const [word, setWord] = useState('');
  const [emoji, setEmoji] = useState('🙂');
  const [tone, setTone] = useState<MoodTag['tone']>(defaultTone);
  const save = () => {
    const m = addCustomMood(word, emoji, tone);
    if (m) tap();
    onDone(m);
  };
  const chip = (on: boolean) => [styles.chip, { borderColor: on ? t.text : t.line, backgroundColor: on ? t.text : t.surface }];
  return (
    <Animated.View entering={FadeIn.duration(250)} style={[styles.form, { borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
      <Text variant="label">Your own mood</Text>
      <View style={styles.formRow}>
        <Input value={emoji} onChangeText={(v) => setEmoji(v.slice(-8))} maxLength={8} accessibilityLabel="Emoji" style={styles.emojiInput} />
        <Input
          value={word}
          onChangeText={setWord}
          placeholder="One word, e.g. Sleepy"
          maxLength={24}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
          style={{ flex: 1, minWidth: 0 }}
        />
      </View>
      <View style={[styles.wrap, { justifyContent: 'flex-start' }]}>
        {EMOJI_CHOICES.map((e) => (
          <Pressable key={e} onPress={() => (tap(), setEmoji(e))} accessibilityRole="button" accessibilityLabel={`Emoji ${e}`} style={[styles.emoji, { borderColor: emoji === e ? t.text : 'transparent' }]}>
            <Text variant="body">{e}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.wrap, { justifyContent: 'flex-start' }]}>
        {(['light', 'heavy'] as const).map((k) => (
          <Pressable key={k} onPress={() => (tap(), setTone(k))} accessibilityRole="radio" accessibilityState={{ selected: tone === k }} style={chip(tone === k)}>
            <Text variant="small" strong style={{ color: tone === k ? t.background : t.text }}>
              {k === 'light' ? 'Feels light' : 'Feels heavy'}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.formRow}>
        <Pressable onPress={() => onDone(null)} accessibilityRole="button" style={[styles.chip, { borderColor: t.line }]}>
          <Text variant="small" strong color="text">
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={!word.trim()}
          accessibilityRole="button"
          style={[styles.chip, { borderColor: t.brand, backgroundColor: t.brand, opacity: word.trim() ? 1 : 0.4 }]}>
          <Text variant="small" strong style={{ color: t.brandText }}>
            Add and pick
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

/** The day's tags as small chips (calendar, journal). */
export function MoodTagRow({ ids, size = 'small' }: { ids: string[] | undefined; size?: 'small' | 'tiny' }) {
  const t = useTheme();
  const custom = useAppState((s) => s.customMoods);
  const tags = (ids ?? []).map((id) => tagOf(id, custom)).filter((x) => !!x);
  if (!tags.length) return null;
  return (
    <View style={styles.wrap}>
      {tags.map((tag) => (
        <View key={tag.id} style={[styles.pill, { backgroundColor: t.surfaceAlt }]}>
          <Text variant={size === 'tiny' ? 'micro' : 'caption'} color="text">
            {tag.emoji}{' '}
            <Text variant={size === 'tiny' ? 'micro' : 'caption'} strong color="text">
              {tag.label}
            </Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: 1 },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill },
  form: { gap: 10, padding: 12, borderRadius: Radius.md, borderWidth: 1 },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emojiInput: { width: 64, textAlign: 'center' },
  emoji: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  add: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.pill, borderWidth: 1 },
});
