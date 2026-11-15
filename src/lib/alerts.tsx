import { addDatabaseChangeListener, useSQLiteContext } from 'expo-sqlite';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { type Alerts, getAlerts } from '@/db/queries';
import { syncReminders } from '@/lib/reminders';

type AlertsContextValue = { alerts: Alerts | undefined; refresh: () => void };

const AlertsContext = createContext<AlertsContextValue>({ alerts: undefined, refresh: () => {} });

/**
 * Alerts shared by the home banner and the tab badges, and the scheduled reminders.
 * Recomputed whenever the database changes (needs `enableChangeListener` on the
 * SQLiteProvider) and when the app comes back to the foreground (the day may have changed).
 */
export function AlertsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [alerts, setAlerts] = useState<Alerts>();

  const refresh = useCallback(() => {
    getAlerts(db).then(setAlerts, (e) => console.warn('[alerts]', e));
    syncReminders(db);
  }, [db]);

  useEffect(() => {
    refresh();
    // A single edit can touch several rows (cascades, imports): debounce
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 300);
    };
    const dbSub = addDatabaseChangeListener(later);
    const appSub = AppState.addEventListener('change', (state) => state === 'active' && later());
    // App left open past midnight: "soon" becomes "expired"
    let dayTimer: ReturnType<typeof setTimeout> | undefined;
    const atMidnight = () => {
      const next = new Date();
      next.setHours(24, 0, 5, 0);
      dayTimer = setTimeout(() => {
        refresh();
        atMidnight();
      }, next.getTime() - Date.now());
    };
    atMidnight();
    return () => {
      clearTimeout(timer);
      clearTimeout(dayTimer);
      dbSub.remove();
      appSub.remove();
    };
  }, [refresh]);

  return <AlertsContext value={{ alerts, refresh }}>{children}</AlertsContext>;
}

export function useAlerts() {
  return useContext(AlertsContext);
}

/** Counts shown in the UI. */
export function alertCounts(alerts: Alerts | undefined) {
  const expired = alerts?.expired.length ?? 0;
  const soon = alerts?.expiringSoon.length ?? 0;
  const frozen = alerts?.frozenLong.length ?? 0;
  const toBuy = alerts?.lowStock.length ?? 0;
  return { expired, soon, frozen, toBuy, expiry: expired + soon + frozen };
}
