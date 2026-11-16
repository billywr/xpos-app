import { getDatabase } from "@/db/database";
import type { PageResponse } from "@/types";

export interface Supplier {
  id: string;
  orgId: string;
  name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchSuppliers(
  _token: string | null,
  _orgId: string,
  _params?: { page?: number; size?: number; includeInactive?: boolean }
): Promise<PageResponse<Supplier>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT id, name, phone, email, created_at as createdAt FROM suppliers ORDER BY name ASC`
  );

  const content: Supplier[] = rows.map((r) => ({
    id: r.id,
    orgId: "offline-org",
    name: r.name,
    phone: r.phone,
    email: r.email,
    active: true,
    createdAt: r.createdAt,
    updatedAt: r.createdAt,
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

export async function createSupplier(
  _token: string | null,
  _orgId: string,
  body: { name: string; phone?: string | null; email?: string | null }
): Promise<Supplier> {
  const db = await getDatabase();
  const id = "sup-" + Date.now();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO suppliers (id, name, phone, email, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, body.name.trim(), body.phone?.trim() || null, body.email?.trim() || null, now]
  );

  return {
    id,
    orgId: "offline-org",
    name: body.name,
    phone: body.phone ?? null,
    email: body.email ?? null,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}
