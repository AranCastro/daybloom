/**
 * The living backdrop of the garden: sky by time of day, the season's grass, and (with Live
 * weather on) clouds, rain, fog or a storm as it is outside. Rain falls only while the screen
 * is on show, and not at all with Reduce motion.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Icon, IconName } from '@/components/icons';
import { Text } from '@/components/text';
import { Skeleton } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useClock } from '@/hooks/use-today';
import { setSettings, useAppState } from '@/lib/store';
import { enableLiveWeather, Phase, phaseOf, refreshWeather, Season, seasonOf, Sky, useWeather } from '@/lib/weather';

type Scene = { phase: Phase; season: Season; sky: Sky; temp?: number; live: boolean; at?: number; waiting: boolean };

/** What the garden should look like right now. */
export function useScene(): Scene {
  const { hour, today } = useClock();
  const live = useAppState((s) => s.settings.liveWeather);
  const w = useWeather(live);
  // While the garden is on screen, keep the weather in step with where the phone is.
  const focused = useIsFocused();
  useEffect(() => {
    if (!live || !focused) return;
    void refreshWeather(false);
    const id = setInterval(() => void refreshWeather(false), 10 * 60_000);
    return () => clearInterval(id);
  }, [live, focused]);
  const month = Number(today.slice(5, 7)) - 1;
  const season = seasonOf(month);
  // Without live weather, the monsoon still brings a soft grey sky on some afternoons.
  const day = Number(today.slice(8, 10));
  const sky: Sky = w ? w.sky : season === 'monsoon' && hour >= 14 && hour < 19 && day % 3 === 0 ? 'drizzle' : 'clear';
  // Live readings also know whether the sun is up there, which beats the clock near dawn and dusk.
  const clock = phaseOf(hour);
  const phase: Phase = w && !w.isDay && (clock === 'day' || clock === 'dawn') ? 'night' : w && w.isDay && clock === 'night' ? 'dawn' : clock;
  // Live weather is on but no reading has arrived yet: the chip shows a placeholder.
  return { phase, season, sky, temp: w?.temp, live: !!w, at: w?.at, waiting: live && !w };
}

const SKY: Record<Phase, [string, string]> = {
  dawn: ['#F6C3A3', '#FBE9CC'],
  day: ['#BFE2F4', '#EEF6EA'],
  dusk: ['#EFA27F', '#8F7DB8'],
  night: ['#101730', '#2A3155'],
};
const OVERCAST: Record<Phase, [string, string]> = {
  dawn: ['#C9B7AE', '#E4DCD2'],
  day: ['#AEBFCA', '#DDE4E6'],
  dusk: ['#A78D8E', '#6F6788'],
  night: ['#161B28', '#2A3040'],
};
const GRASS: Record<Season, { hillA: string; hillB: string; grass: [string, string] }> = {
  monsoon: { hillA: '#9CD08A', hillB: '#84C274', grass: ['#79C267', '#4B9847'] },
  summer: { hillA: '#D7DFA6', hillB: '#C5D38F', grass: ['#BFD287', '#98B465'] },
  autumn: { hillA: '#C6DDA9', hillB: '#B3D197', grass: ['#A5CF8F', '#7EB470'] },
  winter: { hillA: '#CFE3C3', hillB: '#BFD9B0', grass: ['#A9D39A', '#7FB872'] },
};

const SEASON_LABEL: Record<Season, string> = { summer: 'Summer', monsoon: 'Monsoon', autumn: 'After the rains', winter: 'Winter' };
const SKY_LABEL: Record<Sky, { label: string; icon: IconName }> = {
  clear: { label: 'Clear', icon: 'sun' },
  cloudy: { label: 'Cloudy', icon: 'rain' },
  fog: { label: 'Mist', icon: 'wind' },
  drizzle: { label: 'Drizzle', icon: 'rain' },
  rain: { label: 'Rain', icon: 'rain' },
  storm: { label: 'Thunderstorm', icon: 'storm' },
};

