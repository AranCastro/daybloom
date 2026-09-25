/**
 * Nudge design tokens.
 * Warm paper neutrals, a deep forest brand colour and an apricot accent.
 * Mood colours avoid red so that a low day never reads as "failure".
 */
import { Platform } from 'react-native';

export const Colors = {
  light: {
    background: '#F6F2EC',
    surface: '#FFFFFF',
    surfaceAlt: '#EFE8DF',
    text: '#1D1B18',
    textSecondary: '#6B655C',
    textMuted: '#9A9288',
    line: '#E6DED3',
    brand: '#2F4A3F',
    brandText: '#FFFFFF',
    accent: '#E07A4F',
    accentSoft: '#F8E3D8',
    glowA: '#F3D9C4',
    glowB: '#DCE8DF',
    tabBar: 'rgba(255,255,255,0.92)',
  },
  dark: {
    background: '#12110F',
    surface: '#1C1A17',
    surfaceAlt: '#26231F',
    text: '#F3EEE7',
    textSecondary: '#AAA196',
    textMuted: '#766F66',
    line: '#2F2B26',
    brand: '#A8D0BC',
    brandText: '#10201A',
    accent: '#F0936B',
    accentSoft: '#3A2A22',
    glowA: '#3A2A20',
    glowB: '#1D2E27',
    tabBar: 'rgba(32,30,27,0.94)',
  },
} as const;

export type Palette = { [K in keyof typeof Colors.light]: string };
export type ThemeColor = keyof Palette;

export const Fonts = {
  display: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_400Regular_Italic',
  body: 'Manrope_500Medium',
  bodyStrong: 'Manrope_700Bold',
  bodyLight: 'Manrope_400Regular',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { sm: 12, md: 18, lg: 26, pill: 999 } as const;

export const MaxContentWidth = 520;
export const TabBarHeight = 64;
export const TabBarInset = TabBarHeight + (Platform.OS === 'ios' ? 34 : 24);
