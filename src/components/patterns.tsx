/** "Patterns you might not notice": found on the phone, shown in the Garden tab. */
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Card } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { checkinDays, findPatterns, MIN_DAYS } from '@/lib/patterns';
import { useAppState } from '@/lib/store';

export function PatternsCard({ today }: { today: string }) {
  const t = useTheme();
  const state = useAppState((s) => s);
  const days = checkinDays(state, today).length;
  const patterns = findPatterns(state, today);

  return (
    <Card>
      <Text variant="label">Patterns you might not notice</Text>
      {days < MIN_DAYS ? (
        <>
          <Text variant="small">
            Patterns appear after {MIN_DAYS} check-ins. {days} so far: keep tapping your mood, and add tags, energy and places
            when you like.
          </Text>
          <View style={[styles.track, { backgroundColor: t.surfaceAlt }]}>
            <View style={{ width: `${Math.round((days / MIN_DAYS) * 100)}%`, height: '100%', borderRadius: 4, backgroundColor: t.brand }} />
          </View>
        </>
      ) : patterns.length === 0 ? (
        <Text variant="small">Nothing stands out yet in the last 90 days. That can be good news: your days are fairly even.</Text>
      ) : (
        patterns.map((p) => (
          <View key={p.id} style={styles.row}>
            <View style={[styles.emoji, { backgroundColor: t.surfaceAlt }]}>
              <Text variant="heading">{p.emoji}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{p.title}</Text>
              <Text variant="caption">
                {p.detail}
              </Text>
            </View>
          </View>
        ))
      )}
      <Text variant="caption" color="textMuted">
        Worked out on this phone from the last 90 days. Patterns, not causes.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  emoji: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
});
