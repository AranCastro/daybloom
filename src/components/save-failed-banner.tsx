/**
 * Shown over every screen while saving to the phone is failing (usually storage full). Changes stay
 * in memory meanwhile; "Try again" writes them once space has been freed. Mount once at the root.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { useTheme } from '@/hooks/use-theme';
import { flushState, useSaveFailed } from '@/lib/store';

export function SaveFailedBanner() {
  const failed = useSaveFailed();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  if (!failed) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <View style={[styles.card, { backgroundColor: t.accentSoft, borderColor: t.accent }]} accessibilityRole="alert">
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Changes are not being saved</Text>
          <Text variant="small">Your phone may be out of space. Free some up, then try again; until then, keep the app open.</Text>
        </View>
        <Pressable onPress={flushState} style={[styles.btn, { borderColor: t.accent }]} accessibilityRole="button">
          <Text variant="small" color="accent">
            Try again
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 100 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
});
