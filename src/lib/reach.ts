/** One-tap ways to reach a person: phone call, SMS and WhatsApp. */
import { Linking, Platform } from 'react-native';

/** Keeps digits and a leading "+". */
export function cleanNumber(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/**
 * International form for WhatsApp links (no "+").
 * A bare 10-digit number is assumed to be Indian (+91); a leading 0 trunk prefix is dropped.
 */
export function whatsappNumber(phone: string): string {
  const n = cleanNumber(phone);
  if (n.startsWith('+')) return n.slice(1);
  const local = n.replace(/^0+/, '');
  return local.length === 10 ? `91${local}` : local;
}

export async function call(phone: string): Promise<boolean> {
  return open(`tel:${cleanNumber(phone)}`);
}

export async function sms(phone: string, body: string): Promise<boolean> {
  // iOS separates the body with "&", Android with "?".
  const sep = Platform.OS === 'ios' ? '&' : '?';
  return open(`sms:${cleanNumber(phone)}${sep}body=${encodeURIComponent(body)}`);
}

export async function whatsapp(phone: string, text: string): Promise<boolean> {
  return open(`https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(text)}`);
}

async function open(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
