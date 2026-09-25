/** Opens the phone's own contact picker and returns the chosen name and first phone number. */
import { Contact, requestPermissionsAsync } from 'expo-contacts';

export const canPickContacts = true;

export type Picked = { name: string; phone?: string };

async function read(c: Contact): Promise<Picked> {
  const [name, phones] = await Promise.all([c.getFullName(), c.getPhones()]);
  return { name: name ?? '', phone: phones.find((p) => p.number)?.number };
}

export async function pickContact(): Promise<Picked | null> {
  try {
    const c = await Contact.presentPicker();
    return c ? await read(c) : null;
  } catch {
    // Some devices need contacts permission before the picked contact's details can be read.
    const { granted } = await requestPermissionsAsync();
    if (!granted) return null;
    try {
      const c = await Contact.presentPicker();
      return c ? await read(c) : null;
    } catch {
      return null;
    }
  }
}
