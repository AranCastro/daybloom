/**
 * Shown in Settings → Sync between phones when the copy in Drive is protected by the app lock and
 * this phone has not synced with the account before: the Daybloom PIN set on the other phone is
 * needed before the data comes down (lib/device-sync).
 */
import { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/text';
import { Button, Input, tap } from '@/components/ui';
import { PIN_LENGTH, waitLabel } from '@/lib/app-lock';
import { unlockSync } from '@/lib/device-sync';

export function SyncPinPrompt() {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState<string | null>(null);

  async function submit() {
    if (pin.length !== PIN_LENGTH || busy) return;
    tap();
    setBusy(true);
    const r = await unlockSync(pin);
    setBusy(false);
    setWrong(r === 'ok' ? null : r === 'wait' ? `Too many tries. Wait ${waitLabel()}.` : 'That PIN does not match. Try again.');
    if (r !== 'ok') setPin('');
  }

  return (
    <View style={{ gap: 8 }}>
      <Text variant="small" color="text">
        Your data in Google Drive is protected by your Daybloom PIN. Enter the PIN you use on your other phone to bring it here.
      </Text>
      <Input
        value={pin}
        onChangeText={(v) => (setWrong(null), setPin(v.replace(/\D/g, '').slice(0, PIN_LENGTH)))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_LENGTH}
        placeholder="PIN"
        accessibilityLabel="Daybloom PIN from your other phone"
        onSubmitEditing={submit}
      />
      {!!wrong && (
        <Text variant="small" color="danger">
          {wrong}
        </Text>
      )}
      <Button title="Bring my data here" icon="lock" loading={busy} disabled={pin.length !== PIN_LENGTH} onPress={submit} />
    </View>
  );
}
