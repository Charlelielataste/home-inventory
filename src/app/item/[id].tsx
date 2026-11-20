import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AutocompleteInput } from '@/components/autocomplete-input';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { CategoryPicker } from '@/components/item-form/category-picker';
import { ExpirySection } from '@/components/item-form/expiry-section';
import { resolveDuplicate } from '@/components/item-form/resolve-duplicate';
import { StockSection } from '@/components/item-form/stock-section';
import { useBarcodeLookup } from '@/components/item-form/use-barcode-lookup';
import { useStockFields } from '@/components/item-form/use-stock-fields';
import { LocationPicker } from '@/components/location-picker';
import {
  createItem,
  deleteItem,
  findDuplicate,
  type FurnitureWithRoom,
  getItem,
  type Item,
  itemBatches,
  type ItemInput,
  type KnownProduct,
  listAllFurniture,
  listKnownProducts,
  mergeIntoItem,
  rememberProduct,
  updateItem,
} from '@/db/queries';
import { batchesTotal, isSingleDate } from '@/lib/batches';
import {
  categoryCanFreeze,
  categoryHasExpiry,
  categoryIcon,
  customIcon,
  DEFAULT_CATEGORY,
  furnitureIconOf,
  isFreezer,
} from '@/lib/catalog';
import { isoToFr, todayIso } from '@/lib/dates';
import { giveFeedback } from '@/lib/feedback';
import { type FreezerFields, locationChange, type SavedFreezer } from '@/lib/freezer';
import { buildItemInput, fitLots, type Lots } from '@/lib/stock-form';
import { formatNumber, type MeasureUnit, parseCount } from '@/lib/units';
import { useKeyboardHeight } from '@/lib/use-keyboard-height';
import {
  Button,
  confirm,
  DialogHost,
  FieldLabel,
  Hint,
  IconButton,
  type IconName,
  ListRow,
  showError,
  TextField,
} from '@/ui/components';
import { colors, spacing } from '@/ui/theme';

