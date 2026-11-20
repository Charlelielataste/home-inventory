import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

/**
 * A user preference kept in the SQLite key-value store (separate from the inventory
 * database, not in backups), shared by every component and non-React code.
 * `parse` validates the saved JSON (undefined if nothing is saved) and returns a
 * complete value, falling back to defaults for anything missing or invalid.
 * `serialize` turns the value into JSON-friendly data (e.g. a Set into an array).
 */
export type KvPref<T> = {
  /** Current value, for non-React code. */
  get: () => T;
  /** Saves the value (still applied for this session if the store fails) and notifies. */
  set: (value: T) => void;
  /** Current value, re-rendering on change. */
  use: () => T;
};

export function createKvPref<T>(
  key: string,
  parse: (saved: unknown) => T,
  serialize: (value: T) => unknown = (v) => v,
): KvPref<T> {
  let value = load();
  const listeners = new Set<() => void>();

  function load(): T {
    try {
      const raw = Storage.getItemSync(key);
      return parse(raw == null ? undefined : JSON.parse(raw));
    } catch {
      return parse(undefined);
    }
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const get = () => value;

  return {
    get,
    set: (next) => {
      value = next;
      try {
        Storage.setItemSync(key, JSON.stringify(serialize(next)));
      } catch {
        // Still applied for this session
      }
      listeners.forEach((l) => l());
    },
    use: () => useSyncExternalStore(subscribe, get),
  };
}

/** The saved value as a record of unknown fields ({} if absent or not an object). */
export function savedRecord(saved: unknown): Record<string, unknown> {
  return typeof saved === 'object' && saved !== null && !Array.isArray(saved) ? (saved as Record<string, unknown>) : {};
}
