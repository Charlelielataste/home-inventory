import { Tabs } from 'expo-router/js-tabs';
import { FlatList, Share, Text, View } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { confirmDeleteItems, SelectionBar, useSelection } from '@/components/selection';
import { getAlerts } from '@/db/queries';
import { formatCategory } from '@/lib/catalog';
import { formatLocation } from '@/lib/text';
import { formatQuantity } from '@/lib/units';
import { useQuery } from '@/lib/use-query';
import { Button, EmptyState, Separator } from '@/ui/components';
import { colors, font, spacing } from '@/ui/theme';

/** Shopping list: items at or below their minimum stock. */
export default function ShoppingScreen() {
  const { data, reload, db } = useQuery(getAlerts);
  const lowStock = data?.lowStock ?? [];
  const { selected, clear, headerOptions, rowProps } = useSelection(lowStock.map((i) => i.id));
  const chosen = selected ? lowStock.filter((i) => selected.has(i.id)) : [];

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

  const done = () => {
    clear();
    reload();
  };

  // Rendered in every branch: the header must leave selection mode even if the list empties
  const screen = (
    <Tabs.Screen
      options={
        headerOptions ?? {
          title: 'Courses',
          headerLeft: undefined,
          headerRight: undefined,
        }
      }
    />
  );
  if (!data) return screen;

  if (lowStock.length === 0) {
    return (
      <>
        {screen}
        <EmptyState
          icon="cart"
          title="Rien à racheter"
          text="Renseigne un « stock minimum » sur un objet : dès qu’il en reste ce nombre ou moins, il apparaît ici."
        />
      </>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {screen}
      <FlatList
        data={lowStock}
        extraData={selected}
        keyExtractor={(i) => String(i.id)}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={{ paddingBottom: selected ? 100 : spacing.xl }}
        ListHeaderComponent={
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Button title="Partager la liste" icon="share" variant="secondary" onPress={share} />
            <Text style={[font.small, { color: colors.textMuted }]}>
              Acheté ? Choisis la quantité achetée avec − / + puis appuie sur « Ajouter » pour la mettre en stock.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            subtitle={`Min. ${formatQuantity(item.min_quantity ?? 0, item.unit)} · ${formatLocation(item)}`}
            purchase
            onChanged={reload}
            {...rowProps(item.id)}
          />
        )}
      />
      {selected && (
        <SelectionBar inTabs>
          <Button
            title={`Supprimer (${chosen.length})`}
            icon="trash"
            variant="danger"
            onPress={() => confirmDeleteItems(db, chosen, done)}
            style={{ flex: 1 }}
          />
        </SelectionBar>
      )}
    </View>
  );
}
