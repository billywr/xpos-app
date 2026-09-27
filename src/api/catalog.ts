import { getDatabase } from "@/db/database";
import type { Item, Category, ItemBarcode, PageResponse } from "@/types";

export interface CreateItemBody {
  sku?: string | null;
  name: string;
  itemType: string;
  categoryId?: string | null;
  taxProfileId?: string | null;
  trackInventory?: boolean;
  active?: boolean;
  buyingPrice?: number | null;
  defaultSellingPrice?: number | null;
  visibleInPos?: boolean;
  imageUrl?: string | null;
}

export interface UpdateItemBody {
  sku?: string | null;
  name?: string;
  itemType?: string;
  categoryId?: string | null;
  taxProfileId?: string | null;
  trackInventory?: boolean;
  active?: boolean;
  buyingPrice?: number | null;
  defaultSellingPrice?: number | null;
  visibleInPos?: boolean;
  imageUrl?: string | null;
}

export async function fetchItems(
  _token: string | null,
  _orgId: string,
  params?: { page?: number; size?: number; categoryId?: string | null }
): Promise<PageResponse<Item>> {
  const db = await getDatabase();
  const page = params?.page ?? 0;
  const size = params?.size ?? 100;
  const offset = page * size;

  let query = `
    SELECT 
      i.id,
      'offline-org' as orgId,
      i.sku,
      i.name,
      i.item_type as itemType,
      i.category_id as categoryId,
      c.name as categoryName,
      NULL as taxProfileId,
      CASE WHEN i.track_inventory = 1 THEN 1 ELSE 0 END as trackInventory,
      CASE WHEN i.active = 1 THEN 1 ELSE 0 END as active,
      i.cost_price as buyingPrice,
      i.selling_price as defaultSellingPrice,
      CASE WHEN i.visible_in_pos = 1 THEN 1 ELSE 0 END as visibleInPos,
      NULL as imageUrl,
      i.created_at as createdAt,
      i.updated_at as updatedAt
    FROM items i
    LEFT JOIN categories c ON i.category_id = c.id
  `;

  const queryParams: any[] = [];
  if (params?.categoryId) {
    query += ` WHERE i.category_id = ?`;
    queryParams.push(params.categoryId);
  }

  query += ` ORDER BY i.name ASC LIMIT ? OFFSET ?`;
  queryParams.push(size, offset);

  const rows = await db.getAllAsync<any>(query, queryParams);

  // Get total count
  let countQuery = `SELECT COUNT(*) as count FROM items`;
  const countParams: any[] = [];
  if (params?.categoryId) {
    countQuery += ` WHERE category_id = ?`;
    countParams.push(params.categoryId);
  }
  const countResult = await db.getFirstAsync<{ count: number }>(countQuery, countParams);
  const totalElements = countResult?.count ?? 0;
  const totalPages = Math.ceil(totalElements / size);

  const content: Item[] = rows.map((r) => ({
    id: r.id,
    orgId: "offline-org",
    sku: r.sku,
    name: r.name,
    itemType: r.itemType ?? "RETAIL",
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    taxProfileId: null,
    trackInventory: Boolean(r.trackInventory),
    active: Boolean(r.active),
    buyingPrice: r.buyingPrice ?? 0,
    defaultSellingPrice: r.defaultSellingPrice ?? 0,
    visibleInPos: Boolean(r.visibleInPos),
    imageUrl: null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return {
    content,
    totalElements,
    totalPages,
    size,
    number: page,
    first: page === 0,
    last: page >= totalPages - 1,
    empty: content.length === 0,
  };
}

export async function fetchCategories(
  _token: string | null,
  _orgId: string
): Promise<PageResponse<Category>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT id, name, description FROM categories ORDER BY name ASC`
  );

  const content: Category[] = rows.map((r) => ({
    id: r.id,
    orgId: "offline-org",
    parentId: null,
    name: r.name,
    type: "STANDARD",
  }));

  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    size: 100,
    number: 0,
    first: true,
    last: true,
    empty: content.length === 0,
  };
}

export async function fetchItemByBarcode(
  _token: string | null,
  _orgId: string,
  barcode: string
): Promise<Item> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<any>(
    `SELECT 
      i.id,
      'offline-org' as orgId,
      i.sku,
      i.name,
      i.item_type as itemType,
      i.category_id as categoryId,
      c.name as categoryName,
      CASE WHEN i.track_inventory = 1 THEN 1 ELSE 0 END as trackInventory,
      CASE WHEN i.active = 1 THEN 1 ELSE 0 END as active,
      i.cost_price as buyingPrice,
      i.selling_price as defaultSellingPrice,
      CASE WHEN i.visible_in_pos = 1 THEN 1 ELSE 0 END as visibleInPos,
      i.created_at as createdAt,
      i.updated_at as updatedAt
    FROM items i
    LEFT JOIN categories c ON i.category_id = c.id
    WHERE i.barcode = ? OR i.sku = ?
    LIMIT 1`,
    [barcode.trim(), barcode.trim()]
  );

  if (!r) {
    throw new Error(`Item not found for barcode: ${barcode}`);
  }

  return {
    id: r.id,
    orgId: "offline-org",
    sku: r.sku,
    name: r.name,
    itemType: r.itemType ?? "RETAIL",
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    taxProfileId: null,
    trackInventory: Boolean(r.trackInventory),
    active: Boolean(r.active),
    buyingPrice: r.buyingPrice ?? 0,
    defaultSellingPrice: r.defaultSellingPrice ?? 0,
    visibleInPos: Boolean(r.visibleInPos),
    imageUrl: null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function fetchItemBarcodes(
  _token: string | null,
  _orgId: string,
  itemId: string
): Promise<ItemBarcode[]> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{ barcode: string | null }>(
    `SELECT barcode FROM items WHERE id = ?`,
    [itemId]
  );
  if (!r?.barcode) return [];
  return [{ id: itemId + "-bc", itemId, barcode: r.barcode, primaryBarcode: true }];
}

export async function addItemBarcode(
  _token: string | null,
  _orgId: string,
  itemId: string,
  barcode: string
): Promise<ItemBarcode> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE items SET barcode = ? WHERE id = ?`, [barcode.trim(), itemId]);
  return { id: itemId + "-bc", itemId, barcode: barcode.trim(), primaryBarcode: true };
}

export async function createItem(
  _token: string | null,
  _orgId: string,
  body: CreateItemBody
): Promise<Item> {
  const db = await getDatabase();
  const id = "item-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO items (
      id, name, sku, category_id, selling_price, cost_price, item_type,
      track_inventory, active, visible_in_pos, current_stock, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?)`,
    [
      id,
      body.name.trim(),
      body.sku?.trim() || null,
      body.categoryId || null,
      body.defaultSellingPrice ?? 0,
      body.buyingPrice ?? 0,
      body.itemType || "RETAIL",
      body.trackInventory === false ? 0 : 1,
      body.active === false ? 0 : 1,
      body.visibleInPos === false ? 0 : 1,
      now,
      now,
    ]
  );

  return {
    id,
    orgId: "offline-org",
    sku: body.sku ?? null,
    name: body.name,
    itemType: body.itemType || "RETAIL",
    categoryId: body.categoryId ?? null,
    taxProfileId: null,
    trackInventory: body.trackInventory ?? true,
    active: body.active ?? true,
    buyingPrice: body.buyingPrice ?? 0,
    defaultSellingPrice: body.defaultSellingPrice ?? 0,
    visibleInPos: body.visibleInPos ?? true,
    imageUrl: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateItem(
  _token: string | null,
  _orgId: string,
  itemId: string,
  body: UpdateItemBody
): Promise<Item> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const current = await db.getFirstAsync<any>(`SELECT * FROM items WHERE id = ?`, [itemId]);
  if (!current) {
    throw new Error("Item not found");
  }

  const name = body.name !== undefined ? body.name.trim() : current.name;
  const sku = body.sku !== undefined ? (body.sku ? body.sku.trim() : null) : current.sku;
  const categoryId = body.categoryId !== undefined ? body.categoryId : current.category_id;
  const sellingPrice =
    body.defaultSellingPrice !== undefined
      ? body.defaultSellingPrice ?? 0
      : current.selling_price;
  const costPrice =
    body.buyingPrice !== undefined ? body.buyingPrice ?? 0 : current.cost_price;
  const itemType = body.itemType !== undefined ? body.itemType : current.item_type;
  const trackInventory =
    body.trackInventory !== undefined
      ? body.trackInventory
        ? 1
        : 0
      : current.track_inventory;
  const active = body.active !== undefined ? (body.active ? 1 : 0) : current.active;
  const visibleInPos =
    body.visibleInPos !== undefined
      ? body.visibleInPos
        ? 1
        : 0
      : current.visible_in_pos;

  await db.runAsync(
    `UPDATE items SET
      name = ?, sku = ?, category_id = ?, selling_price = ?, cost_price = ?,
      item_type = ?, track_inventory = ?, active = ?, visible_in_pos = ?, updated_at = ?
    WHERE id = ?`,
    [
      name,
      sku,
      categoryId,
      sellingPrice,
      costPrice,
      itemType,
      trackInventory,
      active,
      visibleInPos,
      now,
      itemId,
    ]
  );

  return {
    id: itemId,
    orgId: "offline-org",
    sku,
    name,
    itemType,
    categoryId,
    taxProfileId: null,
    trackInventory: Boolean(trackInventory),
    active: Boolean(active),
    buyingPrice: costPrice,
    defaultSellingPrice: sellingPrice,
    visibleInPos: Boolean(visibleInPos),
    imageUrl: null,
    createdAt: current.created_at,
    updatedAt: now,
  };
}
