/** Two big doors from the garden: Send a flower, and Thottam (the Poo Kolam builder). */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Icon, IconName } from '@/components/icons';
import { Text } from '@/components/text';
import { Tappable } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
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
    <Tappable onPress={onPress} accessibilityLabel={`${title}. ${sub}`} radius={Radius.lg} containerStyle={{ flex: 1 }}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
        <View style={[styles.icon, { backgroundColor: dark ? '#FFFFFF22' : '#FFFFFFAA' }]}>
          <Icon name={icon} color={dark ? '#F3EEE7' : '#2F4A3F'} size={22} />
        </View>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption">
          {sub}
        </Text>
      </LinearGradient>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  tile: { borderRadius: Radius.lg, padding: Spacing.cardCompact, gap: 6, minHeight: 128 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
