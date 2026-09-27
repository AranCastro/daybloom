import { StyleSheet, Text as RNText, TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The type scale. Use a variant (plus `strong` for the bold cut of the smaller sizes) rather
 * than an inline fontSize, so sizes stay consistent and colours come from the theme.
 *
 *   hero 40 · title 30 · heading 21 · quote 19 · headingSm 17 · body 16 · quoteSm 16 · bodySm 14.5
 *   small 13.5 · caption 12 · micro 11 · label 11.5 caps · numeral 18 · display 52
 */
type Variant =
  | 'hero'
  | 'title'
  | 'heading'
  | 'headingSm'
  | 'body'
  | 'bodyStrong'
  | 'bodySm'
  | 'small'
  | 'caption'
  | 'micro'
  | 'label'
  | 'quote'
  | 'quoteSm'
  | 'numeral'
  | 'display';

export type AppTextProps = TextProps & { variant?: Variant; color?: ThemeColor; center?: boolean; strong?: boolean };

const SECONDARY: Variant[] = ['small', 'caption', 'micro', 'label'];

export function Text({ variant = 'body', color, center, strong, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const fallback: ThemeColor = SECONDARY.includes(variant) ? 'textSecondary' : 'text';
  return (
    <RNText
      // Accent text uses the darker, readable shade of the accent colour.
      style={[
        styles[variant],
        { color: theme[color === 'accent' ? 'accentText' : (color ?? fallback)] },
        strong && styles.strong,
        center && styles.center,
        style,
      ]}
      {...rest}
    />
  );
}

// Fraunces carries tall ascenders; Android's default font padding pushes it low and clips
// descenders on the tight display line heights, so those variants switch the padding off.
const tight = { includeFontPadding: false } as const;
// Tabular figures keep counters and clocks from shifting sideways as digits change.
const tabular = { fontVariant: ['tabular-nums' as const] };

const styles = StyleSheet.create({
  hero: { fontFamily: Fonts.display, fontSize: 40, lineHeight: 46, letterSpacing: -0.8, ...tight },
  title: { fontFamily: Fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.5, ...tight },
  heading: { fontFamily: Fonts.display, fontSize: 21, lineHeight: 27, letterSpacing: -0.2, ...tight },
  headingSm: { fontFamily: Fonts.display, fontSize: 17, lineHeight: 21, letterSpacing: -0.2, ...tight },
  body: { fontFamily: Fonts.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: Fonts.bodyStrong, fontSize: 16, lineHeight: 24 },
  bodySm: { fontFamily: Fonts.body, fontSize: 14.5, lineHeight: 20 },
  small: { fontFamily: Fonts.body, fontSize: 13.5, lineHeight: 19 },
  caption: { fontFamily: Fonts.body, fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: Fonts.body, fontSize: 11, lineHeight: 14 },
  label: { fontFamily: Fonts.bodyStrong, fontSize: 11.5, lineHeight: 16, letterSpacing: 1.4, textTransform: 'uppercase' },
  quote: { fontFamily: Fonts.displayItalic, fontSize: 19, lineHeight: 27, ...tight },
  quoteSm: { fontFamily: Fonts.displayItalic, fontSize: 16, lineHeight: 22, ...tight },
  numeral: { fontFamily: Fonts.bodyStrong, fontSize: 18, lineHeight: 22, ...tight, ...tabular },
  display: { fontFamily: Fonts.display, fontSize: 52, lineHeight: 58, letterSpacing: -1, ...tight, ...tabular },
  strong: { fontFamily: Fonts.bodyStrong },
  center: { textAlign: 'center' },
});
