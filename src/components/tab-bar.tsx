/**
 * Floating pill tab bar. The bar keeps one width whichever tab is on show; the active pill
 * glides between tabs (a spring layout transition) and its label fades in, so nothing jumps.
 * On iOS 26 and later the bar is Liquid Glass.
 */
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconName } from '@/components/icons';
import { Text } from '@/components/text';
import { tap } from '@/components/ui';
import { Radius, Shadow, TabBarHeight } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';

const ICONS: Record<string, IconName> = {
  today: 'sun',
  matrix: 'grid',
  focus: 'clock',
  journey: 'leaf',
  circle: 'people',
  play: 'play',
};

/** The active tab takes this many shares of the width; the others one each. */
const ACTIVE_SHARE = 2.5;
const glass = Platform.OS === 'ios' && isLiquidGlassAvailable();

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const barWidth = Math.min(width - 24, 440);
  // Android elevation draws through a translucent fill, so the bar is opaque there.
  const fill = glass ? 'transparent' : Platform.OS === 'android' ? t.tabBarSolid : t.tabBar;

  const items = state.routes.map((route, index) => {
    const focused = state.index === index;
    const title = descriptors[route.key].options.title ?? route.name;
    return (
      <Animated.View key={route.key} layout={LinearTransition.springify().damping(18).stiffness(180)} style={{ flex: focused ? ACTIVE_SHARE : 1 }}>
        <Pressable
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
            <Animated.View entering={FadeIn.duration(220).delay(90)} style={styles.labelBox}>
              <Text variant="caption" strong numberOfLines={1} style={{ color: t.brandText }}>
                {title}
              </Text>
            </Animated.View>
          )}
        </Pressable>
      </Animated.View>
    );
  });

  const barStyle = [styles.bar, { width: barWidth, backgroundColor: fill, borderColor: t.line }, !glass && Shadow.md];
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      {glass ? (
        <GlassView glassEffectStyle="regular" colorScheme={dark ? 'dark' : 'light'} style={barStyle}>
          {items}
        </GlassView>
      ) : (
        <View style={barStyle}>{items}</View>
      )}
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
    padding: 6,
    gap: 3,
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  labelBox: { flexShrink: 1 },
});