export default function ItemScreen() {
  // `barcode`: scanned from the furniture screen (quick scan), looked up on open.
  // `shopping`: added from the Shopping tab, to buy: out of stock, no quantity,
  // expiry or freezing (only what helps to find it in the shop and put it away).
  const params = useLocalSearchParams<{ id: string; furnitureId?: string; barcode?: string; shopping?: string }>();
  const isNew = params.id === 'new';
  const toBuy = isNew && params.shopping === '1';
  const itemId = isNew ? null : Number(params.id);
  const initialFurnitureId = params.furnitureId ? Number(params.furnitureId) : null;
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();

  const [loaded, setLoaded] = useState(isNew);
  const [name, setName] = useState('');
  /** Custom icon (« Personnalisé »), null = from the category */
  const [icon, setIcon] = useState<IconName | null>(null);
  const stock = useStockFields();
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [minText, setMinText] = useState('');
  /** Expiry, freezing, batches (several dates; null = one date for all) */
  const [freezer, setFreezer] = useState<FreezerFields>({
    frozenAt: null,
    expiresText: '',
    lots: null,
    thawedUntil: null,
  });
  const changeFreezer = (patch: Partial<FreezerFields>) => setFreezer((f) => ({ ...f, ...patch }));
  const [notes, setNotes] = useState('');
  /** Expiry and freezing as of the last save (not just changed in this form); null = new item */
  const [saved, setSaved] = useState<(NonNullable<SavedFreezer> & { hasExpiry: boolean }) | null>(null);
  const [furnitureId, setFurnitureId] = useState<number | null>(initialFurnitureId);

  const [history, setHistory] = useState<KnownProduct[]>([]);
  const [allFurniture, setAllFurniture] = useState<FurnitureWithRoom[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const applyProduct = (
    p: {
      name: string;
      /** Size of one item; undefined = leave the size fields as they are */
      size?: number | null;
      size_unit?: MeasureUnit | null;
      category: string | null;
      subcategory?: string | null;
      icon?: string | null;
    },
    quantity?: number | null,
  ) => {
    setName(p.name);
    // Known product (history, barcode already scanned): its remembered icon, automatic otherwise
    if (p.icon !== undefined) setIcon(customIcon(p.icon));
    if (p.size_unit !== undefined) stock.setSize(p.size, p.size_unit);
    if (p.category) {
      setCategory(p.category);
      setSubcategory(p.subcategory ?? null);
    }
    if (quantity) stock.resetQuantity(quantity);
  };

  const scanner = useBarcodeLookup({
    initialBarcode: params.barcode,
    hasName: !!name.trim(),
    onProduct: applyProduct,
    onSamePack: stock.addItems,
    // Its dates were the previous product's
    onOtherProduct: () => changeFreezer({ lots: null }),
  });

  /** Fills the form with the saved item */
  const fill = useEffectEvent((item: Item) => {
    setName(item.name);
    setIcon(customIcon(item.icon));
    stock.load(item);
    setCategory(item.category ?? DEFAULT_CATEGORY);
    setSubcategory(item.subcategory);
    setMinText(item.min_quantity !== null ? formatNumber(item.min_quantity) : '');
    const batches = itemBatches(item);
    const fields = {
      frozenAt: item.frozen_at,
      expiresText: isoToFr(item.expires_at),
      lots: isSingleDate(batches, item.quantity) ? null : { batches, base: item.quantity },
    };
    setFreezer({ ...fields, thawedUntil: null });
    setSaved({ ...fields, hasExpiry: !!item.expires_at });
    setNotes(item.notes ?? '');
    scanner.setBarcode(item.barcode);
    setFurnitureId(item.furniture_id);
    setLoaded(true);
  });

  useEffect(() => {
    (async () => {
      setHistory(await listKnownProducts(db));
      const furniture = await listAllFurniture(db);
      setAllFurniture(furniture);
      // New item created directly in a freezer: checked by default
      const target = furniture.find((f) => f.id === initialFurnitureId);
      if (itemId === null && target && isFreezer(target.name)) setFreezer((f) => ({ ...f, frozenAt: todayIso() }));
      if (itemId !== null) {
        const item = await getItem(db, itemId);
        if (!item) return router.back();
        fill(item);
      }
    })();
  }, [db, itemId, initialFurnitureId]);

  const location = allFurniture.find((f) => f.id === furnitureId);
  const shownLots = fitLots(freezer.lots, stock.quantity);
  // Only shown when they make sense for the category (none for tools, no « Congelé » for
  // drugs…). Still shown when the saved item has a value, so it is never silently lost.
  const showExpiry = !toBuy && (categoryHasExpiry(category) || !!saved?.hasExpiry);
  const showFrozen = !toBuy && (categoryCanFreeze(category) || !!saved?.frozenAt);

  const changeLots = (lots: Lots) => {
    changeFreezer({ lots });
    // A date for more items than the stock holds: bought more
    const dated = batchesTotal(lots.batches);
    if (dated > (stock.quantity ?? 0)) stock.changeQuantity(String(dated));
  };

  const moveTo = (id: number) => {
    setFurnitureId(id);
    setPickerOpen(false);
    const target = allFurniture.find((f) => f.id === id);
    if (!target) return;
    const patch = locationChange(freezer, {
      fromFreezer: !!location && isFreezer(location.name),
      toFreezer: isFreezer(target.name),
      canFreeze: showFrozen,
      saved,
    });
    if (patch) changeFreezer(patch);
  };

  const finish = async (input: ItemInput) => {
    // The item is already saved: a failing autocomplete history must not report a failed save
    // (saving again would then create the item twice)
    await rememberProduct(db, {
      name: input.name,
      size: input.size,
      size_unit: input.size_unit,
      category: input.category,
      subcategory: input.subcategory,
      barcode: input.barcode,
      icon: input.icon,
      pack_quantity: input.barcode ? scanner.packQuantity : null,
    }).catch((e) => console.warn('rememberProduct failed', e));
    giveFeedback('success');
    router.back();
  };

  /** True once saved (the screen is closing), false when nothing was written. */
  const write = async (): Promise<boolean> => {
    const result = buildItemInput({
      name,
      icon,
      stock: stock.stock,
      sizeText: stock.sizeText,
      sizeUnit: stock.sizeUnit,
      category,
      subcategory,
      minText,
      expiresText: freezer.expiresText,
      lots: freezer.lots,
      frozenAt: freezer.frozenAt,
      notes,
      barcode: scanner.barcode,
      furnitureId,
      toBuy,
      showExpiry,
      showFrozen,
    });
    if ('error' in result) {
      showError(...result.error);
      return false;
    }
    const { input } = result;

    if (itemId !== null) {
      await updateItem(db, itemId, input);
    } else {
      const duplicate = await findDuplicate(db, input);
      const choice = duplicate ? await resolveDuplicate(duplicate, input, toBuy) : 'separate';
      if (choice === 'cancel') return false;
      if (choice === 'merge') await mergeIntoItem(db, duplicate!.id, input);
      else await createItem(db, input);
    }
    await finish(input);
    return true;
  };

  // A second tap while saving (or closing) would save twice and go back twice
  const saving = useRef(false);
  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    let done = false;
    try {
      done = await write();
    } catch (e) {
      // Writes run in a transaction: nothing was changed, the form keeps what was typed
      console.error('Item save failed', e);
      showError('Enregistrement impossible', 'Rien n’a été modifié. Réessaie dans un instant.');
    } finally {
      if (!done) saving.current = false;
    }
  };

  const remove = () =>
    itemId !== null &&
    confirm(`Supprimer « ${name} » ?`, '', 'Supprimer', async () => {
      await deleteItem(db, itemId);
      giveFeedback('delete');
      router.back();
    });

  if (!loaded) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={colors.text} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: toBuy ? 'À acheter' : isNew ? 'Nouvel objet' : 'Modifier',
          headerRight: () => (isNew ? null : <IconButton icon="trash" label="Supprimer" onPress={remove} />),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xl * 2 }}>
        {/* Name + scan */}
        <View style={{ gap: spacing.sm }}>
          <AutocompleteInput
            label="Nom"
            value={name}
            onChangeText={setName}
            icon={icon}
            onIconChange={setIcon}
            defaultIcon={categoryIcon(category, subcategory)}
            tintKey={category}
            onSelect={(s) => applyProduct(s)}
            history={history}
            autoFocus={isNew}
          />
          {/* Scan only when adding; once saved, the barcode is just shown (if any) */}
          {isNew && !toBuy && (
            <Button
              title={scanner.barcode ? `Code-barres : ${scanner.barcode}` : 'Scanner un code-barres'}
              icon="barcode"
              variant="secondary"
              onPress={scanner.openScanner}
            />
          )}
          {!isNew && !!scanner.barcode && (
            <Button title={`Code-barres : ${scanner.barcode}`} icon="barcode" variant="secondary" readOnly />
          )}
          {scanner.scan.loading && <ActivityIndicator color={colors.text} />}
          {!!scanner.scan.message && <Hint>{scanner.scan.message}</Hint>}
        </View>

        <CategoryPicker
          category={category}
          subcategory={subcategory}
          onChange={(c, sc) => {
            setCategory(c);
            setSubcategory(sc);
          }}
        />

        <StockSection fields={stock} toBuy={toBuy} />

        {/* Location */}
        <View style={{ gap: spacing.sm }}>
          <FieldLabel>Emplacement</FieldLabel>
          <ListRow
            title={location ? location.name : 'Choisir…'}
            subtitle={location?.room_name}
            icon={location ? furnitureIconOf(location) : 'location'}
            tintKey={location?.name}
            inset={false}
            chevron
            onPress={() => setPickerOpen(true)}
          />
          {toBuy && <Hint>Où le ranger une fois acheté.</Hint>}
        </View>

        <ExpirySection
          showExpiry={showExpiry}
          showFrozen={showFrozen}
          quantity={stock.quantity}
          expiresText={freezer.expiresText}
          onExpiresChange={(expiresText) => changeFreezer({ expiresText })}
          lots={shownLots}
          onLotsChange={changeLots}
          frozenAt={freezer.frozenAt}
          onFrozenChange={(frozen) => changeFreezer({ frozenAt: frozen ? todayIso() : null, thawedUntil: null })}
          thawedUntil={freezer.thawedUntil}
        />

        {/* Minimum stock */}
        {!toBuy && (
          <View style={{ gap: spacing.sm }}>
            <TextField
              label="Stock minimum (optionnel)"
              value={minText}
              onChangeText={setMinText}
              placeholder="Ex : 2"
              keyboardType="number-pad"
            />
            <Hint>{minQuantityHint(minText)}</Hint>
          </View>
        )}

        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Marque, taille, couleur, à qui c'est…"
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
      </ScrollView>

      <View
        style={{
          padding: spacing.lg,
          // Keyboard open: footer pushed just above it (the keyboard already covers the safe area)
          paddingBottom: (keyboardHeight > 0 ? keyboardHeight : insets.bottom) + spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          backgroundColor: colors.background,
        }}>
        <Button
          title={toBuy ? 'Ajouter à la liste' : isNew ? 'Ajouter' : 'Enregistrer'}
          icon="check"
          feedback={false}
          onPress={save}
        />
      </View>

      <BarcodeScanner visible={scanner.scannerOpen} onScanned={scanner.onScanned} onClose={scanner.closeScanner} />
      <LocationPicker
        visible={pickerOpen}
        furniture={allFurniture}
        selectedId={furnitureId}
        onSelect={moveTo}
        onClose={() => setPickerOpen(false)}
      />
      {/* Native modal screen: needs its own host on iOS (see DialogHost) */}
      <DialogHost />
    </View>
  );
}

/** Explains in plain words what the entered minimum stock does. */
function minQuantityHint(minText: string): string {
  const min = minText.trim() ? parseCount(minText) : null;
  if (min === null) {
    return 'Quand il en reste ce nombre ou moins, l’objet apparaît dans l’onglet Courses. Laisse vide pour ne pas être alerté.';
  }
  return `Tu seras alerté quand il en restera ${formatNumber(min)} ou moins.`;
}
