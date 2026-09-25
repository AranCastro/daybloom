/** Web key-value persistence. SQLite on web needs cross-origin isolation headers, so use localStorage. */

function store(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readItem(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeItem(key: string, value: string): void {
  try {
    store()?.setItem(key, value);
  } catch {
    // Storage blocked (private mode); state lives for this session only.
  }
}

export function removeItem(key: string): void {
  try {
    store()?.removeItem(key);
  } catch {
    // ignore
  }
}
