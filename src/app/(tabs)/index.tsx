import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import {
  createRoom,
  createRooms,
  deleteRoom,
  getAlerts,
  listRooms,
  renameRoom,
  type RoomWithCounts,
} from '@/db/queries';
import { DEFAULT_ROOMS, ROOM_SUGGESTIONS, roomIcon } from '@/lib/catalog';
import { plural } from '@/lib/text';
import { useQuery } from '@/lib/use-query';
import {
  Button,
  confirm,
  EmptyState,
  Fab,
  Icon,
  PromptModal,
  showRenameDeleteMenu,
  Tile,
} from '@/ui/components';
import { colors, font, radius, spacing } from '@/ui/theme';

export default function HomeScreen() {
  const { data, reload, db } = useQuery(async (db) => ({
    rooms: await listRooms(db),
    alerts: await getAlerts(db),
  }));
  const rooms = data?.rooms;
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'rename'; room: RoomWithCounts } | null>(null);

  const [creatingDefaults, setCreatingDefaults] = useState(false);
  const createDefaults = async () => {
    if (creatingDefaults) return;
    setCreatingDefaults(true);
    await createRooms(db, DEFAULT_ROOMS);
    await reload();
    setCreatingDefaults(false);
  };

  const onSubmit = async (name: string) => {
    if (modal?.mode === 'rename') await renameRoom(db, modal.room.id, name);
    else await createRoom(db, name);
    setModal(null);
    reload();
  };

  const onLongPress = (room: RoomWithCounts) =>
    showRenameDeleteMenu(
      room.name,
      () => setModal({ mode: 'rename', room }),
      () =>
        confirm(
          `Supprimer « ${room.name} » ?`,
          room.furniture_count
            ? `${plural(room.furniture_count, 'rangement')} et ${plural(room.item_count, 'objet')} seront supprimés avec elle.`
            : '',
          'Supprimer',
          async () => {
            await deleteRoom(db, room.id);
            reload();
          },
        ),
    );

  const promptModal = (
    <PromptModal
      visible={!!modal}
      title={modal?.mode === 'rename' ? 'Renommer la pièce' : 'Nouvelle pièce'}
      initialValue={modal?.mode === 'rename' ? modal.room.name : ''}
      placeholder="Ex : Cuisine"
      suggestions={ROOM_SUGGESTIONS}
      suggestionIcon={roomIcon}
      onSubmit={onSubmit}
      onClose={() => setModal(null)}
    />
  );

  if (rooms && rooms.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <EmptyState
          icon="home"
          title="Ta maison est vide"
          text="Commence par ajouter les pièces de ton logement, puis les meubles et rangements de chaque pièce.">
          <View style={{ gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.md }}>
            <Button
              title="Créer les pièces de base"
              icon="sparkles"
              onPress={createDefaults}
              disabled={creatingDefaults}
            />
            <Button title="Ajouter une pièce" variant="secondary" onPress={() => setModal({ mode: 'create' })} />
          </View>
        </EmptyState>
        {promptModal}
      </View>
    );
  }

  const alerts = data?.alerts;
  const toEat = alerts ? alerts.expired.length + alerts.expiringSoon.length : 0;
  const toBuy = alerts?.lowStock.length ?? 0;
  const details = [
    toEat > 0 && `${toEat} à finir bientôt`,
    toBuy > 0 && `${toBuy} à racheter`,
  ].filter(Boolean);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        // Odd number of rooms: an empty cell keeps the last tile half-width
        data={[...(rooms ?? []), ...((rooms?.length ?? 0) % 2 ? [null] : [])]}
        keyExtractor={(r) => String(r?.id ?? 'filler')}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ gap: spacing.md, paddingTop: spacing.xl, paddingBottom: 110 }}
        ListHeaderComponent={
          // Only shown when there is something to act on
          details.length ? (
            <View style={styles.banner}>
              <Icon name="warning" size={32} />
              <View style={{ flex: 1 }}>
                <Text style={[font.heading, { color: colors.onPrimary }]}>{details.join(' · ')}</Text>
              </View>
            </View>
          ) : undefined
        }
        renderItem={({ item }) =>
          !item ? (
            <View style={{ flex: 1 }} />
          ) : (
          <Tile
            title={item.name}
            subtitle={`${plural(item.furniture_count, 'rangement')} · ${plural(item.item_count, 'objet')}`}
            icon={roomIcon(item.name)}
            onPress={() => router.push({ pathname: '/room/[id]', params: { id: item.id } })}
            onLongPress={() => onLongPress(item)}
          />
          )
        }
      />
      <Fab inTabs label="Ajouter une pièce" onPress={() => setModal({ mode: 'create' })} />
      {promptModal}
    </View>
  );
}

const styles = {
  banner: {
    marginHorizontal: spacing.lg,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    borderBottomWidth: 4,
    borderBottomColor: colors.primaryDark,
  },
};
