import * as SQLite from "expo-sqlite";
import { initSchema } from "./schema";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export const DB_NAME = "xpos_local.db";

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    // Enable Write-Ahead Logging for high-concurrency read/writes.
    // Turn off rigid client foreign key enforcement to allow reliable out-of-order replication from server.
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = OFF;
    `);

    // Initialize tables and indexes
    await initSchema(db);

    dbInstance = db;
    return db;
  })();

  return initPromise;
}

let transactionQueue: Promise<void> = Promise.resolve();

/**
 * Execute an atomic transaction callback with the SQLite database.
 * Uses an asynchronous promise queue (mutex) to strictly serialize transactions,
 * preventing 'cannot start a transaction within a transaction' or 'database is locked' errors.
 */
export async function withTransaction<T>(
  callback: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const db = await getDatabase();
  return new Promise<T>((resolve, reject) => {
    transactionQueue = transactionQueue
      .then(async () => {
        try {
          let result: T;
          await db.withTransactionAsync(async () => {
            result = await callback(db);
          });
          resolve(result!);
        } catch (err) {
          reject(err);
        }
      })
      .catch(() => {
        // Prevent queue breakage if a preceding transaction rejects
      });
  });
}

