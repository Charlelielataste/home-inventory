import { FlatList } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { itemBatches, type ItemWithLocation } from '@/db/queries';
import { useAlerts } from '@/lib/alerts';
import { batchesTotal, undatedCount } from '@/lib/batches';
import { EmptyState, Hint, Separator } from '@/ui/components';
import { spacing } from '@/ui/theme';

/** « 2 avec date · 1 sans date » */
function datedSummary(item: ItemWithLocation): string {
  const batches = itemBatches(item);
  return `${batchesTotal(batches)} avec date · ${undatedCount(batches, item.quantity)} sans date`;
}

/**
 * Items with some expiry dates but not for the whole stock (a date was forgotten when buying
 * more). Only reached from the home banner; a tap opens the item form, already in batch mode,
 * to add the missing date.
 */
export default function UndatedScreen() {
  // Loaded by AlertsProvider and recomputed on every database change: a fixed item leaves the list
  const { alerts } = useAlerts();
  const items = alerts?.partlyDated ?? [];

  if (alerts && items.length === 0) {
    return (
      <EmptyState
        icon="check-mark"
        title="Tout est daté"
        text="Les produits dont seule une partie du stock a une date de péremption apparaîtront ici."
      />
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => String(i.id)}
      contentInsetAdjustmentBehavior="automatic"
      ItemSeparatorComponent={Separator}
      contentContainerStyle={{ paddingBottom: spacing.xl }}
      ListHeaderComponent={
        <Hint style={{ padding: spacing.lg }}>
          Une partie de ces produits a une date de péremption, l’autre non. Touche un produit puis « Ajouter une date »
          pour ceux qui n’en ont pas.
        </Hint>
      }
      renderItem={({ item }) => <ItemRow item={item} subtitle={datedSummary(item)} showLocation />}
    />
  );
}
