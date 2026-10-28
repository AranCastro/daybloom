/**
 * Room the floating tab bar takes at the bottom of a tab screen. The bar sits above the bottom
 * inset (tab-bar.tsx), which is larger with 3-button navigation or a tablet taskbar, so a fixed
 * allowance leaves the end of a screen under the bar there.
 */
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBarHeight, TabBarInset, TabBarMinBottom } from '@/constants/theme';

export function useTabBarInset(): number {
  const { bottom } = useSafeAreaInsets();
  // Never below the fixed allowance, so phones with gesture navigation keep their spacing.
  return Math.max(TabBarInset, TabBarHeight + Math.max(bottom, TabBarMinBottom));
}
