import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AutocompleteInput } from '@/components/autocomplete-input';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { LocationPicker } from '@/components/location-picker';
import {
  createItem,
  deleteItem,
  findDuplicate,
  findKnownByBarcode,
  type FurnitureWithRoom,
  getItem,
  type ItemInput,
  type KnownProduct,
  listAllFurniture,
  listKnownProducts,
  mergeIntoItem,
  rememberProduct,
  updateItem,
} from '@/db/queries';
import { CATEGORIES, categoryIcon, furnitureIcon, isFreezer, SUBCATEGORIES } from '@/lib/catalog';
import {
  addToToday,
  daysUntil,
  describeExpiry,
  FREEZER_WARNING_MONTHS,
  frToIso,
  isoToFr,
  THAWED_SHELF_DAYS,
  todayIso,
} from '@/lib/dates';
import { lookupBarcode } from '@/lib/openfoodfacts';
import { capitalize } from '@/lib/text';
import { formatNumber, formatQuantity, getUnit, isUnitKey, parseNumber, type UnitKey, UNITS } from '@/lib/units';
import { Button, Checkbox, Chip, ChipRow, confirm, DialogHost, IconButton, ListRow, showDialog, showMessage, TextField } from '@/ui/components';
import { colors, font, fonts, spacing } from '@/ui/theme';

const EXPIRY_SHORTCUTS: [string, Parameters<typeof addToToday>[0]][] = [
  ['+3 j', { days: 3 }],
  ['+1 sem.', { days: 7 }],
  ['+1 mois', { months: 1 }],
  ['+6 mois', { months: 6 }],
  ['+1 an', { years: 1 }],
];

type ScanStatus = { loading: boolean; message?: string };

