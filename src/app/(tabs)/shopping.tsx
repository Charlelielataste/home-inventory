import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { FlatList, Share, View } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { DeleteSelectedButton, SelectionBar, useSelection } from '@/components/selection';
import { TabHeaderButton } from '@/components/tab-header-button';
import { useAlerts } from '@/lib/alerts';
import { formatCategory } from '@/lib/catalog';
import { formatNumber } from '@/lib/units';
import { Button, EmptyState, Hint, Separator } from '@/ui/components';
import { spacing } from '@/ui/theme';

/** Shopping list: items at or below their minimum stock. */
export default function ShoppingScreen() {
  // Already loaded by AlertsProvider (tab badge), recomputed on every database change;
  // `reload` right after a write so the list does not wait for it
  const { alerts: data, refresh: reload } = useAlerts();
  const lowStock = data?.lowStock ?? [];
  const { selected, chosen, done, headerOptions, rowProps } = useSelection(lowStock, reload);

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

  /** Something to buy that is not in stock yet: no quantity, expiry or freezing */
  const addToList = () => router.push({ pathname: '/item/[id]', params: { id: 'new', shopping: '1' } });

  // Rendered in every branch: the header must leave selection mode even if the list empties
  const screen = (
    <Tabs.Screen
      options={
        headerOptions ?? {
          title: 'Courses',
          headerLeft: undefined,
          headerRight: () => (
            <TabHeaderButton
              icon="add"
              size={20}
              variant="filled"
              label="Ajouter à la liste de courses"
              onPress={addToList}
            />
          ),
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
          text="Renseigne un « stock minimum » sur un objet : dès qu’il en reste ce nombre ou moins, il apparaît ici. Ou ajoute directement ce qu’il te faut avec +.">
          <Button title="Ajouter à la liste" icon="add" onPress={addToList} />
        </EmptyState>
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
          <View style={{ padding: spacing.lg, paddingTop: spacing.xs, gap: spacing.md }}>
            <Button title="Partager la liste" icon="share" variant="secondary" onPress={share} />
            <Hint>Acheté ? Choisis combien avec − / + puis appuie sur « Ajouter » pour les mettre en stock.</Hint>
          </View>
        }
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            // Minimum 0 = added with + (to buy once): nothing to say
            subtitle={item.min_quantity ? `Stock minimum : ${formatNumber(item.min_quantity)}` : undefined}
            showLocation
            purchase
            onChanged={reload}
            {...rowProps(item.id)}
          />
        )}
      />
      {selected && (
        <SelectionBar inTabs>
          <DeleteSelectedButton items={chosen} onDone={done} />
        </SelectionBar>
      )}
    </View>
  );
}
