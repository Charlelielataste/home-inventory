import { Modal, SectionList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FurnitureWithRoom } from '@/db/queries';
import { furnitureIcon } from '@/lib/catalog';
import { Icon, IconButton, ListRow, SectionTitle, Separator } from '@/ui/components';
import { colors, font, spacing } from '@/ui/theme';

type Props = {
  visible: boolean;
  furniture: FurnitureWithRoom[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onClose: () => void;
};

/** Picks an item's furniture (also used to move it). */
export function LocationPicker({ visible, furniture, selectedId, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();

  const sections: { title: string; data: FurnitureWithRoom[] }[] = [];
  for (const f of furniture) {
    const last = sections[sections.length - 1];
    if (last?.title === f.room_name) last.data.push(f);
    else sections.push({ title: f.room_name, data: [f] });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.lg,
          }}>
          <Text style={font.title}>Emplacement</Text>
          <IconButton icon="close" label="Fermer" onPress={onClose} />
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(f) => String(f.id)}
          stickySectionHeadersEnabled
          ItemSeparatorComponent={Separator}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
          renderSectionHeader={({ section }) => <SectionTitle>{section.title}</SectionTitle>}
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              icon={furnitureIcon(item.name)}
              tintKey={item.name}
              onPress={() => onSelect(item.id)}
              right={
                item.id === selectedId ? <Icon name="check" size={22} color={colors.primary} /> : undefined
              }
            />
          )}
        />
      </View>
    </Modal>
  );
}
