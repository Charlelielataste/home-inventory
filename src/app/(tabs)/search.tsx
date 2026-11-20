import { useState } from 'react';
import { FlatList, View } from 'react-native';

import { ItemCard } from '@/components/item-card';
import { listAllItems } from '@/db/queries';
import { formatLocation, matchesItem, normalize, plural } from '@/lib/text';
import { useQuery } from '@/lib/use-query';
import { EmptyState, SectionTitle, Separator, TextField } from '@/ui/components';
import { spacing } from '@/ui/theme';

/**
 * "Where did I put…?" — searches ITEMS across the whole house
 * (name, category, notes), case- and accent-insensitive.
 */
export default function SearchScreen() {
  const { data: allItems, reload } = useQuery(listAllItems);
  const [query, setQuery] = useState('');

  const q = normalize(query);
  const items = q ? (allItems ?? []).filter((i) => matchesItem(i, q)) : [];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.sm }}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Chercher un objet, une catégorie…"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>
      {!q ? (
        <EmptyState
          icon="search"
          title="Où est-ce que j'ai rangé… ?"
          text={`Recherche parmi tes ${plural(allItems?.length ?? 0, 'objet')}, dans toutes les pièces.`}
        />
      ) : items.length === 0 ? (
        <EmptyState icon="thinking-face" title="Aucun résultat" text={`Rien ne correspond à « ${query} ».`} />
      ) : (
        <FlatList
          data={items}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(i) => String(i.id)}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          ListHeaderComponent={<SectionTitle>{plural(items.length, 'objet')}</SectionTitle>}
          renderItem={({ item }) => <ItemCard item={item} location={formatLocation(item)} onChanged={reload} />}
        />
      )}
    </View>
  );
}
