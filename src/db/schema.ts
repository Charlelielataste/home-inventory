import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Database schema, as incremental migrations.
 *
 * The app is used by testers: their data must survive every update.
 * - NEVER edit a migration that has been shipped in a build: add a new one.
 * - A migration upgrades the database by one version; it runs once, in a
 *   transaction, then `PRAGMA user_version` is set to its version.
 * - Prefer additive changes (ADD COLUMN, CREATE TABLE/INDEX). To change a column,
 *   SQLite requires rebuilding the table (create new → copy → drop → rename).
 * - Also update `backup.ts` (exported / imported columns) and keep importing
 *   older backups.
 */
const MIGRATIONS: Record<number, string> = {
  // v4: first schema shipped to testers (versions 1-3 were development only)
  4: `
    CREATE TABLE rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE furniture (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_furniture_room ON furniture(room_id);

    CREATE TABLE items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      furniture_id INTEGER NOT NULL REFERENCES furniture(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'pcs',
      category TEXT,
      subcategory TEXT,
      min_quantity REAL,
      expires_at TEXT,
      -- Freezing date ('YYYY-MM-DD'); not null = frozen, expiry is no longer tracked
      frozen_at TEXT,
      -- Freezer reminder snoozed ("Ignorer"): no reminder before this date ('YYYY-MM-DD')
      frozen_snoozed_until TEXT,
      barcode TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_items_furniture ON items(furniture_id);

    -- Products already entered: feeds autocomplete and serves as an offline
    -- cache for barcodes already scanned.
    CREATE TABLE known_products (
      name TEXT PRIMARY KEY COLLATE NOCASE,
      unit TEXT,
      category TEXT,
      subcategory TEXT,
      barcode TEXT,
      use_count INTEGER NOT NULL DEFAULT 0,
      last_used TEXT
    );
    CREATE INDEX idx_known_barcode ON known_products(barcode);
  `,
  // v5: custom icon ("Personnalisé"), an icon key of src/ui/icons-data.ts; NULL = icon
  // derived from the name (rooms, furniture) or the category (items).
  5: `
    ALTER TABLE rooms ADD COLUMN icon TEXT;
    ALTER TABLE furniture ADD COLUMN icon TEXT;
    ALTER TABLE items ADD COLUMN icon TEXT;
    ALTER TABLE known_products ADD COLUMN icon TEXT;
  `,
  // v6: the stock is a NUMBER OF ITEMS (`quantity`), the measure becomes the optional size
  // of one item (`size` + `size_unit`): "2 packs of 500 g". The count units (pcs, portion,
  // paquet) disappear. Keep in sync with `upgradeV1Item()` in backup.ts.
  6: `
    ALTER TABLE items ADD COLUMN size REAL;
    ALTER TABLE items ADD COLUMN size_unit TEXT;

    -- Measured items ("Flour 1.5 kg"): 1 item of that size; an empty one stays at 0.
    -- A minimum in grams / liters means nothing in items: 1 keeps the item on the shopping list.
    UPDATE items SET
      size = CASE WHEN quantity > 0 THEN quantity END,
      size_unit = CASE WHEN quantity > 0 THEN unit END,
      quantity = CASE WHEN quantity > 0 THEN 1 ELSE 0 END,
      min_quantity = CASE WHEN min_quantity IS NOT NULL THEN 1 END
    WHERE unit IN ('g', 'kg', 'ml', 'l', 'cm', 'm');

    -- Counted items (pieces, portions, packs): whole numbers, a started one counts as 1
    UPDATE items SET
      quantity = CASE WHEN quantity > 0 THEN MAX(1, ROUND(quantity)) ELSE 0 END,
      min_quantity = ROUND(min_quantity)
    WHERE unit NOT IN ('g', 'kg', 'ml', 'l', 'cm', 'm');

    ALTER TABLE items DROP COLUMN unit;

    -- Autocomplete history: remembers the size of the product (unit only until next save)
    ALTER TABLE known_products RENAME COLUMN unit TO size_unit;
    ALTER TABLE known_products ADD COLUMN size REAL;
    UPDATE known_products SET size_unit = NULL WHERE size_unit NOT IN ('g', 'kg', 'ml', 'l', 'cm', 'm');
  `,
  // v7: what is really left, in the unit of the size (`amount`): 2 packs of 500 g, 200 g
  // eaten → 800 g. Changed apart from the number of items; NULL = every item is full.
  // Rules in `adjustQuantity()` / `adjustAmount()` (queries.ts).
  7: `
    ALTER TABLE items ADD COLUMN amount REAL;
    UPDATE items SET amount = quantity * size WHERE size IS NOT NULL;
  `,
  // v8: number of items in one scanned pack (6 × 33 cl → 6), remembered with the barcode:
  // scanning the product again gives the same quantity. NULL = 1.
  8: `
    ALTER TABLE known_products ADD COLUMN pack_quantity INTEGER;
  `,
  // v9: batches (« lots »): items of one expiry date, so the same product bought twice keeps
  // both dates (1 × 22/11 + 2 × 28/11). Items without a known date = quantity − sum of the
  // batches. items.expires_at stays, as the earliest batch date (kept in sync by queries.ts).
  // Existing dates become one batch covering the whole stock; an empty stock has nothing
  // left to expire, so its date goes.
  9: `
    CREATE TABLE item_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX idx_item_batches_item ON item_batches(item_id, expires_at);
    INSERT INTO item_batches (item_id, quantity, expires_at)
      SELECT id, CAST(ROUND(quantity) AS INTEGER), expires_at FROM items
      WHERE expires_at IS NOT NULL AND ROUND(quantity) > 0;
    UPDATE items SET expires_at = NULL WHERE ROUND(quantity) <= 0;
  `,
};

/** First version shipped to testers: older databases come from development builds. */
const BASELINE_VERSION = 4;
export const DB_VERSION = Math.max(...Object.keys(MIGRATIONS).map(Number));

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  let version = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;

  // Development databases older than the baseline: no real data, start over.
  if (version > 0 && version < BASELINE_VERSION) {
    await db.execAsync(`
      DROP TABLE IF EXISTS items;
      DROP TABLE IF EXISTS furniture;
      DROP TABLE IF EXISTS rooms;
      DROP TABLE IF EXISTS known_products;
      PRAGMA user_version = 0;
    `);
    version = 0;
  }

  // New install: the baseline creates the whole schema.
  if (version === 0) version = BASELINE_VERSION - 1;

  // A database newer than this build (older APK reinstalled): leave it untouched.
  for (let v = version + 1; v <= DB_VERSION; v++) {
    const sql = MIGRATIONS[v];
    if (!sql) throw new Error(`Missing database migration ${v}`);
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${v}`);
    });
  }
}
