/** Settings card for the app lock: turn on with a PIN, fingerprint/face unlock, when to lock. */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, View } from 'react-native';

import { PinPad } from '@/components/lock-screen';
import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Backdrop, Card, Choice, Divider, tap } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { biometricAvailable, checkPin, disableLock, LOCK_AFTER, LockAfter, setBiometric, setLockAfter, setPin, useLock } from '@/lib/app-lock';

type Flow = null | 'set' | 'change' | 'off';

export function AppLockCard() {
  const t = useTheme();
  const lock = useLock();
  const [flow, setFlow] = useState<Flow>(null);
  const [hasBio, setHasBio] = useState(false);

  useEffect(() => {
    biometricAvailable().then(setHasBio);
  }, []);

  return (
    <Card>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: lock.enabled ? t.brand : t.surfaceAlt }]}>
          <Icon name="lock" color={lock.enabled ? t.brandText : t.textSecondary} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">App lock</Text>
          <Text variant="small">{lock.enabled ? 'On · a PIN is needed to open Daybloom' : 'Keep your moods and notes private with a PIN'}</Text>
        </View>
        <Switch
          value={lock.enabled}
          onValueChange={(on) => (tap(), setFlow(on ? 'set' : 'off'))}
          trackColor={{ true: t.brand, false: t.line }}
          thumbColor="#fff"
          accessibilityLabel="App lock"
        />
      </View>

      {lock.enabled && (
        <>
          <Divider />
          {hasBio && (
            <View style={styles.head}>
              <Icon name="fingerprint" color={t.brand} size={22} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Fingerprint or face</Text>
                <Text variant="small">Unlock without typing the PIN</Text>
              </View>
              <Switch value={lock.biometric} onValueChange={(v) => (tap(), setBiometric(v))} trackColor={{ true: t.brand, false: t.line }} thumbColor="#fff" accessibilityLabel="Fingerprint or face unlock" />
            </View>
          )}
          <Text variant="bodyStrong">Lock again</Text>
          <Choice options={LOCK_AFTER} value={lock.after} onChange={(v) => setLockAfter(v as LockAfter)} />
          <Text variant="small">After you leave the app for this long. Home-screen widgets stay visible.</Text>
          <Pressable onPress={() => (tap(), setFlow('change'))} hitSlop={8} accessibilityRole="button">
            <Text variant="small" color="accent">
              Change PIN
            </Text>
          </Pressable>
        </>
      )}

      <PinFlow key={flow ?? 'none'} flow={flow} onClose={() => setFlow(null)} />
    </Card>
  );
}

/** Set a new PIN (enter twice), or confirm the current one before turning the lock off. */
function PinFlow({ flow, onClose }: { flow: Flow; onClose: () => void }) {
  // Remounted for each flow (see the key where it is used), so the steps start fresh.
  const [step, setStep] = useState<'current' | 'new' | 'again'>(flow === 'set' ? 'new' : 'current');
  const [first, setFirst] = useState('');
  const [note, setNote] = useState<string | undefined>();

  if (!flow) return null;

  const title =
    step === 'current' ? 'Enter your current PIN' : step === 'new' ? (flow === 'change' ? 'Choose a new PIN' : 'Choose a 4-digit PIN') : 'Enter it once more';

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modal}>
        <Backdrop />
        <PinPad
          key={step}
          title={title}
          subtitle={note ?? (step === 'new' ? 'You will need it each time you open Daybloom.' : undefined)}
          onDone={async (pin) => {
            if (step === 'current') {
              if (!(await checkPin(pin))) {
                setNote('That PIN is not right.');
                return false;
              }
              if (flow === 'off') {
                disableLock();
                onClose();
              } else {
                setNote(undefined);
                setStep('new');
              }
              return true;
            }
            if (step === 'new') {
              setFirst(pin);
              setNote(undefined);
              setStep('again');
              return true;
            }
            if (pin !== first) {
              setNote('The two PINs did not match. Choose a PIN again.');
              setStep('new');
              return false;
            }
            await setPin(pin);
            onClose();
            return true;
          }}
          footer={
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
              <Text variant="bodyStrong" color="textSecondary">
                Cancel
              </Text>
            </Pressable>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
