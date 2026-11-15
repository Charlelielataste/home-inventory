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
  // 5: `ALTER TABLE items ADD COLUMN photo_uri TEXT;`,
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
