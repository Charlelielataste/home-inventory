import type { SQLiteDatabase } from 'expo-sqlite';

import { todayIso, addToToday, EXPIRY_WARNING_DAYS, FREEZER_WARNING_MONTHS } from '@/lib/dates';
import type { UnitKey } from '@/lib/units';

// ---------- Types ----------

export type Room = { id: number; name: string; position: number };
export type RoomWithCounts = Room & { furniture_count: number; item_count: number };

export type Furniture = { id: number; room_id: number; name: string; position: number };
export type FurnitureWithCount = Furniture & { item_count: number };
export type FurnitureWithRoom = Furniture & { room_name: string };

export type Item = {
  id: number;
  furniture_id: number;
  name: string;
  quantity: number;
  unit: UnitKey;
  category: string | null;
  subcategory: string | null;
  min_quantity: number | null;
  expires_at: string | null;
  frozen_at: string | null;
  frozen_snoozed_until: string | null;
  barcode: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
export type ItemWithLocation = Item & { furniture_name: string; room_id: number; room_name: string };

export type ItemInput = {
  furniture_id: number;
  name: string;
  quantity: number;
  unit: UnitKey;
  category: string | null;
  subcategory: string | null;
  min_quantity: number | null;
  expires_at: string | null;
  frozen_at: string | null;
  barcode: string | null;
  notes: string | null;
};

export type KnownProduct = {
  name: string;
  unit: UnitKey | null;
  category: string | null;
  subcategory: string | null;
  barcode: string | null;
  use_count: number;
};

// ---------- Rooms ----------

export function listRooms(db: SQLiteDatabase) {
  return db.getAllAsync<RoomWithCounts>(`
    SELECT r.*,
      (SELECT COUNT(*) FROM furniture f WHERE f.room_id = r.id) AS furniture_count,
      (SELECT COUNT(*) FROM items i JOIN furniture f ON f.id = i.furniture_id WHERE f.room_id = r.id) AS item_count
    FROM rooms r
    ORDER BY r.position, r.id
  `);
}

export function getRoom(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Room>('SELECT * FROM rooms WHERE id = ?', id);
}

export async function createRoom(db: SQLiteDatabase, name: string) {
  const res = await db.runAsync(
    'INSERT INTO rooms (name, position) VALUES (?, (SELECT COALESCE(MAX(position), 0) + 1 FROM rooms))',
    name,
  );
  return res.lastInsertRowId;
}

export function renameRoom(db: SQLiteDatabase, id: number, name: string) {
  return db.runAsync('UPDATE rooms SET name = ? WHERE id = ?', name, id);
}

export function deleteRoom(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM rooms WHERE id = ?', id);
}

// ---------- Furniture ----------

export function listFurniture(db: SQLiteDatabase, roomId: number) {
  return db.getAllAsync<FurnitureWithCount>(
    `SELECT f.*, (SELECT COUNT(*) FROM items i WHERE i.furniture_id = f.id) AS item_count
     FROM furniture f WHERE f.room_id = ? ORDER BY f.position, f.id`,
    roomId,
  );
}

export function listAllFurniture(db: SQLiteDatabase) {
  return db.getAllAsync<FurnitureWithRoom>(
    `SELECT f.*, r.name AS room_name FROM furniture f
     JOIN rooms r ON r.id = f.room_id
     ORDER BY r.position, r.id, f.position, f.id`,
  );
}

export function getFurniture(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<FurnitureWithRoom>(
    `SELECT f.*, r.name AS room_name FROM furniture f JOIN rooms r ON r.id = f.room_id WHERE f.id = ?`,
    id,
  );
}

export async function createFurniture(db: SQLiteDatabase, roomId: number, name: string) {
  const res = await db.runAsync(
    `INSERT INTO furniture (room_id, name, position)
     VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM furniture WHERE room_id = ?))`,
    roomId,
    name,
    roomId,
  );
  return res.lastInsertRowId;
}

export function renameFurniture(db: SQLiteDatabase, id: number, name: string) {
  return db.runAsync('UPDATE furniture SET name = ? WHERE id = ?', name, id);
}

export function moveFurniture(db: SQLiteDatabase, id: number, roomId: number) {
  return db.runAsync('UPDATE furniture SET room_id = ? WHERE id = ?', roomId, id);
}

export function deleteFurniture(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM furniture WHERE id = ?', id);
}

// ---------- Items ----------

export function listItems(db: SQLiteDatabase, furnitureId: number) {
  return db.getAllAsync<Item>(
    'SELECT * FROM items WHERE furniture_id = ? ORDER BY name COLLATE NOCASE',
    furnitureId,
  );
}

const ITEM_WITH_LOCATION = `
  SELECT i.*, f.name AS furniture_name, r.id AS room_id, r.name AS room_name
  FROM items i
  JOIN furniture f ON f.id = i.furniture_id
  JOIN rooms r ON r.id = f.room_id
`;

export function listAllItems(db: SQLiteDatabase) {
  return db.getAllAsync<ItemWithLocation>(`${ITEM_WITH_LOCATION} ORDER BY i.name COLLATE NOCASE`);
}

export function getItem(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<ItemWithLocation>(`${ITEM_WITH_LOCATION} WHERE i.id = ?`, id);
}

/** Same name (case-insensitive), same unit and same frozen state in the same furniture. */
export function findDuplicate(db: SQLiteDatabase, furnitureId: number, name: string, unit: string, frozen: boolean) {
  return db.getFirstAsync<Item>(
    `SELECT * FROM items WHERE furniture_id = ? AND name = ? COLLATE NOCASE AND unit = ?
       AND (frozen_at IS NOT NULL) = ?`,
    furnitureId,
    name,
    unit,
    frozen ? 1 : 0,
  );
}

/**
 * Merges a duplicate ("Additionner"): adds the quantity and completes the existing item.
 * Expiry and freezing: keep the earliest date (the safest one).
 * The rest (category, minimum, barcode, notes) is only filled if it was empty.
 */
export function mergeIntoItem(db: SQLiteDatabase, id: number, input: ItemInput) {
  return db.runAsync(
    `UPDATE items SET
       quantity = ROUND(quantity + ?, 3),
       expires_at = CASE WHEN expires_at IS NULL OR ? < expires_at THEN COALESCE(?, expires_at) ELSE expires_at END,
       frozen_at = CASE WHEN frozen_at IS NULL OR ? < frozen_at THEN COALESCE(?, frozen_at) ELSE frozen_at END,
       category = COALESCE(category, ?),
       subcategory = CASE WHEN category IS NULL THEN ? ELSE subcategory END,
       min_quantity = COALESCE(min_quantity, ?),
       barcode = COALESCE(barcode, ?),
       notes = COALESCE(notes, ?),
       updated_at = datetime('now')
     WHERE id = ?`,
    input.quantity,
    input.expires_at,
    input.expires_at,
    input.frozen_at,
    input.frozen_at,
    input.category,
    input.subcategory,
    input.min_quantity,
    input.barcode,
    input.notes,
    id,
  );
}

export async function createItem(db: SQLiteDatabase, input: ItemInput) {
  const res = await db.runAsync(
    `INSERT INTO items (furniture_id, name, quantity, unit, category, subcategory, min_quantity, expires_at, frozen_at, barcode, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.furniture_id,
    input.name,
    input.quantity,
    input.unit,
    input.category,
    input.subcategory,
    input.min_quantity,
    input.expires_at,
    input.frozen_at,
    input.barcode,
    input.notes,
  );
  return res.lastInsertRowId;
}

export function updateItem(db: SQLiteDatabase, id: number, input: ItemInput) {
  return db.runAsync(
    `UPDATE items SET furniture_id = ?, name = ?, quantity = ?, unit = ?, category = ?, subcategory = ?,
       min_quantity = ?, expires_at = ?,
       -- the snoozed reminder is reset when the frozen state / date changes
       frozen_snoozed_until = CASE WHEN frozen_at IS ? THEN frozen_snoozed_until ELSE NULL END,
       frozen_at = ?, barcode = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ?`,
    input.furniture_id,
    input.name,
    input.quantity,
    input.unit,
    input.category,
    input.subcategory,
    input.min_quantity,
    input.expires_at,
    input.frozen_at,
    input.frozen_at,
    input.barcode,
    input.notes,
    id,
  );
}

/** Adds (or removes) a quantity, never below 0. */
export function adjustQuantity(db: SQLiteDatabase, id: number, delta: number) {
  return db.runAsync(
    `UPDATE items SET quantity = MAX(0, ROUND(quantity + ?, 3)), updated_at = datetime('now') WHERE id = ?`,
    delta,
    id,
  );
}

/** Snoozes ("Ignorer") the freezer reminder for FREEZER_WARNING_MONTHS months. */
export function snoozeFrozen(db: SQLiteDatabase, id: number) {
  return db.runAsync(
    'UPDATE items SET frozen_snoozed_until = ? WHERE id = ?',
    addToToday({ months: FREEZER_WARNING_MONTHS }),
    id,
  );
}

export function deleteItem(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM items WHERE id = ?', id);
}

// ---------- Alerts ----------

export async function getAlerts(db: SQLiteDatabase) {
  const today = todayIso();
  const soon = addToToday({ days: EXPIRY_WARNING_DAYS });
  const frozenLimit = addToToday({ months: -FREEZER_WARNING_MONTHS });
  const [lowStock, expired, expiringSoon, frozenLong] = await Promise.all([
    db.getAllAsync<ItemWithLocation>(
      `${ITEM_WITH_LOCATION} WHERE i.min_quantity IS NOT NULL AND i.quantity <= i.min_quantity
       ORDER BY i.category, i.subcategory, i.name COLLATE NOCASE`,
    ),
    db.getAllAsync<ItemWithLocation>(
      `${ITEM_WITH_LOCATION} WHERE i.expires_at IS NOT NULL AND i.frozen_at IS NULL AND i.expires_at < ? ORDER BY i.expires_at`,
      today,
    ),
    db.getAllAsync<ItemWithLocation>(
      `${ITEM_WITH_LOCATION} WHERE i.expires_at IS NOT NULL AND i.frozen_at IS NULL AND i.expires_at >= ? AND i.expires_at <= ?
       ORDER BY i.expires_at`,
      today,
      soon,
    ),
    db.getAllAsync<ItemWithLocation>(
      `${ITEM_WITH_LOCATION} WHERE i.frozen_at IS NOT NULL AND i.frozen_at <= ?
         AND (i.frozen_snoozed_until IS NULL OR i.frozen_snoozed_until <= ?)
       ORDER BY i.frozen_at`,
      frozenLimit,
      today,
    ),
  ]);
  return { lowStock, expired, expiringSoon, frozenLong };
}

// ---------- Known products (autocomplete) ----------

export function listKnownProducts(db: SQLiteDatabase) {
  return db.getAllAsync<KnownProduct>(
    'SELECT name, unit, category, subcategory, barcode, use_count FROM known_products ORDER BY use_count DESC, last_used DESC',
  );
}

export function findKnownByBarcode(db: SQLiteDatabase, barcode: string) {
  return db.getFirstAsync<KnownProduct>(
    'SELECT name, unit, category, subcategory, barcode, use_count FROM known_products WHERE barcode = ? ORDER BY use_count DESC',
    barcode,
  );
}

export function rememberProduct(
  db: SQLiteDatabase,
  p: { name: string; unit: string; category: string | null; subcategory: string | null; barcode: string | null },
) {
  return db.runAsync(
    `INSERT INTO known_products (name, unit, category, subcategory, barcode, use_count, last_used)
     VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
     ON CONFLICT(name) DO UPDATE SET
       unit = excluded.unit,
       category = COALESCE(excluded.category, known_products.category),
       subcategory = CASE WHEN excluded.category IS NULL THEN known_products.subcategory ELSE excluded.subcategory END,
       barcode = COALESCE(excluded.barcode, known_products.barcode),
       use_count = known_products.use_count + 1,
       last_used = excluded.last_used`,
    p.name,
    p.unit,
    p.category,
    p.subcategory,
    p.barcode,
  );
}

export function forgetKnownProducts(db: SQLiteDatabase) {
  return db.runAsync('DELETE FROM known_products');
}

// ---------- Misc ----------

export async function getStats(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ rooms: number; furniture: number; items: number; known: number }>(`
    SELECT
      (SELECT COUNT(*) FROM rooms) AS rooms,
      (SELECT COUNT(*) FROM furniture) AS furniture,
      (SELECT COUNT(*) FROM items) AS items,
      (SELECT COUNT(*) FROM known_products) AS known
  `);
  return row ?? { rooms: 0, furniture: 0, items: 0, known: 0 };
}

/** Empties every table (also used when importing a backup). */
export const WIPE_ALL_SQL = 'DELETE FROM items; DELETE FROM furniture; DELETE FROM rooms; DELETE FROM known_products;';

export function wipeAll(db: SQLiteDatabase) {
  return db.execAsync(WIPE_ALL_SQL);
}

/** Creates several rooms at once (single transaction). */
export async function createRooms(db: SQLiteDatabase, names: string[]) {
  await db.withTransactionAsync(async () => {
    for (const name of names) await createRoom(db, name);
  });
}
