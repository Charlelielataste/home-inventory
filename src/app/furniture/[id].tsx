import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Platform, View } from 'react-native';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { ItemCard } from '@/components/item-card';
import { DeleteSelectedButton, SelectionBar, useSelection } from '@/components/selection';
import {
  addPackByBarcode,
  deleteFurniture,
  getFurniture,
  listAllFurniture,
  listItems,
  updateFurniture,
} from '@/db/queries';
import { customIcon, FURNITURE_SUGGESTIONS, furnitureIcon } from '@/lib/catalog';
import { giveFeedback } from '@/lib/feedback';
import { matchesItem, normalize, willBeDeleted } from '@/lib/text';
import { formatStock } from '@/lib/units';
import { useQuery } from '@/lib/use-query';
import {
  Button,
  confirm,
  EmptyState,
  HeaderTitle,
  Fab,
  IconButton,
  PromptModal,
  Separator,
  showEditDeleteMenu,
  TextField,
} from '@/ui/components';
import { spacing } from '@/ui/theme';

export default function FurnitureScreen() {
  const furnitureId = Number(useLocalSearchParams<{ id: string }>().id);
  const { data, reload, db } = useQuery(
    async (db) => ({
      furniture: await getFurniture(db, furnitureId),
      items: await listItems(db, furnitureId),
    }),
    furnitureId,
  );
  const [filter, setFilter] = useState('');
  /** Rename modal open, with the furniture names of the house (suggestions), loaded on opening */
  const [renaming, setRenaming] = useState<string[] | null>(null);
  const startRenaming = async () => setRenaming([...new Set((await listAllFurniture(db)).map((f) => f.name))]);
  const [scanning, setScanning] = useState(false);
  /** Result of the last quick scan, shown over the camera */
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  /** iOS: product to open once the camera is fully closed (two modals cannot overlap) */
  const pendingCode = useRef<string | null>(null);

  const furniture = data?.furniture;
  const items = data?.items ?? [];
  const q = normalize(filter);
  const visible = q ? items.filter((i) => matchesItem(i, q)) : items;

  // Only the items shown (filter) can be selected
  const { selected, chosen, done, headerOptions, rowProps } = useSelection(visible, reload);

  const addItem = () => router.push({ pathname: '/item/[id]', params: { id: 'new', furnitureId } });

  /**
   * Quick scan: a product already in this furniture gets one more pack (+1, +6 for a pack
   * of 6) and the camera stays open for the next one; a product not there yet opens the
   * item form, filled in from the barcode.
   */
  const startQuickScan = () => {
    setScanStatus(null);
    setScanning(true);
  };
  const openNewItem = (code: string) =>
    router.push({ pathname: '/item/[id]', params: { id: 'new', furnitureId, barcode: code } });
  const onScannerDismissed = () => {
    const code = pendingCode.current;
    pendingCode.current = null;
    if (code) openNewItem(code);
  };
  // The scanner is silent here (`feedback={false}`): one sound per scan, for its outcome
  const onQuickScan = async (code: string) => {
    try {
      const added = await addPackByBarcode(db, furnitureId, code);
      if (!added) {
        giveFeedback('scan');
        setScanning(false);
        if (Platform.OS === 'ios') pendingCode.current = code;
        else openNewItem(code);
        return;
      }
      giveFeedback('success');
      setScanStatus(`${added.item.name} : +${added.pack} → ${formatStock(added.item, { pieces: true })}`);
      reload();
    } catch {
      // Shown over the camera: a dialog would be hidden behind the modal on iOS
      giveFeedback('error');
      setScanStatus('Impossible d’ajouter ce produit, réessaie.');
    }
  };

  const menu = () =>
    furniture &&
    showEditDeleteMenu(furniture.name, startRenaming, () =>
      confirm(
        `Supprimer « ${furniture.name} » ?`,
        items.length ? `${willBeDeleted(items.length, 'objet')} avec lui.` : '',
        'Supprimer',
        async () => {
          await deleteFurniture(db, furnitureId);
          giveFeedback('delete');
          router.back();
        },
      ),
    );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={
          headerOptions ?? {
            title: furniture?.name ?? '',
            // The room screen is gone: remind which room this furniture is in
            headerTitle: () => furniture && <HeaderTitle title={furniture.name} subtitle={furniture.room_name} />,
            headerBackVisible: true,
            headerLeft: undefined,
            headerRight: () => <IconButton icon="more" label="Options du rangement" onPress={menu} />,
          }
        }
      />
      {data && items.length === 0 ? (
        <EmptyState
          icon="box"
          title="Rien ici pour l'instant"
          text={furniture ? `Ajoute ce que contient « ${furniture.name} » (${furniture.room_name}).` : undefined}>
          <Button title="Ajouter un objet" onPress={addItem} />
          <Button title="Scanner un produit" icon="barcode" variant="secondary" onPress={startQuickScan} />
        </EmptyState>
      ) : (
        <FlatList
          data={visible}
          extraData={selected}
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
          renderItem={({ item }) => <ItemCard item={item} onChanged={reload} {...rowProps(item.id)} />}
        />
      )}
      {selected ? (
        <SelectionBar>
          <DeleteSelectedButton items={chosen} onDone={done} />
        </SelectionBar>
      ) : (
        items.length > 0 && (
          <>
            <Fab secondary icon="barcode" label="Scan rapide : ajouter des produits" onPress={startQuickScan} />
            <Fab label="Ajouter un objet" onPress={addItem} />
          </>
        )
      )}
      <BarcodeScanner
        visible={scanning}
        continuous
        feedback={false}
        status={scanStatus}
        hint="Scanne pour ajouter au stock"
        onScanned={onQuickScan}
        onClose={() => setScanning(false)}
        onDismiss={onScannerDismissed}
      />
      <PromptModal
        visible={!!renaming}
        title="Modifier le rangement"
        initialValue={furniture?.name}
        initialIcon={customIcon(furniture?.icon)}
        placeholder="Ex : Frigo"
        suggestions={[...(renaming ?? []), ...FURNITURE_SUGGESTIONS]}
        defaultIcon={furnitureIcon}
        onSubmit={async (name, icon) => {
          // Closed first: a second tap while saving must not submit again
          setRenaming(null);
          await updateFurniture(db, furnitureId, name, icon);
          reload();
        }}
        onClose={() => setRenaming(null)}
      />
    </View>
  );
}
