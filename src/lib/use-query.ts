import { useFocusEffect } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

/**
 * Loads data from SQLite and reloads it every time the screen
 * regains focus (coming back from another screen).
 * `key` must change when the query parameters change.
 */
export function useQuery<T>(loader: (db: SQLiteDatabase) => Promise<T>, key: string | number = '') {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | undefined>(undefined);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => setData(await loader(db)), [db, key]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, reload, db };
}
