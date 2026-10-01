/** Device sync needs Google sign-in on Android; the web demo has none. */
export const syncEnabled = false;
export type SyncInfo = { email: string | null; lastSync: number | null; busy: boolean; error: string | null };
const none: SyncInfo = { email: null, lastSync: null, busy: false, error: null };
export const useSyncInfo = (): SyncInfo => none;
export const syncNow = async (): Promise<void> => {};
export const signInForSync = async (): Promise<string | null> => null;
export const signOutOfSync = async (): Promise<void> => {};
export const deleteSyncCopy = async (): Promise<void> => {};
export const startDeviceSync = (): (() => void) => () => {};
