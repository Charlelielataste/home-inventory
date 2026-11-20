import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RoomWithCounts } from '@/db/queries';
import { roomIconOf } from '@/lib/catalog';
import { withFeedback } from '@/lib/feedback';
import { plural } from '@/lib/text';
import { IconTile } from '@/ui/components';
import { colors, depth, font, radius, spacing, sunk } from '@/ui/theme';

/** Space between two tiles (and between rows of the grid) */
export const ROOM_GAP = spacing.md;

/** « 2 rangements · 5 objets » */
export function roomSummary(room: RoomWithCounts): string {
  return room.furniture_count
    ? [plural(room.furniture_count, 'rangement'), ...(room.item_count ? [plural(room.item_count, 'objet')] : [])].join(
        ' · ',
      )
    : 'Aucun rangement';
}

/**
 * A room of the home grid (half width): big icon, name, summary. A tap opens its drawer
 * (RoomDrawer, its furniture), a long press the edit / delete menu.
 */
export function RoomTile({ room, onOpen, onMenu }: { room: RoomWithCounts; onOpen: () => void; onMenu: () => void }) {
  const summary = roomSummary(room);
  return (
    <View style={styles.cell}>
      <Pressable
        onPress={withFeedback('open', onOpen)}
        // Edit / delete: long press, to keep the tile free of buttons
        onLongPress={withFeedback('hold', onMenu)}
        accessibilityRole="button"
        accessibilityLabel={`${room.name}, ${summary}`}
        accessibilityHint="Affiche les rangements. Appui long : modifier ou supprimer."
        accessibilityActions={[{ name: 'longpress', label: 'Modifier ou supprimer' }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onMenu()}
        style={({ pressed }) => [styles.tile, pressed && sunk(3, colors.edge)]}>
        <IconTile icon={roomIconOf(room)} size={52} tintKey={room.name} />
        <View style={{ gap: 2 }}>
          <Text style={[font.heading, styles.name]} numberOfLines={1}>
            {room.name}
          </Text>
          <Text style={[font.small, styles.summary]} numberOfLines={2}>
            {summary}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Half the gap on each side: two cells side by side are one gap apart (the grid makes up for it)
  cell: { width: '50%', paddingHorizontal: ROOM_GAP / 2, paddingTop: ROOM_GAP },
  tile: {
    // Tiles of a row share the height of the tallest one
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.edge,
    backgroundColor: colors.surface,
    ...depth(3, colors.edge),
  },
  name: { fontSize: 17, lineHeight: 22 },
  summary: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
});
