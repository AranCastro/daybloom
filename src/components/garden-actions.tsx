/** Two big doors from the garden: Send a flower, and Thottam (the Poo Kolam builder). */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, IconName } from '@/components/icons';
import { Text } from '@/components/text';
import { tap } from '@/components/ui';
import { useIsDark } from '@/hooks/use-theme';

export function GardenActions() {
  const dark = useIsDark();
  return (
    <View style={styles.row}>
      <Tile
        title="Send a flower"
        sub="A card for someone in your circle"
        icon="gift"
        colors={dark ? ['#4A2E3A', '#2E2230'] : ['#FAD9E2', '#FCEFE6']}
        onPress={() => router.push('/send-flower')}
      />
      <Tile
        title="Thottam"
        sub="Make a Poo Kolam from your flowers"
        icon="spark"
        colors={dark ? ['#4A3A1E', '#2E2A1C'] : ['#FCE3B8', '#F3F4DA']}
        onPress={() => router.push('/thottam')}
      />
    </View>
  );
}

function Tile({ title, sub, icon, colors, onPress }: { title: string; sub: string; icon: IconName; colors: [string, string]; onPress: () => void }) {
  const dark = useIsDark();
  return (
    <Pressable onPress={() => (tap(), onPress())} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} style={({ pressed }) => [{ flex: 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
        <View style={[styles.icon, { backgroundColor: dark ? '#FFFFFF22' : '#FFFFFFAA' }]}>
          <Icon name={icon} color={dark ? '#F3EEE7' : '#2F4A3F'} size={22} />
        </View>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="small" style={{ fontSize: 12 }}>
          {sub}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  tile: { borderRadius: 22, padding: 14, gap: 6, minHeight: 128 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
