import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { RestockDateModal } from '@/components/batch-editor';
import { addStock, type Item } from '@/db/queries';
import { itemBadges } from '@/lib/badges';
import { categoryHasExpiry, formatCategory, itemIcon } from '@/lib/catalog';
import { giveFeedback } from '@/lib/feedback';
import { formatLocation } from '@/lib/text';
import { formatNumber, formatStock } from '@/lib/units';
import { Button, Hint, ListRow, SelectionMark, Stepper } from '@/ui/components';
import { colors, font, spacing } from '@/ui/theme';

type Props = {
  /** With its location (`ItemWithLocation`) for `showLocation` */
  item: Item & { room_name?: string; furniture_name?: string };
  /** Secondary text (e.g. location), an array = one line each. Defaults to the category. */
  subtitle?: string | string[];
  /** Line of its own above the footer; wins over `showLocation` */
  note?: { label: string; value: string };
  /** Shows « Rangé dans : Pièce › Rangement » on a line of its own (needs `room_name` / `furniture_name`) */
  showLocation?: boolean;
  /** Called after the stock changed (shopping mode). */
  onChanged?: () => void;
  /** Action button shown on the right instead of the quantity (e.g. "Ignorer"); plays its own feedback. */
  action?: { label: string; onPress: () => void; variant?: 'secondary' | 'warn' };
  /** Long press (e.g. start selecting several items). */
  onLongPress?: () => void;
  /** Selection mode: a tap toggles the item, a checkbox replaces the quantity. */
  selection?: { selected: boolean; onToggle: () => void };
  /**
   * Shopping mode: − / + (under the item) choose the amount bought (not saved), "Ajouter"
   * adds it to the stock, then `onChanged` is called.
   */
  purchase?: boolean;
};

export function ItemRow({
  item,
  subtitle,
  note,
  showLocation,
  onChanged,
  action,
  onLongPress,
  selection,
  purchase,
}: Props) {
  const db = useSQLiteContext();
  // Shopping mode: number of items bought, 1 by default
  const [bought, setBought] = useState(1);
  const changeBought = (delta: number) => setBought((b) => Math.max(1, b + delta));
  // A quick double tap must not add the purchase twice
  const adding = useRef(false);
  // Something that expires: its date is asked first (optional), kept apart from the stock left
  const [askDate, setAskDate] = useState(false);
  const onBuy = () => (categoryHasExpiry(item.category) && !item.frozen_at ? setAskDate(true) : addBought(null));
  const addBought = async (expiresAt: string | null) => {
    setAskDate(false);
    if (adding.current) return;
    adding.current = true;
    try {
      await addStock(db, item.id, bought, expiresAt);
      giveFeedback('success');
      setBought(1);
      onChanged?.();
    } finally {
      adding.current = false;
    }
  };
  const located =
    showLocation && item.room_name !== undefined && item.furniture_name !== undefined
      ? {
          label: 'Rangé dans :',
          value: formatLocation({ room_name: item.room_name, furniture_name: item.furniture_name }),
        }
      : undefined;
  const stock = formatStock(item, { pieces: true });
  return (
    <ListRow
      title={item.name}
      subtitle={subtitle ?? formatCategory(item.category, item.subcategory) ?? undefined}
      icon={itemIcon(item)}
      tintKey={item.category ?? undefined}
      badges={itemBadges(item)}
      note={note ?? located}
      selected={selection?.selected}
      feedback={selection ? 'tick' : 'tap'}
      footer={
        purchase && !selection ? (
          <>
            {/* No label: the button says how many are added ("Ajouter 3") */}
            <Stepper
              value={formatNumber(bought)}
              onStep={changeBought}
              decreaseLabel={`${item.name} : en ajouter 1 de moins`}
              increaseLabel={`${item.name} : en ajouter 1 de plus`}
              valueWidth={24}
              style={{ gap: spacing.sm }}
            />
            {/* Pushed to the right edge (a flex: 1 spacer made it overflow the card on iOS) */}
            <Button
              title={`Ajouter ${formatNumber(bought)}`}
              icon="cart-add"
              feedback={false}
              onPress={onBuy}
              style={{ marginLeft: 'auto', minHeight: 40, paddingVertical: 8, paddingHorizontal: spacing.md }}
            />
            <RestockDateModal
              visible={askDate}
              title={`${formatNumber(bought)} × ${item.name}`}
              bought={bought}
              inStock={item.quantity}
              onDone={addBought}
              onClose={() => setAskDate(false)}
            />
          </>
        ) : undefined
      }
      onPress={selection ? selection.onToggle : () => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
      onLongPress={selection ? selection.onToggle : onLongPress}
      right={
        selection ? (
          <SelectionMark checked={selection.selected} text={stock} muted />
        ) : action ? (
          <Button
            title={action.label}
            variant={action.variant ?? 'secondary'}
            feedback={false}
            onPress={action.onPress}
            style={{ paddingVertical: 6, paddingHorizontal: 12 }}
          />
        ) : (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text
              style={[
                font.number,
                { minWidth: 74, textAlign: 'center', fontSize: 14 },
                item.quantity === 0 && { color: colors.textMuted },
              ]}>
              {stock}
            </Text>
            {purchase && <Hint style={{ fontSize: 12 }}>en stock</Hint>}
          </View>
        )
      }
    />
  );
}
