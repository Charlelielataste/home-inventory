import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { adjustQuantity, type Item } from '@/db/queries';
import { daysUntil, EXPIRY_WARNING_DAYS, frozenNeedsCheck, monthsSince } from '@/lib/dates';
import { formatQuantity, getUnit } from '@/lib/units';
import { type BadgeSpec, Button, CheckMark, IconButton, ListRow } from '@/ui/components';
import { colors, font, fonts, spacing } from '@/ui/theme';
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
  /** Long press (e.g. start selecting several items). */
  onLongPress?: () => void;
  /**
   * Selection mode: a tap toggles the item, a checkbox replaces the quantity
   * and the − / + buttons.
   */
  selection?: { selected: boolean; onToggle: () => void };
  /**
   * Shopping mode: − / + (under the item) choose the amount bought (not saved), "Ajouter"
   * adds it to the stock, then `onChanged` is called.
   */
  purchase?: boolean;
};

export function ItemRow({ item, subtitle, onChanged, action, onLongPress, selection, purchase }: Props) {
  const db = useSQLiteContext();
  const step = getUnit(item.unit).step;
  // Shopping mode: − / + are in the footer and choose the amount bought instead
  const onAdjust =
    onChanged && !purchase
      ? async (delta: number) => {
          await adjustQuantity(db, item.id, delta);
          onChanged();
        }
      : undefined;
  // Shopping mode: amount bought, one step by default
  const [bought, setBought] = useState(step);
  const changeBought = (delta: number) => setBought((b) => Math.max(step, Math.round((b + delta) * 1000) / 1000));
  // A quick double tap must not add the purchase twice
  const adding = useRef(false);
  const addBought = async () => {
    if (adding.current) return;
    adding.current = true;
    try {
      await adjustQuantity(db, item.id, bought);
      setBought(step);
      onChanged?.();
    } finally {
      adding.current = false;
    }
  };
  return (
    <ListRow
      title={item.name}
      subtitle={subtitle ?? formatCategory(item.category, item.subcategory) ?? undefined}
      icon={categoryIcon(item.category, item.subcategory)}
      tintKey={item.category ?? undefined}
      badges={itemBadges(item)}
      selected={selection?.selected}
      footer={
        purchase && !selection ? (
          <>
            <Text style={[font.small, { color: colors.textMuted }]}>Acheté</Text>
            <IconButton
              icon="remove"
              size={16}
              variant="soft"
              label={`Acheté : ${formatQuantity(step, item.unit)} de moins`}
              onPress={() => changeBought(-step)}
            />
            <Text
              style={{ minWidth: 64, textAlign: 'center', fontFamily: fonts.bold, fontSize: 15, color: colors.text }}>
              {formatQuantity(bought, item.unit)}
            </Text>
            <IconButton
              icon="add"
              size={16}
              variant="soft"
              label={`Acheté : ${formatQuantity(step, item.unit)} de plus`}
              onPress={() => changeBought(step)}
            />
            <View style={{ flex: 1 }} />
            <Button
              title="Ajouter"
              icon="cart-add"
              onPress={addBought}
              style={{ minHeight: 40, paddingVertical: 8, paddingHorizontal: spacing.md }}
            />
          </>
        ) : undefined
      }
      onPress={selection ? selection.onToggle : () => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
      onLongPress={selection ? selection.onToggle : onLongPress}
      right={
        selection ? (
          <View style={{ alignItems: 'center', gap: 6, minWidth: 74 }}>
            <CheckMark checked={selection.selected} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted }}>
              {formatQuantity(item.quantity, item.unit)}
            </Text>
          </View>
        ) : action ? (
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
                <IconButton
                  icon="remove"
                  size={16}
                  variant="soft"
                  label={`Retirer ${formatQuantity(step, item.unit)}`}
                  onPress={() => onAdjust(-step)}
                />
                <IconButton
                  icon="add"
                  size={16}
                  variant="soft"
                  label={`Ajouter ${formatQuantity(step, item.unit)}`}
                  onPress={() => onAdjust(step)}
                />
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
            {purchase && <Text style={[font.small, { color: colors.textMuted, fontSize: 12 }]}>en stock</Text>}
          </View>
        )
      }
    />
  );
}
