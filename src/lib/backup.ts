import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { WIPE_ALL_SQL } from '@/db/queries';

import { todayIso } from './dates';

/**
 * Data only lives on the phone: the JSON export lets the user back it up
 * (Drive, email…) or move it to another device.
 */

type Backup = {
  app: 'inventaire-maison';
  version: 1;
  exported_at: string;
  rooms: Record<string, unknown>[];
  furniture: Record<string, unknown>[];
  items: Record<string, unknown>[];
  known_products: Record<string, unknown>[];
};

export async function exportBackup(db: SQLiteDatabase) {
  const backup: Backup = {
    app: 'inventaire-maison',
    version: 1,
    exported_at: new Date().toISOString(),
    rooms: await db.getAllAsync('SELECT * FROM rooms'),
    furniture: await db.getAllAsync('SELECT * FROM furniture'),
    items: await db.getAllAsync('SELECT * FROM items'),
    known_products: await db.getAllAsync('SELECT * FROM known_products'),
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
  return data;
}

async function insertRows(db: SQLiteDatabase, table: string, columns: string[], rows: Record<string, unknown>[]) {
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
  for (const row of rows) {
    await db.runAsync(
      sql,
      columns.map((c) => (row[c] ?? null) as string | number | null),
    );
  }
}

/** Replaces ALL current data with the backup's. */
export async function restoreBackup(db: SQLiteDatabase, data: Backup) {
  await db.withTransactionAsync(async () => {
    await db.execAsync(WIPE_ALL_SQL);
    await insertRows(db, 'rooms', ['id', 'name', 'position', 'created_at'], data.rooms);
    await insertRows(db, 'furniture', ['id', 'room_id', 'name', 'position', 'created_at'], data.furniture ?? []);
    await insertRows(
      db,
      'items',
      [
        'id', 'furniture_id', 'name', 'quantity', 'unit', 'category', 'subcategory', 'min_quantity',
        'expires_at', 'frozen_at', 'frozen_snoozed_until', 'barcode', 'notes', 'created_at', 'updated_at',
      ],
      data.items,
    );
    await insertRows(
      db,
      'known_products',
      ['name', 'unit', 'category', 'subcategory', 'barcode', 'use_count', 'last_used'],
      data.known_products ?? [],
    );
  });
  return { rooms: data.rooms.length, furniture: data.furniture?.length ?? 0, items: data.items.length };
}
