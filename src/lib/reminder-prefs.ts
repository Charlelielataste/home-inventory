import { createKvPref, savedRecord } from '@/lib/kv-pref';

/**
 * Reminder delays chosen by the user (Péremption tab), for the whole house (not per item).
 * They drive everything: notifications, "expiring soon" list, badges, banner, "Ignorer".
 * A preference: kv-store, not in backups.
 * - expiryDays: notify N days before the expiry date (1 = the day before), 7 by default;
 * - freezerMonths: an item frozen for N months shows up in the Péremption tab and is notified,
 *   and "Ignorer" postpones it by N months.
 */
export type ReminderPrefs = { expiryDays: number; freezerMonths: number };

export const EXPIRY_DAYS_RANGE = { min: 1, max: 10 } as const;
export const FREEZER_MONTHS_RANGE = { min: 1, max: 6 } as const;

const DEFAULT_PREFS: ReminderPrefs = { expiryDays: 7, freezerMonths: 3 };

function clampInt(value: unknown, range: { min: number; max: number }, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

const pref = createKvPref<ReminderPrefs>('reminders.prefs', (saved) => {
  const s = savedRecord(saved);
  return {
    expiryDays: clampInt(s.expiryDays, EXPIRY_DAYS_RANGE, DEFAULT_PREFS.expiryDays),
    freezerMonths: clampInt(s.freezerMonths, FREEZER_MONTHS_RANGE, DEFAULT_PREFS.freezerMonths),
  };
});

/** Current value, for non-React code (queries, badges, reminders). */
export const getReminderPrefs = pref.get;

export const useReminderPrefs = pref.use;

export function setReminderPref(key: keyof ReminderPrefs, value: number) {
  const prefs = pref.get();
  const range = key === 'expiryDays' ? EXPIRY_DAYS_RANGE : FREEZER_MONTHS_RANGE;
  pref.set({ ...prefs, [key]: clampInt(value, range, prefs[key]) });
}

/**
 * "Expiring soon" window (in days) = the reminder delay chosen in the Péremption tab:
 * a product shows up in the tab, the badges and the banner on the day it is notified.
 */
export function expiryWarningDays(): number {
  return pref.get().expiryDays;
}

/**
 * Freezer: warn after N months (chosen in the Péremption tab, 3 by default).
 * "Ignorer" postpones the reminder by the same delay, indefinitely.
 */
export function freezerWarningMonths(): number {
  return pref.get().freezerMonths;
}

/** Notification delay: "la veille" / "3 jours avant" */
export function describeExpiryDelay(days: number): string {
  return days === 1 ? 'la veille' : `${days} jours avant`;
}

/** "Expiring soon" window: "d’ici demain" / "d’ici 5 jours" */
export function describeExpiryWindow(days: number): string {
  return days === 1 ? 'd’ici demain' : `d’ici ${days} jours`;
}
