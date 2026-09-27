/**
 * Nudge design tokens.
 * Warm paper neutrals, a deep forest brand colour and an apricot accent.
 * Mood colours avoid red so that a low day never reads as "failure".
 */
import { Platform, ViewStyle } from 'react-native';

export const Colors = {
  light: {
    background: '#F6F2EC',
    surface: '#FFFFFF',
    surfaceAlt: '#EFE8DF',
    text: '#1D1B18',
    textSecondary: '#6B655C',
    // Contrast-checked against WCAG 2.2 AA (4.5:1) on the background and on white cards.
    textMuted: '#736D66',
    line: '#E6DED3',
    brand: '#2F4A3F',
    brandText: '#FFFFFF',
    accent: '#E07A4F',
    /** Accent used for text and links: darker than the fill colour so it stays readable. */
    accentText: '#A94E2B',
    accentSoft: '#F8E3D8',
    glowA: '#F3D9C4',
    glowB: '#DCE8DF',
    tabBar: 'rgba(255,255,255,0.92)',
    /** Opaque tab bar, for Android: elevation behind a translucent fill shows through it. */
    tabBarSolid: '#FFFFFF',
    /** Raised cards (mood hero, focus reward, badge hero). */
    raised: '#FFFFFF',
    /** Top edge of a raised card: a light catching the rim. Invisible on light paper. */
    highlight: 'rgba(255,255,255,0)',
    // Status colours: shared by energy tints, rarity, task states and tags.
    success: '#3A9477',
    successSoft: '#DDEFE7',
    warning: '#D08A2E',
    /** Warning as text: darker, so it passes 4.5:1 on paper and white. */
    warningText: '#B57A12',
    danger: '#C9503B',
    rare: '#7E6FD0',
    legendary: '#C98A1E',
    tagWarm: '#E0A23A',
    tagWarmSoft: '#FBE9C8',
    tagCool: '#7E8FD0',
    tagCoolSoft: '#E1E6F8',
    /** Text on a filled status colour (rarity pill, count badge). */
    onStatus: '#FFFFFF',
    skeleton: 'rgba(29,27,24,0.08)',
  },
  dark: {
    background: '#12110F',
    surface: '#1C1A17',
    surfaceAlt: '#26231F',
    text: '#F3EEE7',
    textSecondary: '#AAA196',
    textMuted: '#88827A',
    line: '#2F2B26',
    brand: '#A8D0BC',
    brandText: '#10201A',
    accent: '#F0936B',
    accentText: '#F0936B',
    accentSoft: '#3A2A22',
    // Stronger than the light glows: on #12110F a subtle tint disappears entirely.
    glowA: '#4A3121',
    glowB: '#1C3A2E',
    tabBar: 'rgba(32,30,27,0.94)',
    tabBarSolid: '#201E1B',
    raised: '#221F1B',
    highlight: 'rgba(255,255,255,0.06)',
    success: '#6CC4A6',
    successSoft: '#1D3A30',
    warning: '#E8A956',
    warningText: '#EDB65A',
    danger: '#F08A74',
    rare: '#A99CF0',
    legendary: '#E6B652',
    tagWarm: '#E6B25A',
    tagWarmSoft: '#3A2E1A',
    tagCool: '#9DA9E6',
    tagCoolSoft: '#232A42',
    onStatus: '#12110F',
    skeleton: 'rgba(255,255,255,0.08)',
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
  /** Side gutter of every screen. */
  screen: 22,
  /** Inner padding of a Card. */
  card: 20,
  /** Inner padding of small cards, rows and tiles. */
  cardCompact: 14,
} as const;

/**
 * Corner radii. Nest them concentrically: an inner shape's radius is the outer radius minus
 * the padding between them (a Card at lg with 14 px padding holds tiles at sm).
 */
export const Radius = { xs: 8, sm: 12, md: 18, lg: 26, xl: 32, pill: 999 } as const;

/**
 * Elevation. iOS draws a soft shadow; Android uses elevation, which needs an opaque background
 * on the same view (a translucent fill lets the shadow show through). Web uses box-shadow.
 */
export const Shadow = {
  none: {},
  sm: Platform.select<ViewStyle>({
    ios: { shadowColor: '#2A2118', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
    android: { elevation: 1.5 },
    default: { boxShadow: '0 3px 10px rgba(42,33,24,0.06)' },
  }),
  md: Platform.select<ViewStyle>({
    ios: { shadowColor: '#2A2118', shadowOpacity: 0.1, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
    android: { elevation: 6 },
    default: { boxShadow: '0 10px 28px rgba(42,33,24,0.10)' },
  }),
} as const;

export const MaxContentWidth = 520;
export const TabBarHeight = 64;
export const TabBarInset = TabBarHeight + (Platform.OS === 'ios' ? 34 : 24);
