import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect } from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  ScrollView,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bud } from '@/components/flower';
import { Icon, IconName } from '@/components/icons';
import { Text } from '@/components/text';
import { Fonts, MaxContentWidth, Radius, Shadow, Spacing } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { hapticsOn } from '@/lib/store';

export function tap(style: 'light' | 'medium' = 'light') {
  if (!hapticsOn()) return;
  Haptics.impactAsync(style === 'light' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
}

/** Soft two-colour glow behind every screen. */
export function Backdrop() {
  const t = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: t.background }]} />
      <LinearGradient
        colors={[t.glowA, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 0.55 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['transparent', t.glowB]}
        start={{ x: 0.2, y: 0.5 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

type ScreenProps = { children: ReactNode; scroll?: boolean; bottomInset?: number; contentStyle?: ViewStyle };

export function Screen({ children, scroll = true, bottomInset = Spacing.five, contentStyle }: ScreenProps) {
  const inner = <View style={[styles.column, contentStyle]}>{children}</View>;
  return (
    <View style={styles.fill}>
      <Backdrop />
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={{ paddingBottom: bottomInset, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}>
            {inner}
          </ScrollView>
        ) : (
          <View style={[styles.fill, { paddingBottom: bottomInset }]}>{inner}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

const PRESS_IN = { damping: 20, stiffness: 420 } as const;
const PRESS_OUT = { damping: 15, stiffness: 320 } as const;

type TappableProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  /** The pressable surface: padding, background, border, row layout. */
  style?: StyleProp<ViewStyle>;
  /** The outer box: flex, margins, width and shadow. It scales with the press. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Corner radius, for the ripple and the clip. Match the surface it sits on. */
  radius?: number;
  /** A light tap on press (on by default; it follows the Vibration setting). */
  haptic?: boolean;
};

/**
 * The one press feedback for anything card-like: a small spring to 0.985, a light haptic tap and,
 * on Android, a ripple clipped to the rounded corners. Under Reduce motion the scale is skipped
 * (Reanimated follows the ReducedMotionConfig) and the ripple and haptic remain.
 */
export function Tappable({
  children,
  style,
  containerStyle,
  radius = Radius.lg,
  haptic = true,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: TappableProps) {
  const dark = useIsDark();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[{ borderRadius: radius }, containerStyle, anim]}>
      <Pressable
        accessibilityRole="button"
        {...rest}
        android_ripple={{ color: dark ? 'rgba(255,255,255,0.08)' : 'rgba(29,27,24,0.06)', foreground: true }}
        onPressIn={(e: GestureResponderEvent) => {
          scale.set(withSpring(0.985, PRESS_IN));
          onPressIn?.(e);
        }}
        onPressOut={(e: GestureResponderEvent) => {
          scale.set(withSpring(1, PRESS_OUT));
          onPressOut?.(e);
        }}
        onPress={
          onPress
            ? (e: GestureResponderEvent) => {
                if (haptic) tap();
                onPress(e);
              }
            : undefined
        }
        style={[{ borderRadius: radius, overflow: 'hidden', flexGrow: 1 }, style]}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

type CardTone = 'surface' | 'accent' | 'raised';

/**
 * The basic surface. `raised` lifts the moments that matter (the mood hero, the focus reward,
 * the badge hero) with a deeper shadow and, in dark mode, a faint highlight along the top edge.
 * With `onPress` the whole card becomes a Tappable.
 */
export function Card({
  children,
  style,
  tone = 'surface',
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: CardTone;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const t = useTheme();
  const dark = useIsDark();
  const bg = tone === 'accent' ? t.accentSoft : tone === 'raised' ? t.raised : t.surface;
  const surface: ViewStyle = {
    backgroundColor: bg,
    borderColor: tone === 'accent' ? 'transparent' : t.line,
    ...(tone === 'raised' && dark ? { borderTopColor: 'rgba(255,255,255,0.1)' } : null),
  };
  // Shadows barely register on a dark background; there the highlight does the lifting.
  const shadow = dark ? null : tone === 'raised' ? Shadow.md : tone === 'surface' ? Shadow.sm : null;
  const sheen =
    tone === 'raised' && dark ? (
      <LinearGradient colors={[t.highlight, 'transparent']} style={styles.sheen} pointerEvents="none" />
    ) : null;

  if (onPress) {
    return (
      <Tappable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        radius={Radius.lg}
        // The shadow sits on the outer box with an opaque fill, so Android elevation draws cleanly.
        containerStyle={[shadow, { backgroundColor: bg }]}
        style={[styles.card, surface, style]}>
        {sheen}
        {children}
      </Tappable>
    );
  }
  return (
    <View style={[styles.card, surface, shadow, style]}>
      {sheen}
      {children}
    </View>
  );
}

/** A soft pulsing placeholder while something loads (the weather chip). Still under Reduce motion. */
export function Skeleton({ width, height, radius = Radius.pill, style }: { width: number; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    o.set(withRepeat(withSequence(withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 700 })), -1));
    return () => cancelAnimation(o);
  }, [reduce, o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: t.skeleton }, style, anim]} />;
}

/** Empty states: a small bud, one line and one action. */
export function EmptyState({ line, action, onAction, size = 64 }: { line: string; action?: string; onAction?: () => void; size?: number }) {
  return (
    <View style={styles.empty}>
      <Bud size={size} grow={0.55} />
      <Text variant="small" center>
        {line}
      </Text>
      {action && onAction ? (
        <Pressable onPress={() => (tap(), onAction())} accessibilityRole="button" hitSlop={8} style={styles.emptyAction}>
          <Text variant="small" strong color="accent">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'quiet';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, kind = 'primary', icon, loading, disabled, style }: ButtonProps) {
  const t = useTheme();
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const bg = kind === 'primary' ? t.brand : kind === 'secondary' ? t.surface : 'transparent';
  const fg = kind === 'primary' ? t.brandText : t.text;
  return (
    <Animated.View style={[anim, style]}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled || loading}
        onPressIn={() => scale.set(withSpring(0.97, { damping: 18, stiffness: 400 }))}
        onPressOut={() => scale.set(withSpring(1, { damping: 14, stiffness: 300 }))}
        onPress={() => {
          tap();
          onPress();
        }}
        style={[
          styles.button,
          { backgroundColor: bg, opacity: disabled ? 0.45 : 1 },
          kind === 'secondary' && { borderWidth: 1, borderColor: t.line },
        ]}>
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <>
            {icon && <Icon name={icon} color={fg} size={19} />}
            <Text variant="bodyStrong" style={{ color: fg }}>
              {title}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Row used in settings-style lists. */
export function Row({
  icon,
  title,
  detail,
  onPress,
  right,
}: {
  icon: IconName;
  title: string;
  detail?: string;
  onPress?: () => void;
  right?: ReactNode;
}) {
  const t = useTheme();
  const body = (
    <>
      <View style={[styles.rowIcon, { backgroundColor: t.surfaceAlt }]}>
        <Icon name={icon} color={t.text} size={19} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        {detail ? <Text variant="small">{detail}</Text> : null}
      </View>
      {right}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Tappable onPress={onPress} radius={Radius.sm} accessibilityLabel={detail ? `${title}. ${detail}` : title} style={styles.row}>
      {body}
    </Tappable>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.line, marginVertical: Spacing.one }} />;
}

export function Input(props: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.textMuted}
      {...props}
      style={[styles.input, { backgroundColor: t.surface, borderColor: t.line, color: t.text }, props.style]}
    />
  );
}

/** Segmented chooser used for small option sets. */
export function Choice<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={[styles.choice, { backgroundColor: t.surfaceAlt }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: on }}
            aria-checked={on}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={[styles.choiceItem, on && { backgroundColor: t.surface, borderColor: t.line }]}>
            <Text variant="bodySm" strong={on} color={on ? 'text' : 'textSecondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.three,
    gap: Spacing.three,
    flexGrow: 1,
  },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.card, gap: Spacing.two },
  sheen: { position: 'absolute', left: 0, right: 0, top: 0, height: 48, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg },
  empty: { alignItems: 'center', gap: 6, paddingVertical: Spacing.two },
  emptyAction: { paddingVertical: 4, paddingHorizontal: 10 },
  button: {
    minHeight: 56,
    borderRadius: Radius.pill,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  rowIcon: { width: 40, height: 40, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  input: {
    minHeight: 56,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: 18,
    fontFamily: Fonts.body,
    fontSize: 17,
  },
  choice: { flexDirection: 'row', borderRadius: Radius.pill, padding: 4, gap: 4 },
  choiceItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
