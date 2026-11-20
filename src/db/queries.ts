import type { SQLiteDatabase } from 'expo-sqlite';

import { type Batch, cleanBatches, fitBatches, parseBatches, takeEarliest } from '@/lib/batches';
import { todayIso, addToToday, expiryWarningDays, freezerWarningMonths } from '@/lib/dates';
import { addToTotal, type MeasureUnit, quantityForTotal, totalForQuantity } from '@/lib/units';

// ---------- Types ----------

/** `icon`: custom icon key ("Personnalisé"), null = derived from the name. See `roomIconOf()`. */
export type Room = { id: number; name: string; icon: string | null; position: number };
export type RoomWithCounts = Room & { furniture_count: number; item_count: number };

export type Furniture = { id: number; room_id: number; name: string; icon: string | null; position: number };
export type FurnitureWithCount = Furniture & { item_count: number };
export type FurnitureWithRoom = Furniture & { room_name: string };

export type Item = {
  id: number;
  furniture_id: number;
  name: string;
  /** Custom icon key, null = derived from the category (see `itemIcon()`) */
  icon: string | null;
  /** Stock: number of items (whole number) */
  quantity: number;
  /** Optional size of ONE item (500 g); both null without size */
  size: number | null;
  size_unit: MeasureUnit | null;
  /** What is left in all (unit of the size), changed apart: use `totalOf()`. NULL = all full. */
  amount: number | null;
  category: string | null;
  subcategory: string | null;
  /** In items, like `quantity` */
  min_quantity: number | null;
  /** Earliest batch date (see lib/batches.ts); the dates of every batch: `itemBatches()` */
  expires_at: string | null;
  frozen_at: string | null;
  frozen_snoozed_until: string | null;
  barcode: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Batches as JSON, from the item lists (`listItems`, `getItem`…): read with `itemBatches()` */
  batches_json?: string | null;
};
export type ItemWithLocation = Item & { furniture_name: string; room_id: number; room_name: string };

export type ItemInput = {
  furniture_id: number;
  name: string;
  icon: string | null;
  quantity: number;
  size: number | null;
  size_unit: MeasureUnit | null;
  amount: number | null;
  category: string | null;
  subcategory: string | null;
  min_quantity: number | null;
  /** One date for the whole stock (ignored when `batches` is given) */
  expires_at: string | null;
  /** Dates per batch; more dated items than `quantity`: the earliest are dropped */
  batches?: Batch[];
  frozen_at: string | null;
  barcode: string | null;
  notes: string | null;
};

