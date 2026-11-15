import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import {
  createRoom,
  createRooms,
  deleteRoom,
  listRooms,
  renameRoom,
  type RoomWithCounts,
} from '@/db/queries';
import { alertCounts, useAlerts } from '@/lib/alerts';
import { DEFAULT_ROOMS, ROOM_SUGGESTIONS, roomIcon } from '@/lib/catalog';
import { FREEZER_WARNING_MONTHS } from '@/lib/dates';
import { plural } from '@/lib/text';
import { useQuery } from '@/lib/use-query';
import {
  Button,
  confirm,
  EmptyState,
  Fab,
  Icon,
  type IconName,
  PromptModal,
  showRenameDeleteMenu,
  Tile,
} from '@/ui/components';
import { colors, depth, font, radius, spacing } from '@/ui/theme';

export default function HomeScreen() {
  const { data: rooms, reload, db } = useQuery(listRooms);
  const { alerts } = useAlerts();
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
            ? room.item_count
              ? `${plural(room.furniture_count, 'rangement')} et ${plural(room.item_count, 'objet')} seront supprimés avec elle.`
              : `${plural(room.furniture_count, 'rangement')} ${room.furniture_count > 1 ? 'seront supprimés' : 'sera supprimé'} avec elle.`
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

  const counts = alertCounts(alerts);
  const lines: AlertLine[] = [
    {
      count: counts.expired,
      icon: 'warning',
      text: plural(counts.expired, 'produit périmé', 'produits périmés'),
      route: '/alerts',
    },
    { count: counts.soon, icon: 'hourglass', text: `${plural(counts.soon, 'produit')} à finir bientôt`, route: '/alerts' },
    {
      count: counts.frozen,
      icon: 'snowflake',
      text: `${plural(counts.frozen, 'produit')} au congélateur depuis ${FREEZER_WARNING_MONTHS} mois`,
      route: '/alerts',
    },
    { count: counts.toBuy, icon: 'cart', text: `${plural(counts.toBuy, 'produit')} à racheter`, route: '/shopping' },
  ];
  const shown = lines.filter((l) => l.count > 0);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        // Odd number of rooms: an empty cell keeps the last tile half-width
        data={[...(rooms ?? []), ...((rooms?.length ?? 0) % 2 ? [null] : [])]}
        keyExtractor={(r) => String(r?.id ?? 'filler')}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ gap: spacing.md, paddingTop: spacing.lg, paddingBottom: 110 }}
        ListHeaderComponent={
          // Only shown when there is something to act on
          shown.length ? (
            <View style={styles.banner}>
              {shown.map((line, i) => (
                <Pressable
                  key={line.icon}
                  accessibilityRole="button"
                  onPress={() => router.navigate(line.route)}
                  style={({ pressed }) => [styles.bannerLine, i > 0 && styles.bannerDivider, pressed && { opacity: 0.6 }]}>
                  <Icon name={line.icon} size={26} />
                  <Text style={[font.bodyStrong, { flex: 1, color: colors.onPrimary }]}>{line.text}</Text>
                  <Icon name="chevron-forward" size={16} color={colors.onPrimary} />
                </Pressable>
              ))}
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

type AlertLine = { count: number; icon: IconName; text: string; route: '/alerts' | '/shopping' };

const styles = {
  banner: {
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    ...depth(4, colors.primaryDark),
  },
  bannerLine: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  bannerDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.primaryDark,
  },
};
