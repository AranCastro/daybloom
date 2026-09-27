/**
 * True when motion should be kept to a minimum: the phone's accessibility setting or the
 * in-app Reduce motion switch. Reanimated's entering/layout animations already follow the
 * ReducedMotionConfig in the root layout; this hook is for the choreography around them
 * (delays, timers, continuous progress) that Reanimated cannot see.
 */
import { useReducedMotion } from 'react-native-reanimated';

import { useAppState } from '@/lib/store';

export function useReduceMotion(): boolean {
  const system = useReducedMotion();
  const setting = useAppState((s) => s.settings.reduceMotion);
  return system || setting;
}
