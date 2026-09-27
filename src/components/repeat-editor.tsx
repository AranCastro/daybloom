/**
 * "How often?" for the task sheet: one time, every day, weekly on chosen days, or every few days;
 * one to three times a day, each at its own time; and a quiet reminder at those times.
 */
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { tap } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  DEFAULT_TIMES,
  fromMinutes,
  MAX_EVERY,
  MIN_EVERY,
  REPEAT_CHOICES,
  repeatLabel,
  RepeatKind,
  timeLabel,
  toMinutes,
  WEEKDAY_LETTERS,
} from '@/lib/routines';

export type RepeatDraft = {
  kind: RepeatKind | 'once';
  weekdays: number[];
  every: number;
  times: string[];
  remind: boolean;
};

export function defaultRepeat(today: Date): RepeatDraft {
  return { kind: 'once', weekdays: [today.getDay()], every: 3, times: [...DEFAULT_TIMES[1]], remind: true };
}

/** Half-hour steps for the time of each reminder. */
const STEP = 30;

export function RepeatEditor({ value, onChange }: { value: RepeatDraft; onChange: (v: RepeatDraft) => void }) {
  const t = useTheme();
  const set = (patch: Partial<RepeatDraft>) => onChange({ ...value, ...patch });
  const repeating = value.kind !== 'once';

  const chip = (on: boolean) => [styles.chip, { borderColor: on ? t.text : t.line, backgroundColor: on ? t.text : 'transparent' }];
  const chipText = (on: boolean) => ({ color: on ? t.background : t.text });

  return (
    <View style={{ gap: 12 }}>
      <Text variant="label">How often?</Text>
      <View style={styles.wrap}>
        {REPEAT_CHOICES.map((c) => {
          const on = value.kind === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => (tap(), set({ kind: c.id }))}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={chip(on)}>
              {c.id !== 'once' && <Icon name="repeat" size={14} color={on ? t.background : t.textSecondary} />}
              <Text variant="small" strong style={chipText(on)}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {value.kind === 'weekly' && (
        <View style={styles.days} accessibilityLabel="Days of the week">
          {WEEKDAY_LETTERS.map((letter, d) => {
            const on = value.weekdays.includes(d);
            return (
              <Pressable
                key={d}
                onPress={() => {
                  tap();
                  const next = on ? value.weekdays.filter((x) => x !== d) : [...value.weekdays, d];
                  // At least one day stays chosen.
                  if (next.length) set({ weekdays: next.sort() });
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]}
                style={[styles.day, { borderColor: on ? t.brand : t.line, backgroundColor: on ? t.brand : 'transparent' }]}>
                <Text variant="small" strong style={{ color: on ? t.brandText : t.text }}>
                  {letter}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {value.kind === 'interval' && (
        <Stepper
          label={`Every ${value.every} days`}
          onMinus={() => set({ every: Math.max(MIN_EVERY, value.every - 1) })}
          onPlus={() => set({ every: Math.min(MAX_EVERY, value.every + 1) })}
          minusOff={value.every <= MIN_EVERY}
          plusOff={value.every >= MAX_EVERY}
        />
      )}

      {repeating && (
        <>
          <Text variant="label">Times a day</Text>
          <View style={styles.wrap}>
            {([1, 2, 3] as const).map((n) => {
              const on = value.times.length === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => (tap(), set({ times: [...DEFAULT_TIMES[n]] }))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={chip(on)}>
                  <Text variant="small" strong style={chipText(on)}>
                    {n === 1 ? 'Once' : n === 2 ? 'Twice' : 'Three times'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {value.times.map((time, i) => (
            <Stepper
              key={i}
              label={timeLabel(time)}
              onMinus={() => set({ times: value.times.map((x, j) => (j === i ? fromMinutes(toMinutes(x) - STEP) : x)) })}
              onPlus={() => set({ times: value.times.map((x, j) => (j === i ? fromMinutes(toMinutes(x) + STEP) : x)) })}
            />
          ))}

          <View style={[styles.remind, { borderColor: t.line }]}>
            <Icon name="bell" size={18} color={t.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text variant="bodySm" strong color="text">
                Gentle reminder
              </Text>
              <Text variant="caption">A quiet notification at each time, with a Done button. No sound.</Text>
            </View>
            <Switch
              value={value.remind}
              onValueChange={(v) => (tap(), set({ remind: v }))}
              trackColor={{ true: t.brand, false: t.line }}
              thumbColor="#fff"
              accessibilityLabel="Gentle reminder"
            />
          </View>
          <Text variant="caption">
            {repeatLabel({ kind: value.kind as RepeatKind, weekdays: value.weekdays, every: value.every, times: value.times })}. It appears in its
            quadrant on those days by itself; a day left unfinished is not carried over.
          </Text>
        </>
      )}
    </View>
  );
}

function Stepper({
  label,
  onMinus,
  onPlus,
  minusOff,
  plusOff,
}: {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
  minusOff?: boolean;
  plusOff?: boolean;
}) {
  const t = useTheme();
  const btn = (off?: boolean) => [styles.step, { borderColor: t.line, opacity: off ? 0.35 : 1 }];
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => (tap(), onMinus())} disabled={minusOff} accessibilityRole="button" accessibilityLabel={`Earlier or fewer: ${label}`} style={btn(minusOff)}>
        <Text variant="bodyStrong">−</Text>
      </Pressable>
      <Text variant="bodySm" strong color="text" center style={{ flex: 1 }}>
        {label}
      </Text>
      <Pressable onPress={() => (tap(), onPlus())} disabled={plusOff} accessibilityRole="button" accessibilityLabel={`Later or more: ${label}`} style={btn(plusOff)}>
        <Text variant="bodyStrong">+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1 },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  day: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  step: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  remind: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: Radius.md, padding: 12 },
});
