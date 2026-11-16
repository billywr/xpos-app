import type { SQLiteDatabase } from "expo-sqlite";
import { seedDatabase } from "./seed";

export async function initSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT,
      barcode TEXT,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      selling_price REAL NOT NULL DEFAULT 0.0,
      cost_price REAL NOT NULL DEFAULT 0.0,
      item_type TEXT NOT NULL DEFAULT 'RETAIL',
      track_inventory INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      visible_in_pos INTEGER NOT NULL DEFAULT 1,
      current_stock REAL NOT NULL DEFAULT 0.0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);
    CREATE INDEX IF NOT EXISTS idx_items_sku ON items(sku);
    CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goods_receipt_notes (
      id TEXT PRIMARY KEY,
      grn_number TEXT NOT NULL UNIQUE,
      supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      notes TEXT,
      received_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_grn_received_at ON goods_receipt_notes(received_at);

    CREATE TABLE IF NOT EXISTS grn_lines (
      id TEXT PRIMARY KEY,
      grn_id TEXT NOT NULL REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      total_cost REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_grn_lines_grn ON grn_lines(grn_id);
    CREATE INDEX IF NOT EXISTS idx_grn_lines_item ON grn_lines(item_id);

    CREATE TABLE IF NOT EXISTS stock_count_sheets (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      last_saved_at TEXT,
      reconciled_at TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_count_lines (
      id TEXT PRIMARY KEY,
      sheet_date TEXT NOT NULL REFERENCES stock_count_sheets(date) ON DELETE CASCADE,
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      opening_stock REAL NOT NULL DEFAULT 0.0,
      received_stock REAL NOT NULL DEFAULT 0.0,
      closing_count REAL,
      units_sold REAL NOT NULL DEFAULT 0.0,
      revenue REAL NOT NULL DEFAULT 0.0,
      variance REAL NOT NULL DEFAULT 0.0,
      recorded_units_sold REAL NOT NULL DEFAULT 0.0,
      last_saved_at TEXT,
      UNIQUE(sheet_date, item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_scl_sheet_date ON stock_count_lines(sheet_date);
    CREATE INDEX IF NOT EXISTS idx_scl_item ON stock_count_lines(item_id);

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      receipt_number TEXT NOT NULL UNIQUE,
      sale_date TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      total REAL NOT NULL DEFAULT 0.0,
      tax_total REAL NOT NULL DEFAULT 0.0,
      cogs_total REAL NOT NULL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      source TEXT NOT NULL DEFAULT 'STOCK_COUNT'
    );

    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);

    CREATE TABLE IF NOT EXISTS sale_lines (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      unit_cost REAL NOT NULL,
      total REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sale_lines_sale ON sale_lines(sale_id);

    CREATE TABLE IF NOT EXISTS customer_debts (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      phone TEXT,
      amount REAL NOT NULL,
      settled_amount REAL NOT NULL DEFAULT 0.0,
      outstanding REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'UNPAID',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS debt_payments (
      id TEXT PRIMARY KEY,
      debt_id TEXT NOT NULL REFERENCES customer_debts(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'CASH',
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);

    CREATE TABLE IF NOT EXISTS misc_expenses (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      incurred_by TEXT,
      receipt_ref TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_created ON misc_expenses(created_at);

    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default store settings and entities if store_settings is empty
  const seeded = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM store_settings WHERE key = 'is_seeded'"
  );

  if (!seeded) {
    try {
      await db.runAsync(
        "INSERT OR REPLACE INTO store_settings (key, value) VALUES ('store_name', 'My Store'), ('branch_name', 'Main Store'), ('currency', 'KES')"
      );

      await seedDatabase(db);

      // Only mark as seeded after seedDatabase completes successfully
      await db.runAsync(
        "INSERT OR REPLACE INTO store_settings (key, value) VALUES ('is_seeded', 'true')"
      );
    } catch (err) {
      // Remove partial seed flag so next launch retries
      await db.runAsync("DELETE FROM store_settings WHERE key = 'is_seeded'");
      console.error("[initSchema] Seed failed, will retry on next launch:", err);
    }
  }
}
