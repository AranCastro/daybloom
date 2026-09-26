/** The user's profile picture: a photo, a garden flower or a coloured initial, plus the picker. */
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Flower } from '@/components/flower';
import { Text } from '@/components/text';
import { Button, tap } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { AVATAR_PRESETS, AvatarPreset, choosePreset, clearAvatar, pickPhoto, presetOf } from '@/lib/avatar';
import { flowerOf } from '@/lib/flowers';
import { useAppState } from '@/lib/store';

function initialOf(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '☺';
}

function PresetFace({ preset, size, name }: { preset: AvatarPreset; size: number; name: string }) {
  const dark = useIsDark();
  const bg = preset.bg[dark ? 'dark' : 'light'];
  return (
    <View style={[styles.round, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      {preset.kind === 'flower' ? (
        <Flower kind={flowerOf(preset.flower!)} size={size * 0.82} />
      ) : (
        <Text style={{ color: dark ? '#10201A' : '#FFFFFF', fontFamily: Fonts.display, fontSize: size * 0.44, lineHeight: size * 0.56 }}>
          {initialOf(name)}
        </Text>
      )}
    </View>
  );
}

/** Shows the chosen picture; falls back to the initial if a photo is missing (for example after a restore). */
export function ProfileAvatar({ size = 44 }: { size?: number }) {
  const t = useTheme();
  const avatar = useAppState((s) => s.avatar);
  const name = useAppState((s) => s.name);
  const [broken, setBroken] = useState<string | null>(null);

  if (avatar?.kind === 'photo' && broken !== avatar.uri) {
    return (
      <Image
        source={{ uri: avatar.uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.surfaceAlt }}
        contentFit="cover"
        onError={() => setBroken(avatar.uri)}
        accessibilityLabel="Your profile picture"
      />
    );
  }
  const preset = presetOf(avatar?.kind === 'preset' ? avatar.id : undefined) ?? AVATAR_PRESETS.find((p) => p.id === 'initial:forest')!;
  return <PresetFace preset={preset} size={size} name={name} />;
}

/** Bottom sheet to upload a photo or choose an avatar. */
export function AvatarPicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const avatar = useAppState((s) => s.avatar);
  const name = useAppState((s) => s.name);
  const [busy, setBusy] = useState(false);
  const current = avatar?.kind === 'preset' ? avatar.id : avatar === null ? 'initial:forest' : null;

  async function upload() {
    setBusy(true);
    try {
      if (await pickPhoto()) onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: t.surface }]}>
        <View style={[styles.grabber, { backgroundColor: t.line }]} />
        <ScrollView contentContainerStyle={{ gap: 16 }}>
          <Text variant="heading">Profile picture</Text>
          <Button title="Upload a photo" icon="share" loading={busy} onPress={upload} />
          <Text variant="small">Your photo stays on this phone. It is not included in backups.</Text>
          <Text variant="label">Or choose an avatar</Text>
          <View style={styles.grid}>
            {AVATAR_PRESETS.map((p) => {
              const on = current === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => (tap(), choosePreset(p.id), onClose())}
                  accessibilityRole="radio"
                  accessibilityLabel={p.kind === 'flower' ? `${flowerOf(p.flower!).name} avatar` : 'Initial avatar'}
                  accessibilityState={{ checked: on }}
                  aria-checked={on}
                  style={[styles.cell, { borderColor: on ? t.text : 'transparent' }]}>
                  <PresetFace preset={p} size={58} name={name} />
                </Pressable>
              );
            })}
          </View>
          {avatar && (
            <Pressable onPress={() => (tap(), clearAvatar(), onClose())} style={{ alignSelf: 'center', padding: 8 }}>
              <Text variant="small" color="textMuted">
                Use my initial instead
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  round: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  scrim: { flex: 1, backgroundColor: 'rgba(10,8,6,0.38)' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 36, maxHeight: '85%' },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  cell: { width: '22%', aspectRatio: 1, borderRadius: 999, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
});
