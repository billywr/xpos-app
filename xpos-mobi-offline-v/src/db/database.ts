import * as SQLite from "expo-sqlite";
import { initSchema } from "./schema";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const db = await SQLite.openDatabaseAsync("xpos_offline.db");
    // Enable Write-Ahead Logging for high-concurrency read/writes and enforce foreign key constraints
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);

    // Initialize tables, indexes, and seed default data
    await initSchema(db);

    dbInstance = db;
    return db;
  })();

  return initPromise;
}

/**
 * Execute an atomic transaction callback with the SQLite database.
 */
export async function withTransaction<T>(
  callback: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const db = await getDatabase();
  let result: T;
  await db.withTransactionAsync(async () => {
    result = await callback(db);
  });
  return result!;
}