export type KnownProduct = {
  name: string;
  size: number | null;
  size_unit: MeasureUnit | null;
  category: string | null;
  subcategory: string | null;
  barcode: string | null;
  icon: string | null;
  /** Items in one scanned pack (6 × 33 cl → 6), null = 1 */
  pack_quantity: number | null;
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

export async function createRoom(db: SQLiteDatabase, name: string, icon: string | null = null) {
  const res = await db.runAsync(
    'INSERT INTO rooms (name, icon, position) VALUES (?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM rooms))',
    name,
    icon,
  );
  return res.lastInsertRowId;
}

/** Name + custom icon (null = back to the icon derived from the name). */
export function updateRoom(db: SQLiteDatabase, id: number, name: string, icon: string | null) {
  return db.runAsync('UPDATE rooms SET name = ?, icon = ? WHERE id = ?', name, icon, id);
}

export function deleteRoom(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM rooms WHERE id = ?', id);
}

// ---------- Furniture ----------

/** Every piece of furniture of the house with its item count (home screen sections). */
export function listFurnitureWithCounts(db: SQLiteDatabase) {
  return db.getAllAsync<FurnitureWithCount>(
    `SELECT f.*, (SELECT COUNT(*) FROM items i WHERE i.furniture_id = f.id) AS item_count
     FROM furniture f ORDER BY f.position, f.id`,
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

export async function createFurniture(db: SQLiteDatabase, roomId: number, name: string, icon: string | null = null) {
  const res = await db.runAsync(
    `INSERT INTO furniture (room_id, name, icon, position)
     VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM furniture WHERE room_id = ?))`,
    roomId,
    name,
    icon,
    roomId,
  );
  return res.lastInsertRowId;
}

/** Name + custom icon (null = back to the icon derived from the name). */
export function updateFurniture(db: SQLiteDatabase, id: number, name: string, icon: string | null) {
  return db.runAsync('UPDATE furniture SET name = ?, icon = ? WHERE id = ?', name, icon, id);
}

export function moveFurniture(db: SQLiteDatabase, id: number, roomId: number) {
  return db.runAsync('UPDATE furniture SET room_id = ? WHERE id = ?', roomId, id);
}

export function deleteFurniture(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM furniture WHERE id = ?', id);
}

// ---------- Items ----------

/** Batches of item `i`, as JSON (see `itemBatches()`) */
const BATCHES_JSON = `(SELECT json_group_array(json_array(b.quantity, b.expires_at)) FROM item_batches b
  WHERE b.item_id = i.id) AS batches_json`;

/** Batches of an item read by `listItems`, `getItem`…, earliest first. */
export function itemBatches(item: Pick<Item, 'batches_json'>): Batch[] {
  return parseBatches(item.batches_json);
}

export function listItems(db: SQLiteDatabase, furnitureId: number) {
  return db.getAllAsync<Item>(
    `SELECT i.*, ${BATCHES_JSON} FROM items i WHERE i.furniture_id = ? ORDER BY i.name COLLATE NOCASE`,
    furnitureId,
  );
}

const ITEM_WITH_LOCATION = `
  SELECT i.*, f.name AS furniture_name, r.id AS room_id, r.name AS room_name, ${BATCHES_JSON}
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

/**
 * Item of this furniture matching a scanned barcode (quick scan): same barcode, or no barcode
 * but the name remembered for it. Several (frozen, "Créer à part"): the not frozen one, the latest.
 */
export function findItemByBarcode(db: SQLiteDatabase, furnitureId: number, barcode: string) {
  return db.getFirstAsync<Item>(
    `SELECT * FROM items WHERE furniture_id = ? AND (barcode = ? OR (barcode IS NULL AND name = (
       SELECT name FROM known_products WHERE barcode = ? ORDER BY use_count DESC LIMIT 1) COLLATE NOCASE))
     ORDER BY frozen_at IS NOT NULL, updated_at DESC LIMIT 1`,
    furnitureId,
    barcode,
    barcode,
  );
}

/** Same name (case-insensitive), same size and same frozen state in the same furniture. */
export function findDuplicate(db: SQLiteDatabase, input: ItemInput) {
  return db.getFirstAsync<Item>(
    `SELECT * FROM items WHERE furniture_id = ? AND name = ? COLLATE NOCASE AND size IS ? AND size_unit IS ?
       AND (frozen_at IS NOT NULL) = ?`,
    input.furniture_id,
    input.name,
    input.size,
    input.size_unit,
    input.frozen_at ? 1 : 0,
  );
}

// ---------- Item writes ----------

let writeQueue: Promise<unknown> = Promise.resolve();

/**
 * Item writes touch several rows (items + batches) over several awaits: they run one at a time
 * (a held − / + fires faster than a write ends, which mixed up the batches) and each in a
 * transaction (app killed halfway: no date lost). A serialized write must never call another
 * one (it would wait for itself): share an inner, unserialized function instead.
 */
function serialized<A extends unknown[], T>(write: (db: SQLiteDatabase, ...args: A) => Promise<T>) {
  return (db: SQLiteDatabase, ...args: A): Promise<T> => {
    const run = writeQueue.then(async () => {
      let result!: T;
      await db.withTransactionAsync(async () => {
        result = await write(db, ...args);
      });
      return result;
    });
    writeQueue = run.catch(() => {});
    return run;
  };
}

/**
 * Merges a duplicate ("Additionner"): adds the quantity and completes the existing item.
 * Expiry and freezing: keep the earliest date (the safest one).
 * The rest (category, minimum, barcode, notes) is only filled if it was empty.
 */
export const mergeIntoItem = serialized(async (db: SQLiteDatabase, id: number, input: ItemInput) => {
  await db.runAsync(
    `UPDATE items SET
       amount = CASE WHEN size IS NULL THEN amount
         ELSE ROUND(COALESCE(amount, quantity * size) + COALESCE(?, ? * size), 3) END,
       quantity = quantity + ?,
       frozen_at = CASE WHEN frozen_at IS NULL OR ? < frozen_at THEN COALESCE(?, frozen_at) ELSE frozen_at END,
       icon = COALESCE(icon, ?),
       category = COALESCE(category, ?),
       subcategory = CASE WHEN category IS NULL THEN ? ELSE subcategory END,
       min_quantity = COALESCE(min_quantity, ?),
       barcode = COALESCE(barcode, ?),
       notes = COALESCE(notes, ?),
       updated_at = datetime('now')
     WHERE id = ?`,
    input.amount,
    input.quantity,
    input.quantity,
    input.frozen_at,
    input.frozen_at,
    input.icon,
    input.category,
    input.subcategory,
    input.min_quantity,
    input.barcode,
    input.notes,
    id,
  );
  // Their dates join the existing batches (same date: added up)
  await insertBatches(db, id, inputBatches(input));
  await syncBatches(db, id);
});

/** Batches of a form / import: given, or one date for the whole stock. */
function inputBatches(input: ItemInput): Batch[] {
  if (input.batches) return input.batches;
  return input.expires_at ? [{ quantity: input.quantity, expires_at: input.expires_at }] : [];
}

async function insertBatches(db: SQLiteDatabase, itemId: number, batches: Batch[]) {
  for (const b of cleanBatches(batches)) {
    await db.runAsync(
      'INSERT INTO item_batches (item_id, quantity, expires_at) VALUES (?, ?, ?)',
      itemId,
      b.quantity,
      b.expires_at,
    );
  }
}

/**
 * After any change of the stock: one batch per date, no more dated items than the stock
 * (the earliest go first: eaten first), and `items.expires_at` = earliest batch date.
 * `removed` = items just taken out of the stock: taken from the earliest batch, even when
 * some items have no date. Writes nothing when already right (each write wakes the alerts up).
 */
async function syncBatches(db: SQLiteDatabase, id: number, removed = 0) {
  const item = await db.getFirstAsync<{ quantity: number; expires_at: string | null }>(
    'SELECT quantity, expires_at FROM items WHERE id = ?',
    id,
  );
  if (!item) return;
  const rows = await db.getAllAsync<Batch>(
    'SELECT quantity, expires_at FROM item_batches WHERE item_id = ? ORDER BY expires_at, id',
    id,
  );
  const kept = fitBatches(takeEarliest(rows, removed), item.quantity);
  if (JSON.stringify(kept) !== JSON.stringify(rows)) {
    await db.runAsync('DELETE FROM item_batches WHERE item_id = ?', id);
    await insertBatches(db, id, kept);
  }
  const earliest = kept[0]?.expires_at ?? null;
  if (item.expires_at !== earliest) await db.runAsync('UPDATE items SET expires_at = ? WHERE id = ?', earliest, id);
}

export const createItem = serialized(async (db: SQLiteDatabase, input: ItemInput) => {
  const res = await db.runAsync(
    `INSERT INTO items (furniture_id, name, icon, quantity, size, size_unit, amount, category, subcategory,
       min_quantity, expires_at, frozen_at, barcode, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.furniture_id,
    input.name,
    input.icon,
    input.quantity,
    input.size,
    input.size_unit,
    input.amount,
    input.category,
    input.subcategory,
    input.min_quantity,
    input.expires_at,
    input.frozen_at,
    input.barcode,
    input.notes,
  );
  const id = res.lastInsertRowId;
  await insertBatches(db, id, inputBatches(input));
  await syncBatches(db, id);
  return id;
});

export const updateItem = serialized(async (db: SQLiteDatabase, id: number, input: ItemInput) => {
  await db.runAsync(
    `UPDATE items SET furniture_id = ?, name = ?, icon = ?, quantity = ?, size = ?, size_unit = ?, amount = ?, category = ?,
       subcategory = ?,
       min_quantity = ?, expires_at = ?,
       -- the snoozed reminder is reset when the frozen state / date changes
       frozen_snoozed_until = CASE WHEN frozen_at IS ? THEN frozen_snoozed_until ELSE NULL END,
       frozen_at = ?, barcode = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ?`,
    input.furniture_id,
    input.name,
    input.icon,
    input.quantity,
    input.size,
    input.size_unit,
    input.amount,
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
  await db.runAsync('DELETE FROM item_batches WHERE item_id = ?', id);
  await insertBatches(db, id, inputBatches(input));
  await syncBatches(db, id);
});

type StockRow = { quantity: number; size: number | null; amount: number | null };

function readStock(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<StockRow>('SELECT quantity, size, amount FROM items WHERE id = ?', id);
}

/** Writes the new stock, then fits the batches: `removed` items go from the earliest batch. */
async function writeStock(db: SQLiteDatabase, id: number, before: StockRow, quantity: number, amount: number | null) {
  await db.runAsync(
    "UPDATE items SET quantity = ?, amount = ?, updated_at = datetime('now') WHERE id = ?",
    quantity,
    amount,
    id,
  );
  await syncBatches(db, id, Math.max(0, before.quantity - quantity));
}

/** Not serialized: shared by `adjustQuantity()` and `addStock()`. */
async function changeQuantity(db: SQLiteDatabase, id: number, delta: number) {
  const item = await readStock(db, id);
  if (!item) return;
  const quantity = Math.max(0, item.quantity + delta);
  const amount = item.size
    ? totalForQuantity(item.quantity, item.amount ?? item.quantity * item.size, quantity, item.size)
    : item.amount;
  await writeStock(db, id, item, quantity, amount);
}

/**
 * Adds (or removes) items to the stock, never below 0. With a size, what is left follows
 * `totalForQuantity()`: one more = one more full item, one less = the started one is gone
 * (2 × 500 g with 800 g left, −1 → 1 × 500 g). Fewer items: the earliest batch goes first;
 * more: the new ones have no date yet.
 */
export const adjustQuantity = serialized(changeQuantity);

/**
 * Bought `count` more (Courses): full items, with their own expiry date when given
 * (a new batch, the older ones keep theirs; same date = merged by `syncBatches()`).
 */
export const addStock = serialized(async (db: SQLiteDatabase, id: number, count: number, expiresAt: string | null) => {
  await changeQuantity(db, id, count);
  if (!expiresAt) return;
  await insertBatches(db, id, [{ quantity: count, expires_at: expiresAt }]);
  await syncBatches(db, id);
});

/** Everything used up (« Épuisé »): 0 items, nothing left (no date either). */
export const emptyItem = serialized(async (db: SQLiteDatabase, id: number) => {
  const item = await readStock(db, id);
  if (item) await writeStock(db, id, item, 0, item.size ? 0 : null);
});

/**
 * Changes what is left (unit of the size), apart from the number of items: 200 g eaten
 * out of 2 × 500 g → 800 g, still 2. The number of items follows the total
 * (`quantityForTotal()`): down to 500 g, the started pack is finished → 1.
 */
export const adjustAmount = serialized(async (db: SQLiteDatabase, id: number, delta: number) => {
  const item = await readStock(db, id);
  if (!item?.size) return;
  const amount = addToTotal(item.amount ?? item.quantity * item.size, delta);
  await writeStock(db, id, item, quantityForTotal(amount, item.size), amount);
});

const placeholders = (ids: unknown[]) => ids.map(() => '?').join(', ');

/** Snoozes ("Ignorer") the freezer reminder for freezerWarningMonths() months. */
export function snoozeFrozen(db: SQLiteDatabase, ids: number[]) {
  if (ids.length === 0) return Promise.resolve();
  return db.runAsync(
    `UPDATE items SET frozen_snoozed_until = ? WHERE id IN (${placeholders(ids)})`,
    addToToday({ months: freezerWarningMonths() }),
    ...ids,
  );
}

export function deleteItem(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM items WHERE id = ?', id);
}

export function deleteItems(db: SQLiteDatabase, ids: number[]) {
  if (ids.length === 0) return Promise.resolve();
  return db.runAsync(`DELETE FROM items WHERE id IN (${placeholders(ids)})`, ids);
}

/**
 * Quick scan of a furniture: the product already there (`findItemByBarcode()`) gets one more
 * pack (+1, +6 for a pack of 6, `known_products.pack_quantity`). Returns the updated item and
 * the pack added, null when the product is not in this furniture yet.
 */
export const addPackByBarcode = serialized(async (db: SQLiteDatabase, furnitureId: number, barcode: string) => {
  const found = await findItemByBarcode(db, furnitureId, barcode);
  if (!found) return null;
  const pack = (await findKnownByBarcode(db, barcode))?.pack_quantity ?? 1;
  await changeQuantity(db, found.id, pack);
  const item = await getItem(db, found.id);
  return item ? { item, pack } : null;
});

// ---------- Alerts ----------

export async function getAlerts(db: SQLiteDatabase) {
  const today = todayIso();
  const soon = addToToday({ days: expiryWarningDays() });
  const frozenLimit = addToToday({ months: -freezerWarningMonths() });
  const [lowStock, expired, expiringSoon, frozenLong, partlyDated] = await Promise.all([
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
    // Some items dated, others not (2 × 27/11 + 1 without a date): a date was forgotten.
    // Frozen ones are left out: their expiry is not tracked.
    db.getAllAsync<ItemWithLocation>(
      `${ITEM_WITH_LOCATION} WHERE i.frozen_at IS NULL
         AND (SELECT SUM(b.quantity) FROM item_batches b WHERE b.item_id = i.id) < ROUND(i.quantity)
       ORDER BY i.name COLLATE NOCASE`,
    ),
  ]);
  return { lowStock, expired, expiringSoon, frozenLong, partlyDated };
}

export type Alerts = Awaited<ReturnType<typeof getAlerts>>;

export type ReminderItem = Pick<Item, 'name' | 'expires_at' | 'frozen_at' | 'frozen_snoozed_until'>;

/**
 * What may need a future reminder: each batch not yet expired (of items not frozen: one row
 * per date, so a product bought twice is reminded for both), and the frozen items.
 */
export function listReminderItems(db: SQLiteDatabase) {
  return db.getAllAsync<ReminderItem>(
    `SELECT i.name, b.expires_at, NULL AS frozen_at, NULL AS frozen_snoozed_until
       FROM item_batches b JOIN items i ON i.id = b.item_id
       WHERE i.frozen_at IS NULL AND b.expires_at >= ?
     UNION ALL
     SELECT name, expires_at, frozen_at, frozen_snoozed_until FROM items WHERE frozen_at IS NOT NULL
     ORDER BY 1 COLLATE NOCASE`,
    todayIso(),
  );
}

// ---------- Known products (autocomplete) ----------

export function listKnownProducts(db: SQLiteDatabase) {
  return db.getAllAsync<KnownProduct>(
    `SELECT name, size, size_unit, category, subcategory, barcode, icon, pack_quantity, use_count
     FROM known_products ORDER BY use_count DESC, last_used DESC`,
  );
}

export function findKnownByBarcode(db: SQLiteDatabase, barcode: string) {
  return db.getFirstAsync<KnownProduct>(
    `SELECT name, size, size_unit, category, subcategory, barcode, icon, pack_quantity, use_count
     FROM known_products WHERE barcode = ? ORDER BY use_count DESC`,
    barcode,
  );
}

export function rememberProduct(
  db: SQLiteDatabase,
  p: {
    name: string;
    size: number | null;
    size_unit: MeasureUnit | null;
    category: string | null;
    subcategory: string | null;
    barcode: string | null;
    icon: string | null;
    /** Items in one scanned pack; null = keep the remembered one */
    pack_quantity: number | null;
  },
) {
  return db.runAsync(
    `INSERT INTO known_products (name, size, size_unit, category, subcategory, barcode, icon, pack_quantity,
       use_count, last_used)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
     ON CONFLICT(name) DO UPDATE SET
       size = excluded.size,
       size_unit = excluded.size_unit,
       category = COALESCE(excluded.category, known_products.category),
       subcategory = CASE WHEN excluded.category IS NULL THEN known_products.subcategory ELSE excluded.subcategory END,
       barcode = COALESCE(excluded.barcode, known_products.barcode),
       -- latest choice wins, including going back to the automatic icon (null)
       icon = excluded.icon,
       pack_quantity = COALESCE(excluded.pack_quantity, known_products.pack_quantity),
       use_count = known_products.use_count + 1,
       last_used = excluded.last_used`,
    p.name,
    p.size,
    p.size_unit,
    p.category,
    p.subcategory,
    p.barcode,
    p.icon,
    p.pack_quantity,
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
export function wipeAll(db: SQLiteDatabase) {
  return db.execAsync(
    'DELETE FROM item_batches; DELETE FROM items; DELETE FROM furniture; DELETE FROM rooms; DELETE FROM known_products;',
  );
}

/** Every row of every table, as stored (backup export). */
export async function dumpAll(db: SQLiteDatabase) {
  return {
    rooms: await db.getAllAsync<Record<string, unknown>>('SELECT * FROM rooms'),
    furniture: await db.getAllAsync<Record<string, unknown>>('SELECT * FROM furniture'),
    items: await db.getAllAsync<Record<string, unknown>>('SELECT * FROM items'),
    item_batches: await db.getAllAsync<Record<string, unknown>>('SELECT * FROM item_batches'),
    known_products: await db.getAllAsync<Record<string, unknown>>('SELECT * FROM known_products'),
  };
}

/**
 * After importing a backup older than batches (v1, v2): one batch per dated item, as
 * migration 9 did (an empty item has nothing left to expire).
 */
export function batchesFromDates(db: SQLiteDatabase) {
  return db.execAsync(`
    INSERT INTO item_batches (item_id, quantity, expires_at)
      SELECT id, CAST(ROUND(quantity) AS INTEGER), expires_at FROM items
      WHERE expires_at IS NOT NULL AND ROUND(quantity) > 0;
  `);
}

/** After an import: every item's date = its earliest batch. */
export function syncAllExpiry(db: SQLiteDatabase) {
  return db.execAsync(
    'UPDATE items SET expires_at = (SELECT MIN(b.expires_at) FROM item_batches b WHERE b.item_id = items.id);',
  );
}

/** Creates several rooms at once (single transaction). */
export async function createRooms(db: SQLiteDatabase, names: string[]) {
  await db.withTransactionAsync(async () => {
    for (const name of names) await createRoom(db, name);
  });
}
