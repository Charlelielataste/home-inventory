import { useFocusEffect } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteItems, type Item } from '@/db/queries';
import { plural } from '@/lib/text';
import { Button, confirm, IconButton } from '@/ui/components';
import { spacing } from '@/ui/theme';

/**
 * Selection mode of item lists: a long press on an item starts it, then a tap toggles
 * items. Unchecking the last one, the close button, the Android back button or
 * leaving the screen ends it.
 */
export function useSelection(visibleIds: number[]) {
  // Ids of the checked items, null = not selecting
  const [selected, setSelected] = useState<Set<number> | null>(null);

  const clear = useCallback(() => setSelected(null), []);
  const start = (id: number) => setSelected(new Set([id]));
  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size ? next : null;
    });
  const allSelected = !!selected && visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next.size ? next : null;
    });

  // Android back button: leave selection mode instead of the screen
  useEffect(() => {
    if (!selected) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelected(null);
      return true;
    });
    return () => sub.remove();
  }, [selected]);

  // Leaving the screen (other tab, pushed screen) ends it
  useFocusEffect(useCallback(() => clear, [clear]));

  /** Header options while selecting (merge them into the screen's options). */
  const headerOptions = selected
    ? {
        title: plural(selected.size, 'sélectionné', 'sélectionnés'),
        headerBackVisible: false,
        headerLeft: () => <IconButton icon="close" label="Annuler la sélection" onPress={clear} />,
        headerRight: () => (
          <Button
            title={allSelected ? 'Aucun' : 'Tout'}
            variant="ghost"
            onPress={toggleAll}
            style={{ paddingVertical: 6, paddingHorizontal: 12 }}
          />
        ),
      }
    : undefined;

  /** Props for ItemRow. */
  const rowProps = (id: number) => ({
    onLongPress: () => start(id),
    selection: selected ? { selected: selected.has(id), onToggle: () => toggle(id) } : undefined,
  });

  return { selected, clear, headerOptions, rowProps };
}

/** Actions of the selection mode, at the bottom of the screen (in place of the Fab). */
export function SelectionBar({ children, inTabs }: { children: ReactNode; inTabs?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom: (inTabs ? 0 : insets.bottom) + spacing.lg,
        flexDirection: 'row',
        gap: spacing.sm,
      }}>
      {children}
    </View>
  );
}

/** Confirmation listing the items (5 at most), then deletion. */
export function confirmDeleteItems(db: SQLiteDatabase, items: Pick<Item, 'id' | 'name'>[], onDone: () => void) {
  if (items.length === 0) return;
  confirm(
    items.length > 1 ? `Supprimer ${items.length} objets ?` : `Supprimer « ${items[0].name} » ?`,
    items.length > 1 ? bulletList(items.map((i) => i.name)) : 'Cette action est définitive.',
    'Supprimer',
    async () => {
      await deleteItems(
        db,
        items.map((i) => i.id),
      );
      onDone();
    },
  );
}

/** "• A\n• B\n• et 3 autres" (5 lines at most). */
function bulletList(lines: string[]) {
  const shown = lines.slice(0, 5).map((l) => `• ${l}`);
  if (lines.length > 5) shown.push(`• et ${plural(lines.length - 5, 'autre')}`);
  return shown.join('\n');
}