export default function ItemScreen() {
  const params = useLocalSearchParams<{ id: string; furnitureId?: string }>();
  const isNew = params.id === 'new';
  const itemId = isNew ? null : Number(params.id);
  const initialFurnitureId = params.furnitureId ? Number(params.furnitureId) : null;
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();

  const [loaded, setLoaded] = useState(isNew);
  const [name, setName] = useState('');
  const [quantityText, setQuantityText] = useState('1');
  const [unit, setUnit] = useState<UnitKey>('pcs');
  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [minText, setMinText] = useState('');
  const [expiresText, setExpiresText] = useState('');
  const [frozenAt, setFrozenAt] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  /** Message shown after taking the item out of the freezer. */
  const [thawNote, setThawNote] = useState<string | null>(null);
  /** Frozen as of the last save (not just checked in this form). */
  const [savedFrozen, setSavedFrozen] = useState(false);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [furnitureId, setFurnitureId] = useState<number | null>(
    params.furnitureId ? Number(params.furnitureId) : null,
  );

  const [history, setHistory] = useState<KnownProduct[]>([]);
  const [allFurniture, setAllFurniture] = useState<FurnitureWithRoom[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scan, setScan] = useState<ScanStatus>({ loading: false });

  useEffect(() => {
    (async () => {
      setHistory(await listKnownProducts(db));
      const furniture = await listAllFurniture(db);
      setAllFurniture(furniture);
      // New item created directly in a freezer: checked by default
      const target = furniture.find((f) => f.id === initialFurnitureId);
      if (itemId === null && target && isFreezer(target.name)) setFrozenAt(todayIso());
      if (itemId !== null) {
        const item = await getItem(db, itemId);
        if (!item) return router.back();
        setName(item.name);
        setQuantityText(formatNumber(item.quantity));
        setUnit(isUnitKey(item.unit) ? item.unit : 'pcs');
        setCategory(item.category);
        setSubcategory(item.subcategory);
        setMinText(item.min_quantity !== null ? formatNumber(item.min_quantity) : '');
        setExpiresText(isoToFr(item.expires_at));
        setFrozenAt(item.frozen_at);
        setSavedFrozen(!!item.frozen_at);
        setNotes(item.notes ?? '');
        setBarcode(item.barcode);
        setFurnitureId(item.furniture_id);
        setLoaded(true);
      }
    })();
  }, [db, itemId, initialFurnitureId]);

  const location = allFurniture.find((f) => f.id === furnitureId);
  const step = getUnit(unit).step;
  const expiresIso = expiresText.trim() ? frToIso(expiresText) : null;

  const bumpQuantity = (delta: number) => {
    const current = parseNumber(quantityText) ?? 0;
    setQuantityText(formatNumber(Math.max(0, current + delta)));
  };

  /**
   * Changes the unit. When creating, if the quantity still equals the previous unit's step
   * (the default), use the new unit's step: "100 g" rather than "1 g".
   */
  const changeUnit = (next: UnitKey) => {
    setUnit(next);
    if (isNew && parseNumber(quantityText) === getUnit(unit).step) {
      setQuantityText(formatNumber(getUnit(next).step));
    }
  };

  const applyProduct = (
    p: { name: string; unit: UnitKey | null; category: string | null; subcategory?: string | null },
    quantity?: number | null,
  ) => {
    setName(p.name);
    if (p.unit) changeUnit(p.unit);
    if (p.category) {
      setCategory(p.category);
      setSubcategory(p.subcategory ?? null);
    }
    if (quantity) setQuantityText(formatNumber(quantity));
  };

  const onScanned = async (code: string) => {
    setScannerOpen(false);
    setBarcode(code);
    setScan({ loading: true });

    // 1. Already scanned before: works offline
    const known = await findKnownByBarcode(db, code);
    if (known) {
      applyProduct(known);
      setScan({ loading: false, message: 'Produit reconnu (déjà scanné).' });
      return;
    }
    // 2. Open Food Facts & co open databases
    try {
      const product = await lookupBarcode(code);
      if (product) {
        applyProduct(product, product.quantity);
        setScan({ loading: false, message: 'Produit trouvé sur Open Food Facts.' });
      } else {
        setScan({
          loading: false,
          message: 'Produit inconnu : saisis son nom, il sera associé à ce code-barres pour la prochaine fois.',
        });
      }
    } catch {
      setScan({
        loading: false,
        message: 'Pas de connexion : saisis le nom, le code-barres sera mémorisé.',
      });
    }
  };

  const finish = async (input: ItemInput) => {
    await rememberProduct(db, {
      name: input.name,
      unit: input.unit,
      category: input.category,
      subcategory: input.subcategory,
      barcode: input.barcode,
    });
    router.back();
  };

  const save = async () => {
    const cleanName = capitalize(name);
    const quantity = parseNumber(quantityText);
    const min = minText.trim() ? parseNumber(minText) : null;

    if (!cleanName) return showMessage('Nom manquant', "Donne un nom à l'objet.");
    if (quantity === null || quantity < 0) return showMessage('Quantité invalide', 'Saisis un nombre positif.');
    if (minText.trim() && (min === null || min < 0)) return showMessage('Seuil invalide', 'Saisis un nombre positif.');
    if (expiresText.trim() && !expiresIso) return showMessage('Date invalide', 'Format attendu : JJ/MM/AAAA.');
    if (!furnitureId) return showMessage('Emplacement manquant', 'Choisis où est rangé cet objet.');

    const input: ItemInput = {
      furniture_id: furnitureId,
      name: cleanName,
      quantity,
      unit,
      category,
      subcategory: category ? subcategory : null,
      min_quantity: min,
      expires_at: expiresIso,
      frozen_at: frozenAt,
      barcode,
      notes: notes.trim() || null,
    };

    if (itemId !== null) {
      await updateItem(db, itemId, input);
      return finish(input);
    }

    const duplicate = await findDuplicate(db, furnitureId, cleanName, unit, !!frozenAt);
    if (!duplicate) {
      await createItem(db, input);
      return finish(input);
    }
    showDialog({
      title: 'Déjà présent',
      message: `« ${duplicate.name} » est déjà ici (${formatQuantity(duplicate.quantity, duplicate.unit)}). Ajouter ${formatQuantity(quantity, unit)} au stock existant ?`,
      buttons: [
        {
          text: 'Additionner',
          style: 'primary',
          onPress: async () => {
            await mergeIntoItem(db, duplicate.id, input);
            finish(input);
          },
        },
        {
          text: 'Créer à part',
          onPress: async () => {
            await createItem(db, input);
            finish(input);
          },
        },
        { text: 'Annuler', style: 'cancel' },
      ],
    });
  };

  const remove = () =>
    itemId !== null &&
    confirm(`Supprimer « ${name} » ?`, '', 'Supprimer', async () => {
      await deleteItem(db, itemId);
      router.back();
    });

  if (!loaded) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={colors.text} />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
      <Stack.Screen
        options={{
          title: isNew ? 'Nouvel objet' : 'Modifier',
          headerRight: () =>
            isNew ? null : <IconButton icon="trash" label="Supprimer" onPress={remove} />,
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
            onSelect={(s) => applyProduct(s)}
            history={history}
            autoFocus={isNew}
          />
          <Button
            title={barcode ? `Code-barres : ${barcode}` : 'Scanner un code-barres'}
            icon="barcode"
            variant="secondary"
            onPress={() => setScannerOpen(true)}
          />
          {scan.loading && <ActivityIndicator color={colors.text} />}
          {!!scan.message && <Text style={[font.small, { color: colors.textMuted }]}>{scan.message}</Text>}
        </View>

        {/* Quantity + unit */}
        <View style={{ gap: spacing.sm }}>
          <Text style={labelStyle}>Quantité</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <IconButton icon="remove" label="Moins" variant="filled" onPress={() => bumpQuantity(-step)} />
            <View style={{ flex: 1 }}>
              <TextField
                value={quantityText}
                onChangeText={setQuantityText}
                keyboardType="decimal-pad"
                selectTextOnFocus
                style={{ textAlign: 'center', fontSize: 22, fontFamily: fonts.bold }}
              />
            </View>
            <IconButton icon="add" label="Plus" variant="filled" onPress={() => bumpQuantity(step)} />
          </View>
          <ChipRow>
            {UNITS.map((u) => (
              <Chip key={u.key} label={u.label} selected={unit === u.key} onPress={() => changeUnit(u.key)} />
            ))}
          </ChipRow>
        </View>

        {/* Location */}
        <View style={{ gap: spacing.sm }}>
          <Text style={labelStyle}>Emplacement</Text>
          <ListRow
            title={location ? location.name : 'Choisir…'}
            subtitle={location?.room_name}
            icon={location ? furnitureIcon(location.name) : 'location'}
            tintKey={location?.name}
            inset={false}
            chevron
            onPress={() => setPickerOpen(true)}
          />
        </View>

        {/* Category */}
        <View style={{ gap: spacing.sm }}>
          <Text style={labelStyle}>Catégorie</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={c}
                icon={categoryIcon(c, null)}
                selected={category === c}
                onPress={() => {
                  setCategory(category === c ? null : c);
                  setSubcategory(null);
                }}
              />
            ))}
          </View>
        </View>

        {/* Subcategory (depends on the chosen category) */}
        {!!category && (SUBCATEGORIES[category]?.length ?? 0) > 0 && (
          <View style={{ gap: spacing.sm }}>
            <Text style={labelStyle}>Sous-catégorie (optionnel)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {SUBCATEGORIES[category].map((sc) => (
                <Chip
                  key={sc}
                  label={sc}
                  icon={categoryIcon(category, sc)}
                  selected={subcategory === sc}
                  onPress={() => setSubcategory(subcategory === sc ? null : sc)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Expiry */}
        <View style={{ gap: spacing.sm }}>
          <TextField
            label="Date de péremption (optionnel)"
            value={expiresText}
            onChangeText={setExpiresText}
            placeholder="JJ/MM/AAAA"
            keyboardType="numbers-and-punctuation"
          />
          <ChipRow>
            {EXPIRY_SHORTCUTS.map(([label, amount]) => (
              <Chip key={label} label={label} onPress={() => setExpiresText(isoToFr(addToToday(amount)))} />
            ))}
            {!!expiresText && <Chip label="Aucune" onPress={() => setExpiresText('')} />}
          </ChipRow>
          {expiresIso && !frozenAt && (
            <Text style={[font.small, { color: colors.textMuted }]}>{describeExpiry(expiresIso)}</Text>
          )}
          <Checkbox
            label="Congelé"
            checked={!!frozenAt}
            onChange={(v) => {
              setFrozenAt(v ? todayIso() : null);
              setThawNote(null);
            }}
          />
          <Text style={[font.small, { color: colors.textMuted }]}>
            {frozenAt
              ? frozenHint(frozenAt)
              : `À cocher si tu l’as mis toi-même au congélateur : la péremption n’est plus surveillée et tu seras prévenu après ${FREEZER_WARNING_MONTHS} mois. Acheté déjà surgelé ? Choisis plutôt la catégorie « Surgelés ».`}
          </Text>
          {!!thawNote && <Text style={[font.small, { color: colors.textMuted }]}>{thawNote}</Text>}
        </View>

        {/* Minimum stock */}
        <View style={{ gap: spacing.sm }}>
          <TextField
            label={`Stock minimum (${getUnit(unit).symbol ?? getUnit(unit).plural}, optionnel)`}
            value={minText}
            onChangeText={setMinText}
            placeholder="Ex : 2"
            keyboardType="decimal-pad"
          />
          <Text style={[font.small, { color: colors.textMuted }]}>
            {minQuantityHint(minText, unit)}
          </Text>
        </View>

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
          paddingBottom: insets.bottom + spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          backgroundColor: colors.background,
        }}>
        <Button title={isNew ? 'Ajouter' : 'Enregistrer'} icon="check" onPress={save} />
      </View>

      <BarcodeScanner visible={scannerOpen} onScanned={onScanned} onClose={() => setScannerOpen(false)} />
      <LocationPicker
        visible={pickerOpen}
        furniture={allFurniture}
        selectedId={furnitureId}
        onSelect={(id) => {
          setFurnitureId(id);
          const target = allFurniture.find((f) => f.id === id);
          if (target && isFreezer(target.name) && !frozenAt) {
            // Moved into a freezer: automatically marked as frozen
            setFrozenAt(todayIso());
            setThawNote(null);
          } else if (target && !isFreezer(target.name) && frozenAt && location && isFreezer(location.name)) {
            setFrozenAt(null);
            // Not saved as frozen yet: just a location change,
            // keep the expiry date that was entered.
            if (!savedFrozen) return setPickerOpen(false);
            // Taken out of the freezer: thawed, eat soon
            const limit = addToToday({ days: THAWED_SHELF_DAYS });
            setExpiresText(isoToFr(limit));
            setThawNote(
              `Sorti du congélateur : date de péremption mise au ${isoToFr(limit)} (${THAWED_SHELF_DAYS} jours après décongélation). Modifie-la si besoin.`,
            );
          }
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
      {/* Native modal screen: needs its own host on iOS (see DialogHost) */}
      <DialogHost />
    </KeyboardAvoidingView>
  );
}

const labelStyle = { ...font.label, color: colors.textMuted };

/** Explains in plain words what the entered minimum stock does. */
function minQuantityHint(minText: string, unit: string): string {
  const min = minText.trim() ? parseNumber(minText) : null;
  if (min === null || min < 0) {
    return 'Quand il en reste ce nombre ou moins, l’objet apparaît dans l’onglet Courses. Laisse vide pour ne pas être alerté.';
  }
  return `Tu seras alerté quand il restera ${formatQuantity(min, unit)} ou moins.`;
}

/** "Congelé le 12/11/2026 (il y a 3 j) · …" */
function frozenHint(frozenAt: string): string {
  const days = -daysUntil(frozenAt);
  const since = days <= 0 ? "aujourd’hui" : `il y a ${days} j`;
  return `Congelé le ${isoToFr(frozenAt)} (${since}). La date de péremption n’est plus surveillée ; tu seras prévenu après ${FREEZER_WARNING_MONTHS} mois.`;
}
