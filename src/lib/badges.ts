import type { Item } from '@/db/queries';
import { daysUntil, expiryWarningDays, frozenNeedsCheck, monthsSince } from '@/lib/dates';
import type { Tone } from '@/ui/theme';

export type ItemBadge = { label: string; tone: Tone };

/**
 * Status badges of an item, in display order: stock (out / low), then frozen or expiry.
 * The expiry window is the delay chosen in the reminder settings.
 */
export function itemBadges(item: Item): ItemBadge[] {
  const badges: ItemBadge[] = [];
  if (item.quantity === 0) badges.push({ label: 'ÉPUISÉ', tone: 'out' });
  else if (item.min_quantity !== null && item.quantity <= item.min_quantity) {
    badges.push({ label: 'STOCK BAS', tone: 'low' });
  }
  if (item.frozen_at) {
    badges.push({
      label: frozenNeedsCheck(item.frozen_at, item.frozen_snoozed_until)
        ? `CONGELÉ DEPUIS ${monthsSince(item.frozen_at)} MOIS`
        : 'CONGELÉ',
      tone: 'frozen',
    });
  } else if (item.expires_at) {
    const d = daysUntil(item.expires_at);
    if (d < 0) badges.push({ label: 'PÉRIMÉ', tone: 'expired' });
    else if (d <= expiryWarningDays()) {
      badges.push({ label: d === 0 ? "PÉRIME AUJOURD'HUI" : `PÉRIME DANS ${d} J`, tone: 'soon' });
    }
  }
  return badges;
}
