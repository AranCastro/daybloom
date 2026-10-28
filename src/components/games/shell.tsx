/** Full-screen frame shared by every game: close button, title, a stat on the right. */
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Backdrop, tap } from '@/components/ui';
import { MaxContentWidth, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Leave a game. Opened from a link (a widget, a notification) there is no screen to go back to, so go to Play. */
export function leaveGame() {
  if (router.canGoBack()) router.back();
  else router.replace('/play');
}

/** `scroll` lets the body scroll: intros and results can outgrow a short window (a tablet in landscape). */
export function GameShell({ title, stat, scroll, children }: { title: string; stat?: ReactNode; scroll?: boolean; children: ReactNode }) {
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
              onPress={() => (tap(), leaveGame())}
              style={[styles.close, { backgroundColor: t.surface, borderColor: t.line }]}>
              <Icon name="close" color={t.text} size={18} />
            </Pressable>
            <Text variant="heading" style={{ flex: 1, textAlign: 'center' }}>
              {title}
            </Text>
            <View style={styles.stat}>{stat}</View>
          </View>
          {scroll ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>{children}</View>
          )}
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
      <Text variant="bodySm" strong style={{ color: color ?? t.text }}>
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
  scrollBody: { flexGrow: 1 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1 },
});
