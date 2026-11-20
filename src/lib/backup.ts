import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { batchesFromDates, dumpAll, syncAllExpiry, wipeAll } from '@/db/queries';

import { todayIso } from './dates';
import { isMeasureUnit } from './units';

/**
 * Data only lives on the phone: the JSON export lets the user back it up
 * (Drive, email…) or move it to another device.
 */

/**
 * Backup file format. Testers keep their exports: bump it only when the format
 * changes, and keep importing every older version.
 */
const BACKUP_VERSION = 3;

/*
 * Versions:
 * 1: `items.unit` (pcs, portion, paquet, g, kg…) + `quantity` in that unit.
 * 2: `quantity` = number of items, optional size of one item (`size` + `size_unit`),
 *    `amount` = what is left (absent / null = all full).
 * 3: `item_batches` = expiry date per batch (lib/batches.ts); `items.expires_at` = earliest.
 *    Older backups: one batch per dated item, for its whole stock.
 */

type Backup = {
  app: 'inventaire-maison';
  version: number;
  exported_at: string;
  rooms: Record<string, unknown>[];
  furniture: Record<string, unknown>[];
  items: Record<string, unknown>[];
  /** v3+ */
  item_batches?: Record<string, unknown>[];
  known_products: Record<string, unknown>[];
};

export async function exportBackup(db: SQLiteDatabase) {
  const backup: Backup = {
    app: 'inventaire-maison',
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    ...(await dumpAll(db)),
  };

  const file = new File(Paths.cache, `inventaire-${todayIso()}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(backup, null, 2));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Le partage n'est pas disponible sur cet appareil.");
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: "Exporter l'inventaire",
  });
}

/** Opens the file picker and reads a backup. null if cancelled. */
export async function pickBackup(): Promise<Backup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const text = await new File(result.assets[0].uri).text();
  let data: Backup;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas un JSON valide.");
  }
  if (data?.app !== 'inventaire-maison' || !Array.isArray(data.rooms) || !Array.isArray(data.items)) {
    throw new Error("Ce fichier n'est pas une sauvegarde de l'inventaire.");
  }
  if (typeof data.version === 'number' && data.version > BACKUP_VERSION) {
    throw new Error("Cette sauvegarde vient d'une version plus récente de l'app : mets l'app à jour pour l'importer.");
  }
  return data;
}

/**
 * Inserts the known columns present in each row. Columns missing from the backup
 * (older format) are left out, so the table defaults apply instead of NULL.
 */
async function insertRows(db: SQLiteDatabase, table: string, columns: string[], rows: Record<string, unknown>[]) {
  for (const row of rows) {
    const present = columns.filter((c) => row[c] !== undefined);
    await db.runAsync(
      `INSERT INTO ${table} (${present.join(', ')}) VALUES (${present.map(() => '?').join(', ')})`,
      present.map((c) => row[c] as string | number | null),
    );
  }
}

type Row = Record<string, unknown>;

/** v1 item → v2: same conversion as migration 6 in schema.ts. */
function upgradeV1Item({ unit, ...row }: Row): Row {
  const quantity = typeof row.quantity === 'number' ? row.quantity : 1;
  const min = typeof row.min_quantity === 'number' ? row.min_quantity : null;
  if (isMeasureUnit(unit)) {
    return {
      ...row,
      size: quantity > 0 ? quantity : null,
      size_unit: quantity > 0 ? unit : null,
      quantity: quantity > 0 ? 1 : 0,
      min_quantity: min !== null ? 1 : null,
    };
  }
  return {
    ...row,
    quantity: quantity > 0 ? Math.max(1, Math.round(quantity)) : 0,
    min_quantity: min !== null ? Math.round(min) : null,
  };
}

/** v1 known product → v2: only measure units are kept, as the size unit. */
function upgradeV1Known({ unit, ...row }: Row): Row {
  return { ...row, size_unit: isMeasureUnit(unit) ? unit : null };
}

/** Replaces ALL current data with the backup's. */
export async function restoreBackup(db: SQLiteDatabase, data: Backup) {
  const v1 = (data.version ?? 1) < 2;
  const items = v1 ? data.items.map(upgradeV1Item) : data.items;
  const known = v1 ? (data.known_products ?? []).map(upgradeV1Known) : (data.known_products ?? []);
  await db.withTransactionAsync(async () => {
    await wipeAll(db);
    await insertRows(db, 'rooms', ['id', 'name', 'icon', 'position', 'created_at'], data.rooms);
    await insertRows(
      db,
      'furniture',
      ['id', 'room_id', 'name', 'icon', 'position', 'created_at'],
      data.furniture ?? [],
    );
    await insertRows(
      db,
      'items',
      // prettier-ignore
      [
        'id', 'furniture_id', 'name', 'icon', 'quantity', 'size', 'size_unit', 'amount', 'category', 'subcategory',
        'min_quantity', 'expires_at', 'frozen_at', 'frozen_snoozed_until', 'barcode', 'notes', 'created_at',
        'updated_at',
      ],
      items,
    );
    if (data.item_batches) {
      await insertRows(db, 'item_batches', ['id', 'item_id', 'quantity', 'expires_at'], data.item_batches);
    } else {
      await batchesFromDates(db);
    }
    await syncAllExpiry(db);
    await insertRows(
      db,
      'known_products',
      // prettier-ignore
      [
        'name', 'size', 'size_unit', 'category', 'subcategory', 'barcode', 'icon', 'pack_quantity', 'use_count',
        'last_used',
      ],
      known,
    );
  });
  return { rooms: data.rooms.length, furniture: data.furniture?.length ?? 0, items: data.items.length };
}
