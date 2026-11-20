import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { listReminderItems, type ReminderItem } from '@/db/queries';
import { isoAt, monthsBetween, monthsLaterIso, REMINDER_HOUR } from '@/lib/dates';
import { getReminderPrefs, type ReminderPrefs } from '@/lib/reminder-prefs';

/**
 * Local reminders (no server, nothing leaves the phone), delays chosen in the Péremption tab
 * (`reminder-prefs.ts`):
 * - expiry: at REMINDER_HOUR, `expiryDays` days before (if it is too late for that:
 *   the day before, else the same day);
 * - freezer: at REMINDER_HOUR on the day an item reaches `freezerMonths` months
 *   in the freezer (or the end of its "Ignorer" snooze), the day it shows up in the tab.
 * Items sharing the same time are grouped into one notification. The whole schedule
 * is rebuilt from the database whenever it changes (`syncReminders`).
 */

const CHANNEL_ID = 'reminders';
/** iOS keeps at most 64 pending notifications; Android has a similar alarm cap. */
const MAX_SCHEDULED = 60;
/** Route opened when a reminder is tapped. */
export const REMINDER_ROUTE = '/alerts';

// App in the foreground: still show the notification.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** expiry: `days` before the expiry date (0 = that day) · frozen: `months` in the freezer */
type Kind = { type: 'expiry'; days: number } | { type: 'frozen'; months: number };
type Planned = { date: Date; kind: Kind; names: string[] };

function title(kind: Kind, n: number): string {
  if (kind.type === 'frozen') return `Au congélateur depuis ${kind.months} mois`;
  const when = kind.days === 0 ? "aujourd'hui" : kind.days === 1 ? 'demain' : `dans ${kind.days} jours`;
  return n > 1 ? `Ces produits périment ${when}` : `Ce produit périme ${when}`;
}

/** "Lait", "Lait et Œufs", "Lait, Œufs, Beurre et 2 autres" */
function listNames(names: string[]): string {
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} et ${rest} ${rest > 1 ? 'autres' : 'autre'}`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(', ')} et ${shown[shown.length - 1]}`;
}

function planReminders(items: ReminderItem[], prefs: ReminderPrefs, now = new Date()): Planned[] {
  const groups = new Map<string, Planned>();
  const add = (date: Date, kind: Kind, name: string) => {
    if (date <= now) return;
    const key = `${date.getTime()}|${JSON.stringify(kind)}`;
    const group = groups.get(key) ?? { date, kind, names: [] };
    // Two batches of one product reminded the same day: named once
    if (!group.names.includes(name)) group.names.push(name);
    groups.set(key, group);
  };

  for (const item of items) {
    if (item.frozen_at) {
      // Same day as the Péremption tab lists it (31/08 + 6 months: 01/03, not 28/02)
      let due = monthsLaterIso(item.frozen_at, prefs.freezerMonths);
      if (item.frozen_snoozed_until && item.frozen_snoozed_until > due) due = item.frozen_snoozed_until;
      // Due today before REMINDER_HOUR: still scheduled (add() drops past times only).
      // After "Ignorer", the title gives the real time in the freezer, not the delay.
      const months = monthsBetween(item.frozen_at, due);
      add(isoAt(due, REMINDER_HOUR), { type: 'frozen', months }, item.name);
    } else if (item.expires_at) {
      // First reminder time still to come: the chosen delay, else the day before, else that day
      const expiresAt = item.expires_at;
      const days = [...new Set([prefs.expiryDays, 1, 0])].find((d) => isoAt(expiresAt, REMINDER_HOUR, -d) > now);
      if (days !== undefined) add(isoAt(expiresAt, REMINDER_HOUR, -days), { type: 'expiry', days }, item.name);
    }
  }

  return [...groups.values()].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, MAX_SCHEDULED);
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Rappels',
    description: 'Péremption et congélateur',
    importance: AndroidImportance.DEFAULT,
  });
}

export async function getReminderPermission() {
  return Notifications.getPermissionsAsync();
}

/** Asks for the notification permission (Android 13+ / iOS). */
export async function requestReminderPermission() {
  // Android 13+ only shows the prompt once a channel exists
  await ensureChannel();
  return Notifications.requestPermissionsAsync();
}

let lastSignature: string | null = null;
let queue = Promise.resolve();

/** Rebuilds the scheduled reminders from the database (no-op if nothing changed). */
export function syncReminders(db: SQLiteDatabase): Promise<void> {
  queue = queue.then(() => doSync(db)).catch((e) => console.warn('[reminders]', e));
  return queue;
}

async function doSync(db: SQLiteDatabase) {
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) {
    lastSignature = null;
    return;
  }
  const planned = planReminders(await listReminderItems(db), getReminderPrefs());
  const signature = JSON.stringify(planned);
  if (signature === lastSignature) return;

  await ensureChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const p of planned) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title(p.kind, p.names.length),
        body: listNames(p.names),
        data: { url: REMINDER_ROUTE },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date, channelId: CHANNEL_ID },
    });
  }
  lastSignature = signature;
}
