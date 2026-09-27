/**
 * Turns a view (a flower card, a Poo Kolam) into a PNG and opens the share menu, where the user
 * can pick WhatsApp and a contact, or save it to Photos or Drive. Nothing is uploaded by the app.
 */
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export async function shareViewAsImage(ref: RefObject<View | null>, dialogTitle: string): Promise<boolean> {
  if (!ref.current || Platform.OS === 'web') return false;
  try {
    const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle, UTI: 'public.png' });
    return true;
  } catch {
    return false;
  }
}
