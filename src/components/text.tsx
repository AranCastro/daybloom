import { StyleSheet, Text as RNText, TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'hero' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'small' | 'label' | 'quote';

export type AppTextProps = TextProps & { variant?: Variant; color?: ThemeColor; center?: boolean };

export function Text({ variant = 'body', color, center, style, ...rest }: AppTextProps) {
  const theme = useTheme();
  const fallback: ThemeColor = variant === 'small' || variant === 'label' ? 'textSecondary' : 'text';
  return (
    <RNText
      style={[styles[variant], { color: theme[color ?? fallback] }, center && styles.center, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  hero: { fontFamily: Fonts.display, fontSize: 40, lineHeight: 46, letterSpacing: -0.8 },
  title: { fontFamily: Fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
  heading: { fontFamily: Fonts.display, fontSize: 21, lineHeight: 27, letterSpacing: -0.2 },
  body: { fontFamily: Fonts.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: Fonts.bodyStrong, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: Fonts.body, fontSize: 13.5, lineHeight: 19 },
  label: { fontFamily: Fonts.bodyStrong, fontSize: 11.5, lineHeight: 16, letterSpacing: 1.4, textTransform: 'uppercase' },
  quote: { fontFamily: Fonts.displayItalic, fontSize: 19, lineHeight: 27 },
  center: { textAlign: 'center' },
});
