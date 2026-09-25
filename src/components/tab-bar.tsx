/** Floating pill tab bar. */
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconName } from '@/components/icons';
import { Text } from '@/components/text';
import { tap } from '@/components/ui';
import { Radius, TabBarHeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ICONS: Record<string, IconName> = {
  today: 'sun',
  matrix: 'grid',
  journey: 'leaf',
  circle: 'people',
  play: 'play',
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      <View style={[styles.bar, { backgroundColor: t.tabBar, borderColor: t.line }]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const title = descriptors[route.key].options.title ?? route.name;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              aria-selected={focused}
              accessibilityLabel={title}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  tap();
                  navigation.navigate(route.name);
                }
              }}
              style={[styles.item, focused && { backgroundColor: t.brand }]}>
              <Icon name={ICONS[route.name] ?? 'sun'} color={focused ? t.brandText : t.textSecondary} size={21} />
              {focused && (
                <Text variant="bodyStrong" style={{ color: t.brandText, fontSize: 13.5 }}>
                  {title}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    height: TabBarHeight,
    borderRadius: Radius.pill,
    borderWidth: 1,
    padding: 7,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    minWidth: 50,
    justifyContent: 'center',
  },
});
