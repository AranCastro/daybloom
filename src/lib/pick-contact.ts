/** Opens the phone's own contact picker and returns the chosen name and first phone number. */
import { Contact, getPermissionsAsync, requestPermissionsAsync } from 'expo-contacts';

import { expectReturn } from '@/lib/app-lock';

export const canPickContacts = true;

export type Picked = { name: string; phone?: string };

async function read(c: Contact): Promise<Picked> {
  const [name, phones] = await Promise.all([c.getFullName(), c.getPhones()]);
  return { name: name ?? '', phone: phones.find((p) => p.number)?.number };
}

export async function pickContact(): Promise<Picked | null> {
  try {
    expectReturn();
    const c = await Contact.presentPicker();
    return c ? await read(c) : null;
  } catch {
    // Some devices need contacts permission before the picked contact's details can be read.
    // The lock is only told to expect a return when the permission dialog will really show.
    let perm = await getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) {
      expectReturn();
      perm = await requestPermissionsAsync();
    }
    if (!perm.granted) return null;
    try {
      expectReturn();
      const c = await Contact.presentPicker();
      return c ? await read(c) : null;
    } catch {
      return null;
    }
  }
}
