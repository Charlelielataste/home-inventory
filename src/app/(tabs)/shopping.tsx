import { FlatList, Share, View } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { getAlerts } from '@/db/queries';
import { formatCategory } from '@/lib/catalog';
import { formatLocation } from '@/lib/text';
import { useQuery } from '@/lib/use-query';
import { Button, EmptyState, Separator } from '@/ui/components';
import { spacing } from '@/ui/theme';

/** Shopping list: items at or below their minimum stock. */
export default function ShoppingScreen() {
  const { data, reload } = useQuery(getAlerts);

  if (!data) return null;
  const { lowStock } = data;

  const share = () => {
    const byCategory = new Map<string, string[]>();
    for (const i of lowStock) {
      const cat = formatCategory(i.category, i.subcategory) ?? 'Divers';
      byCategory.set(cat, [...(byCategory.get(cat) ?? []), `- ${i.name}`]);
    }
    const message = [
      'Liste de courses',
      ...[...byCategory.entries()].map(([cat, lines]) => `\n${cat}\n${lines.join('\n')}`),
    ].join('\n');
    Share.share({ message });
  };

  if (lowStock.length === 0) {
    return (
      <EmptyState
        icon="cart"
        title="Rien à racheter"
        text="Renseigne un « stock minimum » sur un objet : dès qu’il en reste ce nombre ou moins, il apparaît ici."
      />
    );
  }

  return (
    <FlatList
      data={lowStock}
      keyExtractor={(i) => String(i.id)}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={{ paddingBottom: spacing.xl }}
      ListHeaderComponent={
        <View style={{ padding: spacing.lg }}>
          <Button title="Partager la liste" icon="share" variant="secondary" onPress={share} />
        </View>
      }
      renderItem={({ item }) => (
        <ItemRow item={item} subtitle={formatLocation(item)} onChanged={reload} />
      )}
    />
  );
}
