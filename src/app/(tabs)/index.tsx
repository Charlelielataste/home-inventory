import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { RoomDrawer } from '@/components/room-drawer';
import { ROOM_GAP, RoomTile } from '@/components/room-tile';
import {
  createFurniture,
  createRoom,
  createRooms,
  deleteRoom,
  type FurnitureWithCount,
  listFurnitureWithCounts,
  listRooms,
  type RoomWithCounts,
  updateRoom,
} from '@/db/queries';
import { alertCounts, useAlerts } from '@/lib/alerts';
import {
  customIcon,
  DEFAULT_ROOMS,
  FURNITURE_SUGGESTIONS,
  furnitureIcon,
  ROOM_SUGGESTIONS,
  roomIcon,
} from '@/lib/catalog';
import { giveFeedback, withFeedback } from '@/lib/feedback';
import { plural, willBeDeleted } from '@/lib/text';
import { useReminderPrefs } from '@/lib/reminder-prefs';
import { useQuery } from '@/lib/use-query';
import {
  Button,
  confirm,
  EmptyState,
  Fab,
  Icon,
  type IconName,
  PromptModal,
  showEditDeleteMenu,
} from '@/ui/components';
import { colors, depth, font, radius, spacing } from '@/ui/theme';

type ModalState =
  | { mode: 'createRoom' }
  | { mode: 'editRoom'; room: RoomWithCounts }
  // Editing / deleting a piece of furniture: from its own screen (header menu)
  | { mode: 'createFurniture'; room: RoomWithCounts }
  | null;

