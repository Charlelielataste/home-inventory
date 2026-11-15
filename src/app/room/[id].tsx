import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';

import {
  createFurniture,
  deleteFurniture,
  deleteRoom,
  type FurnitureWithCount,
  getRoom,
  listAllFurniture,
  listFurniture,
  renameFurniture,
  renameRoom,
} from '@/db/queries';
import { FURNITURE_SUGGESTIONS, furnitureIcon, ROOM_SUGGESTIONS, roomIcon } from '@/lib/catalog';
import { plural } from '@/lib/text';
import { useQuery } from '@/lib/use-query';
import {
  Button,
  confirm,
  EmptyState,
  Fab,
  IconButton,
  ListRow,
  PromptModal,
  Separator,
  showRenameDeleteMenu,
} from '@/ui/components';
import { spacing } from '@/ui/theme';

type ModalState =
  | { mode: 'create' }
  | { mode: 'rename'; furniture: FurnitureWithCount }
  | { mode: 'renameRoom' }
  | null;

export default function RoomScreen() {
  const roomId = Number(useLocalSearchParams<{ id: string }>().id);
  const { data, reload, db } = useQuery(
    async (db) => ({
      room: await getRoom(db, roomId),
      furniture: await listFurniture(db, roomId),
      usedNames: (await listAllFurniture(db)).map((f) => f.name),
    }),
    roomId,
  );
  const [modal, setModal] = useState<ModalState>(null);

  const room = data?.room;
  const furniture = data?.furniture ?? [];

  const onSubmit = async (name: string) => {
    if (modal?.mode === 'rename') await renameFurniture(db, modal.furniture.id, name);
    else if (modal?.mode === 'renameRoom') await renameRoom(db, roomId, name);
    else await createFurniture(db, roomId, name);
    setModal(null);
    reload();
  };

  const roomMenu = () =>
    room &&
    showRenameDeleteMenu(
      room.name,
      () => setModal({ mode: 'renameRoom' }),
      () =>
        confirm(`Supprimer « ${room.name} » ?`, 'Tous ses rangements et leurs objets seront supprimés.', 'Supprimer', async () => {
          await deleteRoom(db, roomId);
          router.back();
        }),
    );

  const furnitureMenu = (f: FurnitureWithCount) =>
    showRenameDeleteMenu(
      f.name,
      () => setModal({ mode: 'rename', furniture: f }),
      () =>
        confirm(
          `Supprimer « ${f.name} » ?`,
          f.item_count ? `${plural(f.item_count, 'objet')} seront supprimés avec lui.` : '',
          'Supprimer',
          async () => {
            await deleteFurniture(db, f.id);
            reload();
          },
        ),
    );

  const modalTitle =
    modal?.mode === 'rename' ? 'Renommer le rangement' : modal?.mode === 'renameRoom' ? 'Renommer la pièce' : 'Nouveau rangement';
  const modalInitial =
    modal?.mode === 'rename' ? modal.furniture.name : modal?.mode === 'renameRoom' ? (room?.name ?? '') : '';

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: room?.name ?? '',
          headerRight: () => <IconButton icon="more" label="Options de la pièce" onPress={roomMenu} />,
        }}
      />
      {data && furniture.length === 0 ? (
        <EmptyState
          icon="door"
          title="Aucun rangement"
          text="Ajoute les meubles et rangements de cette pièce : frigo, placard, armoire, tiroir…">
          <Button title="Ajouter un rangement" onPress={() => setModal({ mode: 'create' })} />
        </EmptyState>
      ) : (
        <FlatList
          data={furniture}
          keyExtractor={(f) => String(f.id)}
          contentInsetAdjustmentBehavior="automatic"
          ItemSeparatorComponent={Separator}
          contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={item.item_count ? plural(item.item_count, 'objet') : 'Vide'}
              icon={furnitureIcon(item.name)}
              tintKey={item.name}
              chevron
              onPress={() => router.push({ pathname: '/furniture/[id]', params: { id: item.id } })}
              onLongPress={() => furnitureMenu(item)}
            />
          )}
        />
      )}
      {furniture.length > 0 && <Fab label="Ajouter un rangement" onPress={() => setModal({ mode: 'create' })} />}
      <PromptModal
        visible={!!modal}
        title={modalTitle}
        initialValue={modalInitial}
        placeholder="Ex : Frigo"
        suggestions={
          modal?.mode === 'renameRoom'
            ? ROOM_SUGGESTIONS
            : [...(data?.usedNames ?? []), ...FURNITURE_SUGGESTIONS]
        }
        suggestionIcon={modal?.mode === 'renameRoom' ? roomIcon : furnitureIcon}
        onSubmit={onSubmit}
        onClose={() => setModal(null)}
      />
    </View>
  );
}
