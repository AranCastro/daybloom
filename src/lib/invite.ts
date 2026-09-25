import { Platform, Share } from 'react-native';

import { inviteLink } from '@/lib/ntfy';

export function inviteMessage(buddyName: string, myName: string, topic: string): string {
  const opener = myName ? `Hi ${buddyName}, it's ${myName}. ` : `Hi ${buddyName}, `;
  return (
    `${opener}I've picked you as my quiet buddy on Daybloom. ` +
    `If I ever have a few rough days in a row, you'll get one short note asking you to give me a call. Nothing else is shared. ` +
    `It takes a minute to set up: ${inviteLink(topic, myName || 'your friend')}`
  );
}

/** Opens the system share sheet (WhatsApp, SMS, etc.). Falls back to clipboard on web. */
export async function shareInvite(buddyName: string, myName: string, topic: string): Promise<'shared' | 'copied' | 'dismissed'> {
  const message = inviteMessage(buddyName, myName, topic);
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as Navigator | undefined;
    if (nav?.share) {
      try {
        await nav.share({ text: message });
        return 'shared';
      } catch {
        return 'dismissed';
      }
    }
    try {
      await nav?.clipboard?.writeText(message);
      return 'copied';
    } catch {
      return 'dismissed';
    }
  }
  const res = await Share.share({ message });
  return res.action === Share.sharedAction ? 'shared' : 'dismissed';
}
