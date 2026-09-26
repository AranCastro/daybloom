/**
 * Profile picture. A photo is copied into the app's own storage (so it survives the gallery
 * changing); built-in avatars are flowers from the garden or a coloured initial.
 */
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { getState, update } from '@/lib/store';

export type AvatarPreset = { id: string; kind: 'flower' | 'initial'; flower?: string; bg: { light: string; dark: string } };

export const AVATAR_PRESETS: readonly AvatarPreset[] = [
  { id: 'flower:lotus', kind: 'flower', flower: 'lotus', bg: { light: '#FBE5EC', dark: '#3A2230' } },
  { id: 'flower:sunflower', kind: 'flower', flower: 'sunflower', bg: { light: '#FDF1CF', dark: '#3A3016' } },
  { id: 'flower:neelakurinji', kind: 'flower', flower: 'neelakurinji', bg: { light: '#E9E5FA', dark: '#26223F' } },
  { id: 'flower:hibiscus', kind: 'flower', flower: 'hibiscus', bg: { light: '#FBE3DF', dark: '#3A201C' } },
  { id: 'flower:jasmine', kind: 'flower', flower: 'jasmine', bg: { light: '#E8F2E6', dark: '#1D2E24' } },
  { id: 'flower:orchid', kind: 'flower', flower: 'orchid', bg: { light: '#E1EAFB', dark: '#1B2640' } },
  { id: 'flower:marigold', kind: 'flower', flower: 'marigold', bg: { light: '#FCEBD6', dark: '#3A2A16' } },
  { id: 'flower:golden-lotus', kind: 'flower', flower: 'golden-lotus', bg: { light: '#FFF4D0', dark: '#3A3316' } },
  { id: 'initial:forest', kind: 'initial', bg: { light: '#2F4A3F', dark: '#A8D0BC' } },
  { id: 'initial:apricot', kind: 'initial', bg: { light: '#C8633A', dark: '#F0936B' } },
  { id: 'initial:indigo', kind: 'initial', bg: { light: '#5566D0', dark: '#8D9BEA' } },
  { id: 'initial:plum', kind: 'initial', bg: { light: '#8656AC', dark: '#C49BE3' } },
];

export function presetOf(id: string | undefined): AvatarPreset | undefined {
  return AVATAR_PRESETS.find((p) => p.id === id);
}

export function choosePreset(id: string) {
  removeOldPhoto();
  update({ avatar: { kind: 'preset', id } });
}

export function clearAvatar() {
  removeOldPhoto();
  update({ avatar: null });
}

function removeOldPhoto() {
  const a = getState().avatar;
  if (a?.kind !== 'photo' || Platform.OS === 'web') return;
  try {
    const f = new File(a.uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}

/** Opens the photo picker (square crop). Returns false if the user cancelled. */
export async function pickPhoto(): Promise<boolean> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
  if (res.canceled || !res.assets?.length) return false;
  const picked = res.assets[0].uri;
  if (Platform.OS === 'web') {
    update({ avatar: { kind: 'photo', uri: picked } });
    return true;
  }
  const dir = new Directory(Paths.document, 'profile');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `avatar-${Date.now()}.jpg`);
  await new File(picked).copy(dest);
  removeOldPhoto();
  update({ avatar: { kind: 'photo', uri: dest.uri } });
  return true;
}
