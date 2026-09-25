/**
 * The phone's region (from its language setting, e.g. "en-IN" → "IN"), used for helplines
 * and for reading phone numbers saved without a country code.
 */
export function deviceRegion(): string | null {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    const m = /[-_]([A-Z]{2})\b/.exec(locale);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Country calling codes for regions where people commonly save 10-digit national numbers. */
const CALLING_CODE: Record<string, string> = { IN: '91', US: '1', CA: '1' };

export function callingCode(region = deviceRegion()): string | null {
  return region ? (CALLING_CODE[region] ?? null) : null;
}

export type Helpline = { name: string; number?: string; detail: string; link?: string; emergency: string };

/** India gets Tele-MANAS and 112; elsewhere, a directory of local helplines. */
export function helpline(region = deviceRegion()): Helpline {
  if (region === 'IN' || region === null) {
    return {
      name: 'Tele-MANAS',
      number: '14416',
      detail: 'Free and confidential, any time of day. Run by the Government of India.',
      emergency: '112',
    };
  }
  return {
    name: 'Find a Helpline',
    detail: 'Free, confidential helplines in your country, listed by findahelpline.com.',
    link: 'https://findahelpline.com',
    emergency: 'your local emergency number',
  };
}
