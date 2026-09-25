import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, IconName } from '@/components/icons';
import { Text } from '@/components/text';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function tap(style: 'light' | 'medium' = 'light') {
  if (Platform.OS === 'web') return;
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

export function Card({ children, style, tone = 'surface' }: { children: ReactNode; style?: ViewStyle; tone?: 'surface' | 'accent' }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tone === 'accent' ? t.accentSoft : t.surface,
          borderColor: tone === 'accent' ? 'transparent' : t.line,
        },
        style,
      ]}>
      {children}
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
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <View style={[styles.rowIcon, { backgroundColor: t.surfaceAlt }]}>
        <Icon name={icon} color={t.text} size={19} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        {detail ? <Text variant="small">{detail}</Text> : null}
      </View>
      {right}
    </Pressable>
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
    <View style={[styles.choice, { backgroundColor: t.surfaceAlt }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={[styles.choiceItem, on && { backgroundColor: t.surface, borderColor: t.line }]}>
            <Text variant={on ? 'bodyStrong' : 'body'} color={on ? 'text' : 'textSecondary'} style={{ fontSize: 14 }}>
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
    paddingHorizontal: 22,
    paddingTop: Spacing.three,
    gap: Spacing.three,
    flexGrow: 1,
  },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: 20, gap: Spacing.two },
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
  rowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
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
