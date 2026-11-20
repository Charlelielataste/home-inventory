import { freezerWarningMonths } from '@/lib/reminder-prefs';

// Reminder delays (user preferences), re-exported here for the date helpers' callers
export { describeExpiryWindow, expiryWarningDays, freezerWarningMonths } from '@/lib/reminder-prefs';

/** Dates are stored as ISO "YYYY-MM-DD" and displayed as "DD/MM/YYYY". */

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(): string {
  return toIso(new Date());
}

export function isoToFr(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** "5/3/27", "05/03/2027" -> "2027-03-05". null if invalid. */
export function frToIso(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!match) return null;
  const d = Number(match[1]);
  const m = Number(match[2]);
  let y = Number(match[3]);
  if (y < 100) y += 2000;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return toIso(date);
}

export function addToToday(amount: { days?: number; months?: number; years?: number }): string {
  const now = new Date();
  // Months / years first, clamping the day (31/01 + 1 month = 28/02, not 03/03)
  const months = (amount.months ?? 0) + (amount.years ?? 0) * 12;
  const first = new Date(now.getFullYear(), now.getMonth() + months, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const date = new Date(first.getFullYear(), first.getMonth(), Math.min(now.getDate(), lastDay));
  if (amount.days) date.setDate(date.getDate() + amount.days);
  return toIso(date);
}

/** Number of days between today and the date (negative if past). */
export function daysUntil(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function describeExpiry(iso: string): string {
  const days = daysUntil(iso);
  if (days < -1) return `Périmé depuis ${-days} jours`;
  if (days === -1) return 'Périmé depuis hier';
  if (days === 0) return "Périme aujourd'hui";
  if (days === 1) return 'Périme demain';
  if (days <= 31) return `Périme dans ${days} jours`;
  return `À consommer avant le ${isoToFr(iso)}`;
}

/** Short form for tight spots (lines of an item card): « dans 3 j », « demain », « périmé depuis 2 j ». Null past a month: the date says it. */
export function shortExpiry(iso: string): string | null {
  const days = daysUntil(iso);
  if (days < -1) return `périmé depuis ${-days} j`;
  if (days === -1) return 'périmé hier';
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  if (days <= 31) return `dans ${days} j`;
  return null;
}

/**
 * Out of the freezer: eat within THAWED_SHELF_DAYS days
 * (common advice: 24 to 48 h in the fridge after thawing).
 */
export const THAWED_SHELF_DAYS = 2;

/** Full months elapsed from `fromIso` to `toIso` (0 if `toIso` is earlier). */
export function monthsBetween(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) months -= 1;
  return Math.max(0, months);
}

/** Full months elapsed since the date (0 if in the future). */
export function monthsSince(iso: string): number {
  return monthsBetween(iso, todayIso());
}

/** Frozen for more than freezerWarningMonths() months and reminder not snoozed. */
export function frozenNeedsCheck(frozenAt: string | null, snoozedUntil: string | null): boolean {
  if (!frozenAt) return false;
  if (frozenAt > addToToday({ months: -freezerWarningMonths() })) return false;
  return !snoozedUntil || snoozedUntil <= todayIso();
}

/** Local notifications (expiry / freezer reminders) are sent at this hour. */
export const REMINDER_HOUR = 9;

/** ISO date + months (day clamped like addToToday: 31/01 + 1 month = 28/02). */
export function addMonthsToIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const first = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return toIso(new Date(first.getFullYear(), first.getMonth(), Math.min(d, lastDay)));
}

/**
 * First day on which `frozenAt` is at least `months` months old, with the same rule as the
 * Péremption tab (`frozen_at <= addToToday({ months: -N })`): usually `frozenAt` + N months,
 * but the day after when the day was clamped (31/08 + 6 months = 28/02, listed from 01/03).
 */
export function monthsLaterIso(frozenAt: string, months: number): string {
  const due = addMonthsToIso(frozenAt, months);
  if (due.slice(8) === frozenAt.slice(8)) return due;
  const [y, m, d] = due.split('-').map(Number);
  return toIso(new Date(y, m - 1, d + 1));
}

/** Local Date for `iso` + `dayOffset` days, at `hour`:00. */
export function isoAt(iso: string, hour: number, dayOffset = 0): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d + dayOffset, hour);
}
