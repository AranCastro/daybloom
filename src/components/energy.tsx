/** Morning energy: low, medium or high. It decides which effort levels the matrix shows (lib/effort). */
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { Card, tap } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { EnergyLevel, setEnergy, useAppState } from '@/lib/store';

export const ENERGY: { value: EnergyLevel; label: string; emoji: string; line: string; tint: string }[] = [
  { value: 1, label: 'Low', emoji: '🪫', line: 'Go easy. The matrix shows Quick tasks only today.', tint: '#C9503B' },
  { value: 2, label: 'Medium', emoji: '🔋', line: 'A steady day. Deep work is hidden; pick one thing that matters.', tint: '#D08A2E' },
  { value: 3, label: 'High', emoji: '⚡', line: 'Good energy. Deep work comes first today; try a Deep 50 focus session.', tint: '#3A9477' },
];

export function EnergyCard({ day, hour }: { day: string; hour: number }) {
  const t = useTheme();
  const level = useAppState((s) => s.energy[day]);
  const chosen = ENERGY.find((e) => e.value === level);
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text variant="label" style={{ flex: 1 }}>
          {hour < 12 ? 'Morning energy' : 'Energy today'}
        </Text>
        {chosen && <Text variant="small">{chosen.emoji} {chosen.label}</Text>}
      </View>
      <View style={styles.row}>
        {ENERGY.map((e) => {
          const on = e.value === level;
          return (
            <Pressable
              key={e.value}
              onPress={() => (tap(), setEnergy(day, e.value))}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${e.label} energy`}
              style={({ pressed }) => [
                styles.btn,
                { borderColor: on ? e.tint : t.line, backgroundColor: on ? e.tint + '22' : t.surface, transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}>
              <Text style={{ fontSize: 22 }}>{e.emoji}</Text>
              <Text style={{ fontFamily: Fonts.bodyStrong, fontSize: 13, color: t.text }}>{e.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {chosen && (
        <Animated.View entering={FadeIn.duration(250)}>
          <Text variant="small">{chosen.line}</Text>
        </Animated.View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 18, borderWidth: 1.5 },
});
