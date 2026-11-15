import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Text, View } from 'react-native';

import { adjustQuantity, type Item } from '@/db/queries';
import { daysUntil, EXPIRY_WARNING_DAYS, frozenNeedsCheck, monthsSince } from '@/lib/dates';
import { formatQuantity, getUnit } from '@/lib/units';
import { type BadgeSpec, Button, IconButton, ListRow } from '@/ui/components';
import { colors, fonts } from '@/ui/theme';
import { categoryIcon, formatCategory } from '@/lib/catalog';

export function itemBadges(item: Item): BadgeSpec[] {
  const badges: BadgeSpec[] = [];
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
    else if (d <= EXPIRY_WARNING_DAYS) {
      badges.push({ label: d === 0 ? "PÉRIME AUJOURD'HUI" : `PÉRIME DANS ${d} J`, tone: 'soon' });
    }
  }
  return badges;
}

type Props = {
  item: Item;
  /** Secondary text (e.g. location). Defaults to the category. */
  subtitle?: string;
  /** Shows the − / + buttons; called after each quantity change (e.g. reload). */
  onChanged?: () => void;
  /** Action button shown on the right instead of the quantity (e.g. "Ignorer"). */
  action?: { label: string; onPress: () => void };
};

export function ItemRow({ item, subtitle, onChanged, action }: Props) {
  const db = useSQLiteContext();
  const step = getUnit(item.unit).step;
  const onAdjust = onChanged
    ? async (delta: number) => {
        await adjustQuantity(db, item.id, delta);
        onChanged();
      }
    : undefined;
  return (
    <ListRow
      title={item.name}
      subtitle={subtitle ?? formatCategory(item.category, item.subcategory) ?? undefined}
      icon={categoryIcon(item.category, item.subcategory)}
      tintKey={item.category ?? undefined}
      badges={itemBadges(item)}
      onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
      right={
        action ? (
          <Button
            title={action.label}
            variant="secondary"
            onPress={action.onPress}
            style={{ paddingVertical: 6, paddingHorizontal: 12 }}
          />
        ) : (
        <View style={{ alignItems: 'center', gap: 4 }}>
          {onAdjust && (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <IconButton icon="remove" size={16} variant="soft" label={`Retirer ${step}`} onPress={() => onAdjust(-step)} />
              <IconButton icon="add" size={16} variant="soft" label={`Ajouter ${step}`} onPress={() => onAdjust(step)} />
            </View>
          )}
          <Text
            style={{
              minWidth: 74,
              textAlign: 'center',
              fontFamily: fonts.bold,
              fontSize: 14,
              color: item.quantity === 0 ? colors.textMuted : colors.text,
            }}>
            {formatQuantity(item.quantity, item.unit)}
          </Text>
        </View>
        )
      }
    />
  );
}
