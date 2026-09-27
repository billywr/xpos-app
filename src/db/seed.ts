import type { SQLiteDatabase } from "expo-sqlite";

export async function seedDatabase(
  db: SQLiteDatabase,
  options: { force?: boolean } = {}
): Promise<void> {
  const itemCount = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM items"
  );

  if (!options.force && (itemCount?.count ?? 0) > 0) {
    return;
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoStr = twoDaysAgo.toISOString().slice(0, 10);

  const isoNow = now.toISOString();
  const isoYesterday = yesterday.toISOString();
  const isoTwoDaysAgo = twoDaysAgo.toISOString();

  // 1. Categories (6 records)
  const categories = [
    { id: "cat-bev", name: "Beverages", description: "Soft drinks, juices, and water", color: "#0284c7" },
    { id: "cat-bak", name: "Bakery & Pastries", description: "Breads, scones, and buns", color: "#d97706" },
    { id: "cat-dai", name: "Dairy & Eggs", description: "Fresh milk, fermented mala, yogurts", color: "#16a34a" },
    { id: "cat-snk", name: "Snacks & Sweets", description: "Crisps, biscuits, and chocolates", color: "#ea580c" },
    { id: "cat-grn", name: "Grains & Cooking", description: "Flours, rice, sugar, and cooking oil", color: "#ca8a04" },
    { id: "cat-hsd", name: "Household & Cleaning", description: "Bar soaps, detergents, and tissues", color: "#9333ea" },
  ];

  for (const c of categories) {
    await db.runAsync(
      `INSERT OR REPLACE INTO categories (id, name, description, color, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [c.id, c.name, c.description, c.color, isoTwoDaysAgo]
    );
  }

  // 2. Items / Products (12 records)
  const items = [
    // Dairy
    { id: "item-milk-500", name: "Fresh Milk 500ml", sku: "MILK-500", barcode: "616110001001", cat: "cat-dai", sp: 65, bp: 50, stock: 28 },
    { id: "item-mala-500", name: "Mala Fermented Milk 500ml", sku: "MALA-500", barcode: "616110001002", cat: "cat-dai", sp: 70, bp: 55, stock: 18 },
    // Bakery
    { id: "item-white-bread", name: "White Bread 400g", sku: "BRD-W400", barcode: "616110002001", cat: "cat-bak", sp: 60, bp: 48, stock: 35 },
    { id: "item-brown-bread", name: "Brown Bread 400g", sku: "BRD-B400", barcode: "616110002002", cat: "cat-bak", sp: 65, bp: 50, stock: 22 },
    // Beverages
    { id: "item-coke-500", name: "Coca-Cola 500ml PET", sku: "COKE-500", barcode: "616110003001", cat: "cat-bev", sp: 50, bp: 38, stock: 48 },
    { id: "item-water-1l", name: "Mineral Water 1L", sku: "WAT-1000", barcode: "616110003002", cat: "cat-bev", sp: 40, bp: 25, stock: 40 },
    { id: "item-energy-300", name: "Energy Drink 300ml", sku: "ENG-300", barcode: "616110003003", cat: "cat-bev", sp: 80, bp: 60, stock: 24 },
    // Snacks
    { id: "item-crisps-50", name: "Potato Crisps 50g", sku: "SNK-CRP50", barcode: "616110004001", cat: "cat-snk", sp: 45, bp: 32, stock: 32 },
    { id: "item-choc-50", name: "Milk Chocolate Bar 50g", sku: "SNK-CHC50", barcode: "616110004002", cat: "cat-snk", sp: 70, bp: 50, stock: 25 },
    // Grains
    { id: "item-maize-2kg", name: "Maize Flour 2kg", sku: "GRN-MZ2KG", barcode: "616110005001", cat: "cat-grn", sp: 130, bp: 105, stock: 30 },
    { id: "item-wheat-2kg", name: "Wheat Flour 2kg", sku: "GRN-WT2KG", barcode: "616110005002", cat: "cat-grn", sp: 160, bp: 130, stock: 20 },
    { id: "item-sugar", name: "Sugar 1kg", sku: "GRN-SGR1K", barcode: "616110005003", cat: "cat-grn", sp: 150, bp: 120, stock: 25 },
    // Household
    { id: "item-soap-1kg", name: "Multipurpose Bar Soap 1kg", sku: "HSD-SOP1K", barcode: "616110006001", cat: "cat-hsd", sp: 140, bp: 110, stock: 15 },
  ];

  for (const it of items) {
    await db.runAsync(
      `INSERT OR REPLACE INTO items (
        id, name, sku, barcode, category_id, selling_price, cost_price,
        item_type, track_inventory, active, visible_in_pos, current_stock, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'RETAIL', 1, 1, 1, ?, ?, ?)`,
      [it.id, it.name, it.sku, it.barcode, it.cat, it.sp, it.bp, it.stock, isoTwoDaysAgo, isoNow]
    );
  }

  // 3. Suppliers (5 records)
  const suppliers = [
    { id: "sup-brookside", name: "Brookside Dairies Ltd", contact: "David Ndung'u", phone: "0722100200", email: "orders@brookside.co.ke" },
    { id: "sup-broadways", name: "Broadways Bakery Kenya", contact: "Peter Karanja", phone: "0722300400", email: "sales@broadways.co.ke" },
    { id: "sup-cocacola", name: "Coca-Cola Bottlers Nairobi", contact: "Grace Achieng", phone: "0722500600", email: "dispatch@coca-cola.co.ke" },
    { id: "sup-unga", name: "Unga Millers Group", contact: "Hassan Omar", phone: "0722700800", email: "supplies@unga.com" },
    { id: "sup-bidco", name: "Bidco Africa Ltd", contact: "Kavita Shah", phone: "0722900100", email: "corporate@bidco-africa.com" },
  ];

  for (const s of suppliers) {
    await db.runAsync(
      `INSERT OR REPLACE INTO suppliers (id, name, contact_person, phone, email, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [s.id, s.name, s.contact, s.phone, s.email, isoTwoDaysAgo]
    );
  }

  // 4. Goods Receipt Notes (GRN) & Lines (5 GRNs, 12 lines)
  const grns = [
    {
      id: "grn-1001",
      number: "GRN-001001",
      sup: "sup-brookside",
      receivedAt: isoTwoDaysAgo,
      lines: [
        { id: "grnl-1", item: "item-milk-500", qty: 40, cost: 50 },
        { id: "grnl-2", item: "item-mala-500", qty: 25, cost: 55 },
      ],
    },
    {
      id: "grn-1002",
      number: "GRN-001002",
      sup: "sup-broadways",
      receivedAt: isoYesterday,
      lines: [
        { id: "grnl-3", item: "item-white-bread", qty: 50, cost: 48 },
        { id: "grnl-4", item: "item-brown-bread", qty: 30, cost: 50 },
      ],
    },
    {
      id: "grn-1003",
      number: "GRN-001003",
      sup: "sup-cocacola",
      receivedAt: isoYesterday,
      lines: [
        { id: "grnl-5", item: "item-coke-500", qty: 60, cost: 38 },
        { id: "grnl-6", item: "item-water-1l", qty: 48, cost: 25 },
        { id: "grnl-7", item: "item-energy-300", qty: 30, cost: 60 },
      ],
    },
    {
      id: "grn-1004",
      number: "GRN-001004",
      sup: "sup-unga",
      receivedAt: isoNow,
      lines: [
        { id: "grnl-8", item: "item-maize-2kg", qty: 35, cost: 105 },
        { id: "grnl-9", item: "item-wheat-2kg", qty: 25, cost: 130 },
      ],
    },
    {
      id: "grn-1005",
      number: "GRN-001005",
      sup: "sup-bidco",
      receivedAt: isoNow,
      lines: [
        { id: "grnl-10", item: "item-soap-1kg", qty: 20, cost: 110 },
        { id: "grnl-11", item: "item-crisps-50", qty: 40, cost: 32 },
        { id: "grnl-12", item: "item-choc-50", qty: 30, cost: 50 },
      ],
    },
  ];

  for (const g of grns) {
    await db.runAsync(
      `INSERT OR REPLACE INTO goods_receipt_notes (id, grn_number, supplier_id, status, notes, received_at, created_at)
       VALUES (?, ?, ?, 'COMPLETED', 'Stock restock batch delivery', ?, ?)`,
      [g.id, g.number, g.sup, g.receivedAt, g.receivedAt]
    );

    for (const l of g.lines) {
      await db.runAsync(
        `INSERT OR REPLACE INTO grn_lines (id, grn_id, item_id, quantity, unit_cost, total_cost)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [l.id, g.id, l.item, l.qty, l.cost, l.qty * l.cost]
      );
    }
  }

  // 5. Stock Count Sheets & Lines (3 Days: Two Days Ago, Yesterday, Today)
  const sheetDates = [
    { date: twoDaysAgoStr, status: "RECONCILED", savedAt: isoTwoDaysAgo },
    { date: yesterdayStr, status: "SAVED", savedAt: isoYesterday },
    { date: todayStr, status: "DRAFT", savedAt: isoNow },
  ];

  for (const s of sheetDates) {
    await db.runAsync(
      `INSERT OR REPLACE INTO stock_count_sheets (id, date, status, last_saved_at, reconciled_at)
       VALUES (?, ?, ?, ?, ?)`,
      ["sheet-" + s.date, s.date, s.status, s.savedAt, s.status === "RECONCILED" ? s.savedAt : null]
    );
  }

  // Seed sample stock count lines across the 12 items for today and yesterday
  for (const it of items) {
    // Yesterday's sheet line
    const yOpening = it.stock + 12;
    const yReceived = it.cat === "cat-bak" || it.cat === "cat-bev" ? 10 : 0;
    const yClosing = it.stock + 4;
    const ySold = Math.max(0, yOpening + yReceived - yClosing);
    const yRev = ySold * it.sp;

    await db.runAsync(
      `INSERT OR REPLACE INTO stock_count_lines (
        id, sheet_date, item_id, opening_stock, received_stock, closing_count, units_sold, revenue, variance, recorded_units_sold, last_saved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        "scl-" + yesterdayStr + "-" + it.id,
        yesterdayStr,
        it.id,
        yOpening,
        yReceived,
        yClosing,
        ySold,
        yRev,
        ySold,
        isoYesterday,
      ]
    );

    // Today's sheet line
    const tOpening = yClosing;
    const tReceived = it.cat === "cat-grn" || it.cat === "cat-hsd" ? 10 : 0;
    const tClosing = it.stock;
    const tSold = Math.max(0, tOpening + tReceived - tClosing);
    const tRev = tSold * it.sp;

    await db.runAsync(
      `INSERT OR REPLACE INTO stock_count_lines (
        id, sheet_date, item_id, opening_stock, received_stock, closing_count, units_sold, revenue, variance, recorded_units_sold, last_saved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        "scl-" + todayStr + "-" + it.id,
        todayStr,
        it.id,
        tOpening,
        tReceived,
        tClosing,
        tSold,
        tRev,
        Math.floor(tSold * 0.7), // partially recorded to allow testing Record Sales
        isoNow,
      ]
    );
  }

  // 6. Sales & Sale Lines (6 Completed Sales Transactions across recent dates)
  const sales = [
    {
      id: "sale-201",
      receipt: "REC-000201",
      date: twoDaysAgoStr,
      time: isoTwoDaysAgo,
      lines: [
        { item: "item-milk-500", qty: 6, sp: 65, bp: 50 },
        { item: "item-white-bread", qty: 4, sp: 60, bp: 48 },
        { item: "item-coke-500", qty: 5, sp: 50, bp: 38 },
      ],
    },
    {
      id: "sale-202",
      receipt: "REC-000202",
      date: twoDaysAgoStr,
      time: isoTwoDaysAgo,
      lines: [
        { item: "item-maize-2kg", qty: 3, sp: 130, bp: 105 },
        { item: "item-wheat-2kg", qty: 2, sp: 160, bp: 130 },
        { item: "item-soap-1kg", qty: 2, sp: 140, bp: 110 },
      ],
    },
    {
      id: "sale-203",
      receipt: "REC-000203",
      date: yesterdayStr,
      time: isoYesterday,
      lines: [
        { item: "item-milk-500", qty: 8, sp: 65, bp: 50 },
        { item: "item-brown-bread", qty: 5, sp: 65, bp: 50 },
        { item: "item-water-1l", qty: 6, sp: 40, bp: 25 },
      ],
    },
    {
      id: "sale-204",
      receipt: "REC-000204",
      date: yesterdayStr,
      time: isoYesterday,
      lines: [
        { item: "item-energy-300", qty: 4, sp: 80, bp: 60 },
        { item: "item-crisps-50", qty: 6, sp: 45, bp: 32 },
        { item: "item-choc-50", qty: 3, sp: 70, bp: 50 },
      ],
    },
    {
      id: "sale-205",
      receipt: "REC-000205",
      date: todayStr,
      time: isoNow,
      lines: [
        { item: "item-coke-500", qty: 10, sp: 50, bp: 38 },
        { item: "item-white-bread", qty: 6, sp: 60, bp: 48 },
        { item: "item-mala-500", qty: 4, sp: 70, bp: 55 },
      ],
    },
    {
      id: "sale-206",
      receipt: "REC-000206",
      date: todayStr,
      time: isoNow,
      lines: [
        { item: "item-maize-2kg", qty: 5, sp: 130, bp: 105 },
        { item: "item-sugar", qty: 4, sp: 150, bp: 120 },
      ],
    },
  ];

  for (const s of sales) {
    let saleRev = 0;
    let saleCogs = 0;

    for (const l of s.lines) {
      saleRev += l.qty * l.sp;
      saleCogs += l.qty * l.bp;
    }

    // Insert parent sales row first (before child sale_lines)
    await db.runAsync(
      `INSERT OR REPLACE INTO sales (id, receipt_number, sale_date, completed_at, total, tax_total, cogs_total, status, source)
       VALUES (?, ?, ?, ?, ?, 0.0, ?, 'COMPLETED', 'STOCK_COUNT')`,
      [s.id, s.receipt, s.date, s.time, saleRev, saleCogs]
    );

    for (const l of s.lines) {
      const lineRev = l.qty * l.sp;

      await db.runAsync(
        `INSERT OR REPLACE INTO sale_lines (id, sale_id, item_id, quantity, unit_price, unit_cost, total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ["sline-" + s.id + "-" + l.item, s.id, l.item, l.qty, l.sp, l.bp, lineRev]
      );
    }
  }

  // 7. Customer Debts & Payments (5 Debts, 4 Payments)
  const debts = [
    {
      id: "debt-brian",
      name: "Mama Brian",
      phone: "0711122334",
      amount: 450,
      settled: 0,
      status: "UNPAID",
      notes: "Shop essentials on credit",
      payments: [],
    },
    {
      id: "debt-john",
      name: "John Kamau",
      phone: "0722334455",
      amount: 1200,
      settled: 600,
      status: "PARTIAL",
      notes: "Flour and sugar supplies for kiosk",
      payments: [
        { id: "pay-1", amount: 600, date: isoYesterday, notes: "M-Pesa cash out partial payment" },
      ],
    },
    {
      id: "debt-dennis",
      name: "Boda Boda Dennis",
      phone: "0733445566",
      amount: 300,
      settled: 300,
      status: "SETTLED",
      notes: "Energy drinks and snacks on morning shift",
      payments: [
        { id: "pay-2", amount: 300, date: isoTwoDaysAgo, notes: "Cash settlement in evening" },
      ],
    },
    {
      id: "debt-mwangi",
      name: "Teacher Mwangi",
      phone: "0744556677",
      amount: 850,
      settled: 350,
      status: "PARTIAL",
      notes: "Weekly household bread and milk",
      payments: [
        { id: "pay-3", amount: 350, date: isoYesterday, notes: "Paid part balance" },
      ],
    },
    {
      id: "debt-jane",
      name: "Jane Wanjiku",
      phone: "0755667788",
      amount: 500,
      settled: 0,
      status: "UNPAID",
      notes: "Soap and cooking flour",
      payments: [],
    },
  ];

  for (const d of debts) {
    const outstanding = d.amount - d.settled;
    await db.runAsync(
      `INSERT OR REPLACE INTO customer_debts (
        id, customer_name, phone, amount, settled_amount, outstanding, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.id, d.name, d.phone, d.amount, d.settled, outstanding, d.status, d.notes, isoTwoDaysAgo, isoNow]
    );

    for (const p of d.payments) {
      await db.runAsync(
        `INSERT OR REPLACE INTO debt_payments (id, debt_id, amount, payment_method, notes, created_at)
         VALUES (?, ?, ?, 'CASH', ?, ?)`,
        [p.id, d.id, p.amount, p.notes, p.date]
      );
    }
  }

  // 8. Misc Expenses (6 records across multiple categories)
  const expenses = [
    { id: "exp-kplc", amount: 800, category: "Utilities", desc: "KPLC Electricity Token recharge for fridge", who: "Store Manager", ref: "KPLC-48291", date: isoTwoDaysAgo },
    { id: "exp-bags", amount: 350, category: "Supplies", desc: "Khaki paper packaging bags bundle (100pcs)", who: "Cashier", ref: "REC-BAGS", date: isoTwoDaysAgo },
    { id: "exp-lunch", amount: 300, category: "Meals", desc: "Lunch meals for 2 staff members", who: "Operator", ref: null, date: isoYesterday },
    { id: "exp-trans", amount: 450, category: "Transport", desc: "Matatu/boda transport to collect bakery delivery", who: "Dennis", ref: null, date: isoYesterday },
    { id: "exp-clean", amount: 250, category: "Cleaning", desc: "Shop floor disinfectant and cleaning mop", who: "Cashier", ref: "REC-CL04", date: isoNow },
    { id: "exp-repair", amount: 500, category: "Repairs", desc: "Counter display glass hinge lock repair", who: "Carpenter James", ref: null, date: isoNow },
  ];

  for (const e of expenses) {
    await db.runAsync(
      `INSERT OR REPLACE INTO misc_expenses (id, amount, category, description, incurred_by, receipt_ref, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [e.id, e.amount, e.category, e.desc, e.who, e.ref, e.date]
    );
  }

  // Update store_settings
  await db.runAsync(
    "INSERT OR REPLACE INTO store_settings (key, value) VALUES ('is_seeded', 'true')"
  );
}
