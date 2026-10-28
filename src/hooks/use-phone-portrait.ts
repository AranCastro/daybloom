/**
 * Phones stay upright; tablets, foldables opened out and Chromebooks turn freely. The manifest has
 * no orientation lock (Android 16 ignores one on large screens, and Play flags it), so the lock is
 * set here at run time from the screen's shorter side: under 600 dp is a phone.
 */
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

export const LARGE_SCREEN_DP = 600;

export function usePhonePortrait(): void {
  const { width, height } = useWindowDimensions();
  const phone = Math.min(width, height) < LARGE_SCREEN_DP;
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const change = phone ? ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP) : ScreenOrientation.unlockAsync();
    change.catch(() => {
      // Not supported on this device: it simply follows the sensor.
    });
  }, [phone]);
}
