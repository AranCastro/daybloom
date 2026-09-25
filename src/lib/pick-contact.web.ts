/** Browsers have no contact picker we can rely on; names and numbers are typed instead. */
export const canPickContacts = false;

export type Picked = { name: string; phone?: string };

export async function pickContact(): Promise<Picked | null> {
  return null;
}