export default function HomeScreen() {
  const { data, reload, db } = useQuery(async (db) => ({
    rooms: await listRooms(db),
    furniture: await listFurnitureWithCounts(db),
  }));
  const rooms = data?.rooms;
  const { alerts } = useAlerts();
  const { freezerMonths } = useReminderPrefs();
  const [modal, setModal] = useState<ModalState>(null);
  // Room whose drawer is open (kept until the drawer has slid out)
  const [drawerRoomId, setDrawerRoomId] = useState<number | null>(null);
  // Drawer to open once the prompt modal is gone (iOS: a modal cannot show while another is
  // closing, see onPromptDismissed); resolves to the room once it is saved
  const drawerAfterPrompt = useRef<Promise<number> | null>(null);
  const openDrawerAfterPrompt = (roomId: Promise<number>) => {
    if (Platform.OS === 'ios') drawerAfterPrompt.current = roomId;
    else void roomId.then(setDrawerRoomId);
  };
  const onPromptDismissed = () => {
    const roomId = drawerAfterPrompt.current;
    drawerAfterPrompt.current = null;
    void roomId?.then(setDrawerRoomId);
  };

  const [creatingDefaults, setCreatingDefaults] = useState(false);
  const createDefaults = async () => {
    if (creatingDefaults) return;
    setCreatingDefaults(true);
    await createRooms(db, DEFAULT_ROOMS);
    await reload();
    setCreatingDefaults(false);
  };

  const onSubmit = async (name: string, icon: IconName | null) => {
    // Closed first: a second tap while saving must not create the room twice
    setModal(null);
    if (modal?.mode === 'editRoom') await updateRoom(db, modal.room.id, name, icon);
    else {
      const roomId =
        modal?.mode === 'createFurniture'
          ? // Back to the room drawer, with the new piece of furniture in it
            createFurniture(db, modal.room.id, name, icon).then(() => modal.room.id)
          : createRoom(db, name, icon); // a new room: on to its furniture
      openDrawerAfterPrompt(roomId);
      await roomId;
    }
    reload();
  };

  const roomMenu = (room: RoomWithCounts) =>
    showEditDeleteMenu(
      room.name,
      () => setModal({ mode: 'editRoom', room }),
      () =>
        confirm(
          `Supprimer « ${room.name} » ?`,
          room.furniture_count
            ? room.item_count
              ? `${plural(room.furniture_count, 'rangement')} et ${plural(room.item_count, 'objet')} seront supprimés avec elle.`
              : `${willBeDeleted(room.furniture_count, 'rangement')} avec elle.`
            : '',
          'Supprimer',
          async () => {
            await deleteRoom(db, room.id);
            giveFeedback('delete');
            reload();
          },
        ),
    );

  const isFurnitureModal = modal?.mode === 'createFurniture';
  const usedFurnitureNames = [...new Set((data?.furniture ?? []).map((f) => f.name))];
  const promptModal = (
    <PromptModal
      visible={!!modal}
      title={
        modal?.mode === 'editRoom'
          ? 'Modifier la pièce'
          : modal?.mode === 'createFurniture'
            ? 'Nouveau rangement'
            : 'Nouvelle pièce'
      }
      initialValue={modal?.mode === 'editRoom' ? modal.room.name : ''}
      initialIcon={modal?.mode === 'editRoom' ? customIcon(modal.room.icon) : null}
      subtitle={modal?.mode === 'createFurniture' ? modal.room.name : undefined}
      placeholder={isFurnitureModal ? 'Ex : Frigo' : 'Ex : Cuisine'}
      suggestions={isFurnitureModal ? [...usedFurnitureNames, ...FURNITURE_SUGGESTIONS] : ROOM_SUGGESTIONS}
      defaultIcon={isFurnitureModal ? furnitureIcon : roomIcon}
      onSubmit={onSubmit}
      onClose={() => setModal(null)}
      onDismiss={onPromptDismissed}
    />
  );

  if (rooms && rooms.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <EmptyState
          icon="home"
          title="Ta maison est vide"
          text="Commence par ajouter les pièces de ton logement, puis les meubles et rangements de chaque pièce.">
          <View
            style={{
              gap: spacing.sm,
              alignSelf: 'stretch',
              marginTop: spacing.md,
            }}>
            <Button
              title="Créer les pièces de base"
              icon="sparkles"
              onPress={createDefaults}
              disabled={creatingDefaults}
            />
            <Button title="Ajouter une pièce" variant="secondary" onPress={() => setModal({ mode: 'createRoom' })} />
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
    {
      count: counts.soon,
      icon: 'hourglass',
      text: `${plural(counts.soon, 'produit')} à finir bientôt`,
      route: '/alerts',
    },
    {
      count: counts.frozen,
      icon: 'snowflake',
      text: `${plural(counts.frozen, 'produit')} au congélateur depuis ${freezerMonths} mois`,
      route: '/alerts',
    },
    {
      count: counts.partlyDated,
      icon: 'calendar',
      text: `${plural(counts.partlyDated, 'produit')} avec des dates manquantes`,
      route: '/undated',
    },
  ];
  const shown = lines.filter((l) => l.count > 0);
  // Not Map.groupBy: not guaranteed on Hermes
  const furnitureByRoom = new Map<number, FurnitureWithCount[]>();
  for (const f of data?.furniture ?? []) furnitureByRoom.set(f.room_id, [...(furnitureByRoom.get(f.room_id) ?? []), f]);

  return (
    <View style={{ flex: 1 }}>
      {/* A ScrollView, not a virtualized list: a handful of rooms */}
      <ScrollView contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: 110 }}>
        {
          // Only shown when there is something to act on
          shown.length ? (
            <View style={styles.banner}>
              {shown.map((line, i) => (
                <Pressable
                  key={line.icon}
                  accessibilityRole="button"
                  onPress={withFeedback('tap', () => router.navigate(line.route))}
                  style={({ pressed }) => [
                    styles.bannerLine,
                    i > 0 && styles.bannerDivider,
                    pressed && { opacity: 0.6 },
                  ]}>
                  <Icon name={line.icon} size={26} />
                  <Text style={[font.bodyStrong, { flex: 1, color: colors.onPrimary }]}>{line.text}</Text>
                  <Icon name="chevron-forward" size={16} color={colors.onPrimary} />
                </Pressable>
              ))}
            </View>
          ) : null
        }
        {/* Rooms = tiles, 2 per row; a tap opens the room drawer with its furniture */}
        <View style={styles.grid}>
          {(rooms ?? []).map((room) => (
            <RoomTile key={room.id} room={room} onOpen={() => setDrawerRoomId(room.id)} onMenu={() => roomMenu(room)} />
          ))}
        </View>
      </ScrollView>
      <Fab inTabs label="Ajouter une pièce" onPress={() => setModal({ mode: 'createRoom' })} />
      {promptModal}
      <RoomDrawer
        room={rooms?.find((r) => r.id === drawerRoomId) ?? null}
        furniture={drawerRoomId === null ? [] : (furnitureByRoom.get(drawerRoomId) ?? [])}
        onClosed={() => setDrawerRoomId(null)}
        onOpenFurniture={(f) => router.push({ pathname: '/furniture/[id]', params: { id: f.id } })}
        onAddFurniture={(room) => setModal({ mode: 'createFurniture', room })}
      />
    </View>
  );
}

type AlertLine = {
  count: number;
  icon: IconName;
  text: string;
  route: '/alerts' | '/undated';
};

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
  // Cells carry half the gap on each side (see RoomTile): the grid makes up for it
  grid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginHorizontal: spacing.lg - ROOM_GAP / 2,
    marginTop: spacing.lg - ROOM_GAP,
  },
};
