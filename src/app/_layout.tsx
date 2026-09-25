import { Fraunces_400Regular_Italic, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Manrope_400Regular, Manrope_500Medium, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState as RNAppState } from 'react-native';

import { BloomToast } from '@/components/garden';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { flushQueued, refreshBuddyJoined } from '@/lib/store';
import { startWidgetSync } from '@/widgets/sync';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const t = useTheme();
  const dark = useIsDark();
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_400Regular_Italic,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // Each time the app comes to the foreground: retry undelivered nudges and check whether the buddy joined.
  useEffect(() => {
    const sync = () => {
      flushQueued();
      refreshBuddyJoined();
    };
    sync();
    const sub = RNAppState.addEventListener('change', (s) => s === 'active' && sync());
    return () => sub.remove();
  }, []);

  // Home-screen widgets redraw whenever something changes in the app (Android).
  useEffect(() => startWidgetSync(), []);

  if (!loaded && !error) return null;

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background }, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="quadrant/[q]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="focus" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="badges" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="widgets" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="game/[id]" options={{ animation: 'fade_from_bottom', gestureEnabled: false }} />
      </Stack>
      <BloomToast />
    </>
  );
}