/** Sky, sun or moon, clouds and hills. Flowers are drawn on top by GardenBed. */
export function GardenSky({ height }: { height: number }) {
  const scene = useScene();
  const { phase, season, sky } = scene;
  const overcast = sky !== 'clear';
  const night = phase === 'night';
  const g = GRASS[season];
  const shade = night ? 0.45 : phase === 'dusk' ? 0.18 : 0;
  const clouds = sky === 'clear' ? (season === 'monsoon' ? 1 : 0) : sky === 'cloudy' || sky === 'fog' ? 3 : 4;
  const wet = season === 'monsoon' || sky === 'rain' || sky === 'storm';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={overcast ? OVERCAST[phase] : SKY[phase]} style={StyleSheet.absoluteFill} />
      {night && !overcast && <Stars height={height} />}
      {!overcast || sky === 'cloudy' ? (
        night ? (
          <View style={[styles.moon, { top: height * 0.1 }]}>
            <View style={[styles.moonBite, { backgroundColor: (overcast ? OVERCAST : SKY).night[0] }]} />
          </View>
        ) : (
          // The glow is drawn as soft rings rather than a shadow, which Android does not draw.
          <View style={[styles.sunBox, { top: (phase === 'day' ? height * 0.08 : height * 0.3) - 14, opacity: sky === 'cloudy' ? 0.6 : 1 }]}>
            <View style={[styles.sunGlow, { width: 66, height: 66, opacity: 0.18, backgroundColor: phase === 'day' ? '#FFD66B' : '#FFB36B' }]} />
            <View style={[styles.sunGlow, { width: 52, height: 52, opacity: 0.3, backgroundColor: phase === 'day' ? '#FFD66B' : '#FFB36B' }]} />
            <View style={[styles.sun, { backgroundColor: phase === 'day' ? '#FFD66B' : '#FFB36B' }]} />
          </View>
        )
      ) : null}
      {Array.from({ length: clouds }, (_, i) => (
        <Cloud key={i} i={i} height={height} dark={sky === 'storm' || night} />
      ))}
      <View style={[styles.hill, { backgroundColor: g.hillA, left: -40, width: '70%' }]} />
      <View style={[styles.hill, { backgroundColor: g.hillB, right: -50, width: '75%', height: height * 0.62 }]} />
      <LinearGradient colors={g.grass} style={[styles.grass, { height: height * 0.5 }]} />
      {wet && (
        <>
          <View style={[styles.puddle, { left: '12%', bottom: 10, width: 70 }]} />
          <View style={[styles.puddle, { right: '14%', bottom: 18, width: 50 }]} />
        </>
      )}
      {sky === 'fog' && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.35)' }]} />}
      {shade > 0 && <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(12,16,40,${shade})` }]} />}
      {(sky === 'rain' || sky === 'drizzle' || sky === 'storm') && <Rain height={height} heavy={sky !== 'drizzle'} />}
      {sky === 'storm' && <Lightning />}
      <SceneChip scene={scene} />
    </View>
  );
}

function SceneChip({ scene }: { scene: Scene }) {
  const sky = SKY_LABEL[scene.sky];
  const label = scene.live ? `Live · ${sky.label}${scene.temp !== undefined ? ` · ${scene.temp}°` : ''}` : SEASON_LABEL[scene.season];
  const night = scene.phase === 'night';
  // A placeholder while the first reading loads; after a few seconds without one (location
  // off, no network) the chip falls back to the season.
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!scene.waiting) return;
    const id = setTimeout(() => setGaveUp(true), 8000);
    return () => clearTimeout(id);
  }, [scene.waiting]);
  if (scene.waiting && !gaveUp) {
    return (
      <View style={[styles.chip, { backgroundColor: night ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.6)' }]} accessibilityLabel="Loading the weather">
        <Skeleton width={96} height={12} style={{ backgroundColor: night ? 'rgba(255,255,255,0.3)' : 'rgba(47,74,63,0.18)', marginVertical: 1 }} />
      </View>
    );
  }
  return (
    <View style={[styles.chip, { backgroundColor: night ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.6)' }]}>
      <Icon name={scene.live ? sky.icon : scene.season === 'monsoon' ? 'rain' : 'leaf'} color={night ? '#F3EEE7' : '#2F4A3F'} size={13} />
      <Text variant="micro" strong style={{ color: night ? '#F3EEE7' : '#2F4A3F' }}>
        {label}
      </Text>
    </View>
  );
}

function Stars({ height }: { height: number }) {
  const spots = [
    [8, 10], [22, 6], [35, 16], [48, 8], [63, 14], [77, 5], [90, 12], [15, 24], [55, 22], [83, 26],
  ];
  return (
    <>
      {spots.map(([x, y], i) => (
        <View key={i} style={{ position: 'absolute', left: `${x}%`, top: (y / 100) * height * 1.4, width: i % 3 ? 2 : 3, height: i % 3 ? 2 : 3, borderRadius: 2, backgroundColor: '#FFF6D8' }} />
      ))}
    </>
  );
}

function Cloud({ i, height, dark }: { i: number; height: number; dark: boolean }) {
  const left = [8, 46, 70, 26][i % 4];
  const top = [0.08, 0.14, 0.05, 0.22][i % 4] * height;
  const c = dark ? '#6B7285' : '#FFFFFF';
  return (
    <View style={{ position: 'absolute', left: `${left}%`, top, opacity: dark ? 0.8 : 0.9 }}>
      <View style={{ width: 70, height: 22, borderRadius: 11, backgroundColor: c }} />
      <View style={{ position: 'absolute', left: 14, top: -12, width: 30, height: 30, borderRadius: 15, backgroundColor: c }} />
      <View style={{ position: 'absolute', left: 34, top: -8, width: 24, height: 24, borderRadius: 12, backgroundColor: c }} />
    </View>
  );
}

function Drop({ x, delay, height, heavy }: { x: number; delay: number; height: number; heavy: boolean }) {
  const y = useSharedValue(-20);
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    y.set(withDelay(delay, withRepeat(withTiming(height + 20, { duration: heavy ? 700 : 1100, easing: Easing.linear }), -1, false)));
    return () => cancelAnimation(y);
  }, [focused, delay, height, heavy, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }, { rotate: '12deg' }] }));
  return <Animated.View style={[{ position: 'absolute', left: `${x}%`, top: 0, width: 1.6, height: heavy ? 14 : 9, borderRadius: 1, backgroundColor: 'rgba(210,228,245,0.85)' }, style]} />;
}

function Rain({ height, heavy }: { height: number; heavy: boolean }) {
  const n = heavy ? 18 : 10;
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <Drop key={i} x={(i * 97) % 100} delay={(i * 173) % 900} height={height} heavy={heavy} />
      ))}
    </>
  );
}

function Lightning() {
  const o = useSharedValue(0);
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    o.set(withRepeat(withSequence(withDelay(5200, withTiming(0.55, { duration: 60 })), withTiming(0, { duration: 180 }), withTiming(0.35, { duration: 50 }), withTiming(0, { duration: 260 })), -1));
    return () => cancelAnimation(o);
  }, [focused, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }, style]} />;
}

const styles = StyleSheet.create({
  hill: { position: 'absolute', bottom: '32%', height: '55%', borderTopLeftRadius: 999, borderTopRightRadius: 999 },
  grass: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sunBox: { position: 'absolute', right: '12%', width: 66, height: 66, marginRight: -14, alignItems: 'center', justifyContent: 'center' },
  sunGlow: { position: 'absolute', borderRadius: 999 },
  sun: { width: 38, height: 38, borderRadius: 19 },
  moon: { position: 'absolute', right: '14%', width: 30, height: 30, borderRadius: 15, backgroundColor: '#F4EFD8', overflow: 'hidden' },
  moonBite: { position: 'absolute', left: 9, top: -5, width: 30, height: 30, borderRadius: 15 },
  puddle: { position: 'absolute', height: 10, borderRadius: 999, backgroundColor: 'rgba(190,220,240,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: Radius.md, borderWidth: 1 },
  chip: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
});

/** Under the garden, while live weather is off: one tap to match the garden to the real sky. */
export function LiveWeatherPrompt() {
  const t = useTheme();
  const live = useAppState((s) => s.settings.liveWeather);
  const [note, setNote] = useState<string | undefined>();
  if (live) return null;
  return (
    <Pressable
      onPress={async () => {
        const ok = await enableLiveWeather((liveWeather) => setSettings({ liveWeather }));
        setNote(ok ? undefined : 'Location is off or not allowed. You can turn it on later in Settings.');
      }}
      accessibilityRole="button"
      style={[styles.prompt, { backgroundColor: t.tagCoolSoft, borderColor: t.line }]}>
      <Icon name="rain" color={t.brand} size={20} />
      <View style={{ flex: 1 }}>
        <Text variant="bodySm" strong>
          Match the garden to your weather
        </Text>
        <Text variant="caption">{note ?? 'Rain, sun or stars as they are where you are. Uses your approximate location.'}</Text>
      </View>
      <Text variant="small" strong color="accent">
        Turn on
      </Text>
    </Pressable>
  );
}
