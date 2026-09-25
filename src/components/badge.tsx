/** Badge medal and the celebration shown when a badge is earned. */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Confetti } from '@/components/games/fx';
import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { Badge, BadgeTier } from '@/lib/badges';

const TIERS: Record<BadgeTier, { ring: [string, string]; face: [string, string]; ink: string; label: string }> = {
  bronze: { ring: ['#E8B27E', '#B8743F'], face: ['#FBE7D3', '#F2C9A2'], ink: '#8A4E22', label: 'Bronze' },
  silver: { ring: ['#E4E9EE', '#9AA6B2'], face: ['#F7F9FB', '#DCE3EA'], ink: '#4E5B68', label: 'Silver' },
  gold: { ring: ['#FFE08A', '#D69A12'], face: ['#FFF6D6', '#F8DB85'], ink: '#8A5B00', label: 'Gold' },
};

export function Medal({ badge, size = 64, locked = false }: { badge: Badge; size?: number; locked?: boolean }) {
  const t = useTheme();
  const tier = TIERS[badge.tier];
  if (locked) {
    return (
      <View style={[styles.center, { width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.line, backgroundColor: t.surfaceAlt }]}>
        <Icon name={badge.icon} color={t.textMuted} size={size * 0.38} />
      </View>
    );
  }
  const inner = size * 0.8;
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient colors={tier.ring} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]} />
      <View style={[styles.center, StyleSheet.absoluteFill]}>
        <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden' }}>
          <LinearGradient colors={tier.face} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[StyleSheet.absoluteFill, styles.center]}>
            <Icon name={badge.icon} color={tier.ink} size={inner * 0.46} strokeWidth={2} />
          </LinearGradient>
        </View>
      </View>
      <View style={[styles.shine, { width: size * 0.34, height: size * 0.16, top: size * 0.12, left: size * 0.2, borderRadius: size }]} />
    </View>
  );
}

export function tierLabel(tier: BadgeTier) {
  return TIERS[tier].label;
}

/** Full-screen celebration for newly earned badges (shows the first; mentions the rest). */
export function BadgeCelebration({ badges, onClose }: { badges: Badge[]; onClose: () => void }) {
  const t = useTheme();
  const first = badges[0];
  return (
    <Modal visible={!!first} transparent animationType="fade" onRequestClose={onClose}>
      {first && (
        <View style={styles.scrim}>
          <Confetti count={50} />
          <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.card, { backgroundColor: t.surface }]}>
            <Text variant="label" center>
              New badge · {tierLabel(first.tier)}
            </Text>
            <Animated.View entering={ZoomIn.delay(200).springify().damping(8)}>
              <Medal badge={first} size={120} />
            </Animated.View>
            <Text variant="title" center>
              {first.title}
            </Text>
            <Text variant="quote" color="textSecondary" center style={{ fontSize: 17 }}>
              {first.cheer}
            </Text>
            {badges.length > 1 && (
              <Animated.View entering={FadeIn.delay(400)} style={styles.more}>
                {badges.slice(1, 4).map((b) => (
                  <Medal key={b.id} badge={b} size={34} />
                ))}
                <Text variant="small">
                  +{badges.length - 1} more {badges.length - 1 === 1 ? 'badge' : 'badges'}
                </Text>
              </Animated.View>
            )}
            <Button title="Lovely" onPress={onClose} style={{ alignSelf: 'stretch' }} />
            <Pressable
              onPress={() => {
                onClose();
                router.push('/badges');
              }}
              style={{ padding: 6 }}>
              <Text variant="bodyStrong" color="accent">
                See all badges
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  shine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '-25deg' }] },
  scrim: { flex: 1, backgroundColor: 'rgba(10,8,6,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, borderRadius: 32, padding: 24, gap: 12, alignItems: 'center' },
  more: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
