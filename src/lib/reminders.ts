import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { listReminderItems, type ReminderItem } from '@/db/queries';
import { addMonthsToIso, FREEZER_WARNING_MONTHS, isoAt, REMINDER_HOUR, todayIso } from '@/lib/dates';

/**
 * Local reminders (no server, nothing leaves the phone):
 * - expiry: at REMINDER_HOUR the day before (or the same day if it is too late for that);
 * - freezer: at REMINDER_HOUR on the day an item reaches FREEZER_WARNING_MONTHS months
 *   in the freezer (or the end of its "Ignorer" snooze).
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

type Kind = 'today' | 'tomorrow' | 'frozen';
type Planned = { date: Date; kind: Kind; names: string[] };

const TITLES: Record<Kind, (n: number) => string> = {
  today: (n) => (n > 1 ? "Ces produits périment aujourd'hui" : "Ce produit périme aujourd'hui"),
  tomorrow: (n) => (n > 1 ? 'Ces produits périment demain' : 'Ce produit périme demain'),
  frozen: () => `Au congélateur depuis ${FREEZER_WARNING_MONTHS} mois`,
};

/** "Lait", "Lait et Œufs", "Lait, Œufs, Beurre et 2 autres" */
function listNames(names: string[]): string {
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} et ${rest} ${rest > 1 ? 'autres' : 'autre'}`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(', ')} et ${shown[shown.length - 1]}`;
}

export function planReminders(items: ReminderItem[], now = new Date()): Planned[] {
  const groups = new Map<string, Planned>();
  const add = (date: Date, kind: Kind, name: string) => {
    if (date <= now) return;
    const key = `${date.getTime()}|${kind}`;
    const group = groups.get(key) ?? { date, kind, names: [] };
    group.names.push(name);
    groups.set(key, group);
  };

  const today = todayIso();
  for (const item of items) {
    if (item.frozen_at) {
      let due = addMonthsToIso(item.frozen_at, FREEZER_WARNING_MONTHS);
      if (item.frozen_snoozed_until && item.frozen_snoozed_until > due) due = item.frozen_snoozed_until;
      // Already due: it is in the Péremption tab, no new notification
      if (due > today) add(isoAt(due, REMINDER_HOUR), 'frozen', item.name);
    } else if (item.expires_at) {
      const dayBefore = isoAt(item.expires_at, REMINDER_HOUR, -1);
      if (dayBefore > now) add(dayBefore, 'tomorrow', item.name);
      else add(isoAt(item.expires_at, REMINDER_HOUR), 'today', item.name);
    }
  }

  return [...groups.values()].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, MAX_SCHEDULED);
}

export async function ensureChannel() {
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
  const planned = planReminders(await listReminderItems(db));
  const signature = JSON.stringify(planned);
  if (signature === lastSignature) return;

  await ensureChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const p of planned) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: TITLES[p.kind](p.names.length),
        body: listNames(p.names),
        data: { url: REMINDER_ROUTE },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date, channelId: CHANNEL_ID },
    });
  }
  lastSignature = signature;
}
