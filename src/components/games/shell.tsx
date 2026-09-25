/** Full-screen frame shared by every game: close button, title, a stat on the right. */
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Backdrop, tap } from '@/components/ui';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function GameShell({ title, stat, children }: { title: string; stat?: ReactNode; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.column}>
          <View style={styles.top}>
            <Pressable
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close game"
              onPress={() => (tap(), router.back())}
              style={[styles.close, { backgroundColor: t.surface, borderColor: t.line }]}>
              <Icon name="close" color={t.text} size={18} />
            </Pressable>
            <Text variant="heading" style={{ flex: 1, textAlign: 'center' }}>
              {title}
            </Text>
            <View style={styles.stat}>{stat}</View>
          </View>
          <View style={{ flex: 1 }}>{children}</View>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Small pill used for scores and timers in the header. */
export function StatPill({ label, color }: { label: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Text variant="bodyStrong" style={{ fontSize: 14, color: color ?? t.text }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 56 },
  close: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stat: { minWidth: 40, alignItems: 'flex-end' },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
});
