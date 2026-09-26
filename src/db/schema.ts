import type { SQLiteDatabase } from "expo-sqlite";

export async function initSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    -- 1. Metadata & Settings
    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 2. Master Catalog: Categories
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cat_org ON categories(org_id);

    -- 3. Master Catalog: Items
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      sku TEXT,
      barcode TEXT,
      selling_price REAL NOT NULL DEFAULT 0.0,
      cost_price REAL NOT NULL DEFAULT 0.0,
      item_type TEXT NOT NULL DEFAULT 'RETAIL',
      track_inventory INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      visible_in_pos INTEGER NOT NULL DEFAULT 1,
      current_stock REAL NOT NULL DEFAULT 0.0,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);
    CREATE INDEX IF NOT EXISTS idx_items_sku ON items(sku);
    CREATE INDEX IF NOT EXISTS idx_items_org ON items(org_id);
    CREATE INDEX IF NOT EXISTS idx_items_active ON items(active, org_id);

    -- 4. Suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(org_id);

    -- 5. Goods Receipt Notes (GRN)
    CREATE TABLE IF NOT EXISTS goods_receipt_notes (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      grn_number TEXT NOT NULL UNIQUE,
      supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'COMPLETED',
      notes TEXT,
      received_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'COMMITTED'
    );

    CREATE INDEX IF NOT EXISTS idx_grn_branch_date ON goods_receipt_notes(branch_id, received_at);

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

    -- 6. Stock Count Sheets
    CREATE TABLE IF NOT EXISTS stock_count_sheets (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      business_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      last_saved_at TEXT,
      reconciled_at TEXT,
      notes TEXT,
      UNIQUE(branch_id, business_date)
    );

    CREATE INDEX IF NOT EXISTS idx_sc_sheets_date ON stock_count_sheets(branch_id, business_date);

    -- 7. Stock Count Lines
    CREATE TABLE IF NOT EXISTS stock_count_lines (
      id TEXT PRIMARY KEY,
      sheet_id TEXT NOT NULL REFERENCES stock_count_sheets(id) ON DELETE CASCADE,
      business_date TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      opening_stock REAL NOT NULL DEFAULT 0.0,
      added_stock REAL NOT NULL DEFAULT 0.0,
      added_today_stock REAL NOT NULL DEFAULT 0.0,
      selling_price REAL NOT NULL DEFAULT 0.0,
      closing_stock REAL,
      implied_sold REAL NOT NULL DEFAULT 0.0,
      already_recorded_sold REAL NOT NULL DEFAULT 0.0,
      qty_to_record REAL NOT NULL DEFAULT 0.0,
      line_revenue REAL NOT NULL DEFAULT 0.0,
      variance REAL NOT NULL DEFAULT 0.0,
      last_saved_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'COMMITTED',
      local_updated_at INTEGER NOT NULL,
      comments TEXT,
      UNIQUE(branch_id, business_date, item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_scl_branch_date ON stock_count_lines(branch_id, business_date);
    CREATE INDEX IF NOT EXISTS idx_scl_item ON stock_count_lines(item_id);
    CREATE INDEX IF NOT EXISTS idx_scl_sync_status ON stock_count_lines(sync_status);

    -- 8. Customer Debts & Payments
    CREATE TABLE IF NOT EXISTS customer_debts (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      phone TEXT,
      amount REAL NOT NULL,
      settled_amount REAL NOT NULL DEFAULT 0.0,
      outstanding REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'UNPAID',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'COMMITTED'
    );

    CREATE INDEX IF NOT EXISTS idx_debts_branch ON customer_debts(branch_id);

    CREATE TABLE IF NOT EXISTS debt_payments (
      id TEXT PRIMARY KEY,
      debt_id TEXT NOT NULL REFERENCES customer_debts(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'CASH',
      notes TEXT,
      created_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'COMMITTED'
    );

    CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);

    -- 9. Misc Expenses
    CREATE TABLE IF NOT EXISTS misc_expenses (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      incurred_by TEXT,
      receipt_ref TEXT,
      created_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'COMMITTED'
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_branch_date ON misc_expenses(branch_id, created_at);

    -- 10. Resilient Outbox Queue
    CREATE TABLE IF NOT EXISTS outbox_mutations (
      id TEXT PRIMARY KEY,
      client_request_id TEXT NOT NULL UNIQUE,
      org_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      http_method TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_mutations(status, created_at);
  `);
}
