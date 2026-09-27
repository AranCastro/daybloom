/** Optional feeling tags after the one-tap check-in, and a compact row that shows them. */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { tap } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MAX_TAGS_PER_DAY, MOOD_TAGS, tagOf } from '@/lib/mood-tags';
import { toggleMoodTag, useAppState } from '@/lib/store';

/** Twenty feelings as chips. The ones that match the day's mood come first. */
export function MoodTagPicker({ day, mood }: { day: string; mood: number }) {
  const t = useTheme();
  const chosen = useAppState((s) => s.moodTags[day]) ?? [];
  const [open, setOpen] = useState(chosen.length > 0);
  const first = mood >= 3 ? 'light' : 'heavy';
  const ordered = [...MOOD_TAGS].sort((a, b) => Number(b.tone === first) - Number(a.tone === first));
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
          return (
            <Pressable
              key={tag.id}
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
      </View>
    </Animated.View>
  );
}

/** The day's tags as small chips (calendar, journal). */
export function MoodTagRow({ ids, size = 'small' }: { ids: string[] | undefined; size?: 'small' | 'tiny' }) {
  const t = useTheme();
  const tags = (ids ?? []).map(tagOf).filter((x) => !!x);
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
  add: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 9, borderRadius: Radius.pill, borderWidth: 1 },
});
