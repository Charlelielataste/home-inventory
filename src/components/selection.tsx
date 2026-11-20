import { useFocusEffect } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteItems, type Item } from '@/db/queries';
import { giveFeedback } from '@/lib/feedback';
import { plural } from '@/lib/text';
import { Button, confirm, IconButton } from '@/ui/components';
import { spacing } from '@/ui/theme';

/**
 * Selection mode of item lists: a long press on an item starts it, then a tap toggles
 * items. Unchecking the last one, the close button, the Android back button or
 * leaving the screen ends it.
 *
 * `items`: the items shown (after filtering). Only they can be checked: "Tout" checks
 * them, `chosen` lists the checked ones, and an item that leaves the list (deleted,
 * filtered out, reloaded) is unchecked. `onDone`: reload of the screen, called by `done()`
 * after an action on the selection.
 */
export function useSelection<T extends { id: number }>(items: T[], onDone?: () => void) {
  // Ids of the checked items, null = not selecting
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const active = !!selected;

  const clear = useCallback(() => setSelected(null), []);
  const start = (id: number) => setSelected(new Set([id]));
  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size ? next : null;
    });
  const chosen = selected ? items.filter((i) => selected.has(i.id)) : [];
  const allSelected = items.length > 0 && chosen.length === items.length;
  const toggleAll = () => setSelected(allSelected ? null : new Set(items.map((i) => i.id)));

  // Drops the ids no longer in the list (deleted, filtered out…); none left = selection over
  // (adjusted during render when the list changes, no effect)
  const idsKey = items.map((i) => i.id).join(',');
  const [listedKey, setListedKey] = useState(idsKey);
  if (idsKey !== listedKey) {
    setListedKey(idsKey);
    const ids = new Set(items.map((i) => i.id));
    if (selected && ![...selected].every((id) => ids.has(id))) {
      const next = new Set([...selected].filter((id) => ids.has(id)));
      setSelected(next.size ? next : null);
    }
  }

  // Android back button: leave selection mode instead of the screen
  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelected(null);
      return true;
    });
    return () => sub.remove();
  }, [active]);

  // Leaving the screen (other tab, pushed screen) ends it
  useFocusEffect(useCallback(() => clear, [clear]));

  /** After an action on the selection: leave selection mode and reload. */
  const done = () => {
    clear();
    onDone?.();
  };

  /** Header options while selecting (merge them into the screen's options). */
  const headerOptions = selected
    ? {
        title: plural(chosen.length, 'sélectionné', 'sélectionnés'),
        // Drops a custom title component the screen may set outside selection mode
        headerTitle: undefined,
        headerBackVisible: false,
        headerLeft: () => <IconButton icon="close" label="Annuler la sélection" feedback="close" onPress={clear} />,
        headerRight: () => (
          <Button
            title={allSelected ? 'Aucun' : 'Tout'}
            variant="ghost"
            feedback="tick"
            onPress={toggleAll}
            style={{ paddingVertical: 6, paddingHorizontal: 12 }}
          />
        ),
      }
    : undefined;

  /** Props for an item of the list (ItemRow, ItemCard). */
  const rowProps = (id: number) => ({
    onLongPress: () => start(id),
    selection: selected ? { selected: selected.has(id), onToggle: () => toggle(id) } : undefined,
  });

  return { selected, chosen, clear, done, headerOptions, rowProps };
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

/** "Supprimer (N)" of the selection bar: confirmation, deletion, then `onDone`. */
export function DeleteSelectedButton({
  items,
  onDone,
  noIcon,
}: {
  items: Pick<Item, 'id' | 'name'>[];
  onDone: () => void;
  /** Next to another action: text only, to fit */
  noIcon?: boolean;
}) {
  const db = useSQLiteContext();
  return (
    <Button
      title={`Supprimer (${items.length})`}
      icon={noIcon ? undefined : 'trash'}
      variant="danger"
      onPress={() => confirmDeleteItems(db, items, onDone)}
      style={{ flex: 1 }}
    />
  );
}

/** Confirmation listing the items (5 at most), then deletion. */
function confirmDeleteItems(db: SQLiteDatabase, items: Pick<Item, 'id' | 'name'>[], onDone: () => void) {
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
      giveFeedback('delete');
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
