import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';

import { ItemRow } from '@/components/item-row';
import { deleteFurniture, getFurniture, listAllFurniture, listItems, renameFurniture } from '@/db/queries';
import { FURNITURE_SUGGESTIONS, furnitureIcon } from '@/lib/catalog';
import { matchesItem, normalize, plural } from '@/lib/text';
import { useQuery } from '@/lib/use-query';
import {
  Button,
  confirm,
  EmptyState,
  Fab,
  IconButton,
  PromptModal,
  Separator,
  showRenameDeleteMenu,
  TextField,
} from '@/ui/components';
import { spacing } from '@/ui/theme';

export default function FurnitureScreen() {
  const furnitureId = Number(useLocalSearchParams<{ id: string }>().id);
  const { data, reload, db } = useQuery(
    async (db) => ({
      furniture: await getFurniture(db, furnitureId),
      items: await listItems(db, furnitureId),
      usedNames: (await listAllFurniture(db)).map((f) => f.name),
    }),
    furnitureId,
  );
  const [filter, setFilter] = useState('');
  const [renaming, setRenaming] = useState(false);

  const furniture = data?.furniture;
  const items = data?.items ?? [];
  const q = normalize(filter);
  const visible = q ? items.filter((i) => matchesItem(i, q)) : items;

  const addItem = () => router.push({ pathname: '/item/[id]', params: { id: 'new', furnitureId } });

  const menu = () =>
    furniture &&
    showRenameDeleteMenu(
      furniture.name,
      () => setRenaming(true),
      () =>
        confirm(
          `Supprimer « ${furniture.name} » ?`,
          items.length ? `${plural(items.length, 'objet')} seront supprimés avec lui.` : '',
          'Supprimer',
          async () => {
            await deleteFurniture(db, furnitureId);
            router.back();
          },
        ),
    );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: furniture?.name ?? '',
          headerRight: () => <IconButton icon="more" label="Options du rangement" onPress={menu} />,
        }}
      />
      {data && items.length === 0 ? (
        <EmptyState
          icon="box"
          title="Rien ici pour l'instant"
          text={furniture ? `Ajoute ce que contient « ${furniture.name} » (${furniture.room_name}).` : undefined}>
          <Button title="Ajouter un objet" onPress={addItem} />
        </EmptyState>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(i) => String(i.id)}
          contentInsetAdjustmentBehavior="automatic"
          ItemSeparatorComponent={Separator}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: 100 }}
          ListHeaderComponent={
            items.length > 8 ? (
              <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
                <TextField
                  value={filter}
                  onChangeText={setFilter}
                  placeholder={`Filtrer les ${items.length} objets…`}
                  clearButtonMode="while-editing"
                />
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <ItemRow item={item} onChanged={reload} />
          )}
        />
      )}
      {items.length > 0 && <Fab label="Ajouter un objet" onPress={addItem} />}
      <PromptModal
        visible={renaming}
        title="Renommer le rangement"
        initialValue={furniture?.name}
        suggestions={[...(data?.usedNames ?? []), ...FURNITURE_SUGGESTIONS]}
        suggestionIcon={furnitureIcon}
        onSubmit={async (name) => {
          await renameFurniture(db, furnitureId, name);
          setRenaming(false);
          reload();
        }}
        onClose={() => setRenaming(false)}
      />
    </View>
  );
}
