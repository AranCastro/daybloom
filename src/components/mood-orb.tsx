import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { useAppActive } from '@/hooks/use-app-active';
import { Mood } from '@/lib/moods';

/** Mouth curve per mood: positive bends up (smile), negative bends down. */
const CURVE: Record<number, number> = { 5: 7, 4: 4.5, 3: 0.5, 2: -3, 1: -5 };

type Props = { mood: Mood; size: number; breathe?: boolean; face?: boolean };

export function MoodOrb({ mood, size, breathe = false, face = true }: Props) {
  const s = useSharedValue(1);

  // Breathe only while this screen is on show and the app is open. Tabs stay mounted, so an
  // endless animation would otherwise keep the phone redrawing (and warm) on every other screen.
  const focused = useIsFocused();
  const appActive = useAppActive();
  const reduceMotion = useReducedMotion();
  const run = breathe && focused && appActive && !reduceMotion;

  useEffect(() => {
    if (!run) {
      cancelAnimation(s);
      s.set(1);
      return;
    }
    s.set(withRepeat(
      withSequence(
        withTiming(1.045, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    ));
    return () => cancelAnimation(s);
  }, [run, s]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const c = CURVE[mood.value];
  const ink = 'rgba(30,24,20,0.72)';

  return (
    <Animated.View style={[{ width: size, height: size }, anim]}>
      {breathe && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.halo,
            { borderRadius: size, backgroundColor: mood.colors[0], transform: [{ scale: 1.18 }] },
          ]}
        />
      )}
      <LinearGradient
        colors={mood.colors}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.85, y: 0.95 }}
        style={[StyleSheet.absoluteFill, { borderRadius: size }]}
      />
      {/* specular highlight */}
      <LinearGradient
        colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={[styles.shine, { width: size * 0.62, height: size * 0.42, borderRadius: size, left: size * 0.16, top: size * 0.08 }]}
      />
      {face && (
        <Svg width={size} height={size} viewBox="0 0 48 48" style={StyleSheet.absoluteFill}>
          <Circle cx={18.5} cy={21} r={1.9} fill={ink} />
          <Circle cx={29.5} cy={21} r={1.9} fill={ink} />
          <Path
            d={`M17 ${29 - c / 2} Q24 ${29 + c} 31 ${29 - c / 2}`}
            stroke={ink}
            strokeWidth={2.1}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  halo: { opacity: 0.22 },
  shine: { position: 'absolute' },
});
