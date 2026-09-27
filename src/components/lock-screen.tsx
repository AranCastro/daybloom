/** Full-screen lock: PIN pad with fingerprint/face unlock. Also used to set up and confirm a PIN. */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/components/games/fx';
import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Backdrop, tap } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { disableLock, PIN_LENGTH, unlockWithBiometric, unlockWithPin, useLock, waitSeconds } from '@/lib/app-lock';
import { resetAll } from '@/lib/store';

/** A PIN pad. `onDone` gets each full PIN; return false to shake and clear. */
export function PinPad({
  title,
  subtitle,
  onDone,
  biometric,
  onBiometric,
  footer,
}: {
  title: string;
  subtitle?: string;
  onDone: (pin: string) => Promise<boolean> | boolean;
  biometric?: boolean;
  onBiometric?: () => void;
  footer?: React.ReactNode;
}) {
  const t = useTheme();
  const [pin, setPin] = useState('');
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  async function press(d: string) {
    tap();
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    if (next.length === PIN_LENGTH) {
      const ok = await onDone(next);
      if (!ok) {
        haptic.warning();
        shake.set(withSequence(withTiming(-12, { duration: 50 }), withTiming(12, { duration: 50 }), withTiming(-8, { duration: 50 }), withTiming(0, { duration: 50 })));
      }
      setTimeout(() => setPin(''), 120);
    }
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', biometric ? 'bio' : '', '0', 'del'];
  return (
    <View style={{ alignItems: 'center', gap: 22 }}>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text variant="title" center>
          {title}
        </Text>
        {!!subtitle && (
          <Text variant="small" center>
            {subtitle}
          </Text>
        )}
      </View>
      <Animated.View style={[styles.dots, shakeStyle]} accessibilityLabel={`${pin.length} of ${PIN_LENGTH} digits entered`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={[styles.dot, { borderColor: t.text, backgroundColor: i < pin.length ? t.text : 'transparent' }]} />
        ))}
      </Animated.View>
      <View style={styles.pad}>
        {keys.map((k, i) =>
          k === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={k === 'del' ? 'Delete' : k === 'bio' ? 'Use fingerprint or face' : k}
              onPress={() => (k === 'del' ? (tap(), setPin(pin.slice(0, -1))) : k === 'bio' ? onBiometric?.() : press(k))}
              style={({ pressed }) => [styles.key, { backgroundColor: k === 'del' || k === 'bio' ? 'transparent' : pressed ? t.surfaceAlt : t.surface, borderColor: t.line, borderWidth: k === 'del' || k === 'bio' ? 0 : StyleSheet.hairlineWidth }]}>
              {k === 'del' ? (
                <Icon name="back" color={t.textSecondary} size={24} />
              ) : k === 'bio' ? (
                <Icon name="fingerprint" color={t.brand} size={30} />
              ) : (
                <Text style={{ fontFamily: Fonts.display, fontSize: 28, color: t.text }}>{k}</Text>
              )}
            </Pressable>
          ),
        )}
      </View>
      {footer}
    </View>
  );
}

/** Covers the app while it is locked. */
export function LockGate() {
  const lock = useLock();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const [message, setMessage] = useState<string | undefined>();

  // Offer fingerprint straight away when the lock appears.
  useEffect(() => {
    if (lock.locked && lock.biometric) void unlockWithBiometric();
  }, [lock.locked, lock.biometric]);

  if (!lock.locked) return null;

  function forgot() {
    const title = 'Forgot your PIN?';
    const msg = 'The PIN cannot be recovered. You can erase everything in Daybloom and start again (restore a backup afterwards if you have one).';
    const erase = () => {
      disableLock();
      resetAll();
      router.replace('/onboarding');
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`${title}\n\n${msg}`)) erase();
      return;
    }
    Alert.alert(title, msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Erase and start again', style: 'destructive', onPress: erase },
    ]);
  }

  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, styles.gate, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 20 }]}>
      <Backdrop />
      <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
      <PinPad
        title="Daybloom is locked"
        subtitle={message ?? 'Enter your PIN'}
        biometric={lock.biometric}
        onBiometric={() => void unlockWithBiometric()}
        onDone={async (pin) => {
          const r = await unlockWithPin(pin);
          if (r === 'ok') return true;
          setMessage(r === 'wait' ? `Too many tries. Wait ${waitSeconds()} seconds.` : 'That PIN is not right. Try again.');
          return false;
        }}
        footer={
          <Pressable onPress={forgot} hitSlop={10} accessibilityRole="button">
            <Text variant="small" style={{ color: t.accentText, fontFamily: Fonts.bodyStrong }}>
              Forgot PIN?
            </Text>
          </Pressable>
        }
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  gate: { zIndex: 1000, elevation: 1000, alignItems: 'center', gap: 18 },
  logo: { width: 72, height: 72, borderRadius: 20 },
  dots: { flexDirection: 'row', gap: 18 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 3 * 78 + 2 * 18, gap: 18, justifyContent: 'center' },
  key: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
});
