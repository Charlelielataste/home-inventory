import { useFocusEffect } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

/**
 * Loads data from SQLite and reloads it every time the screen
 * regains focus (coming back from another screen).
 * `key` must change when the query parameters change. A failed load is logged
 * (the previous data stays), so `reload()` never rejects.
 */
export function useQuery<T>(loader: (db: SQLiteDatabase) => Promise<T>, key: string | number = '') {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | undefined>(undefined);

  const reload = useCallback(async () => {
    try {
      setData(await loader(db));
    } catch (e) {
      // Keep the data already shown; a failed load must not crash the screen
      console.warn('[useQuery]', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, key]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, reload, db };
}
