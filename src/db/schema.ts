import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Current schema version.
 *
 * The app is not in production yet (test data only): no migrations.
 * To change the database: edit SCHEMA directly and bump DB_VERSION.
 * On next launch, a database with another version is DELETED then recreated.
 * → Replace with real incremental migrations before going to production.
 */
const DB_VERSION = 4;

const SCHEMA = `
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
`;

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) === DB_VERSION) return;

  // Pre-production: start from an empty database instead of migrating.
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DROP TABLE IF EXISTS items;
      DROP TABLE IF EXISTS furniture;
      DROP TABLE IF EXISTS rooms;
      DROP TABLE IF EXISTS known_products;
      ${SCHEMA}
    `);
  });
  await db.execAsync(`PRAGMA user_version = ${DB_VERSION}`);
}
