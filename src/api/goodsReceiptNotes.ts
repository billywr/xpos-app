import { apiFetch } from "@/api/client";
import type { PageResponse } from "@/types/api";

export interface GrnLineResponse {
  id: string;
  grnId: string;
  itemId: string;
  itemName: string;
  barcode?: string | null;
  qty: number;
  uomId: string | null;
  receivedUnitCost: number | null;
  createdAt: string;
}

export interface GoodsReceiptNoteResponse {
  id: string;
  orgId: string;
  branchId: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId: string | null;
  receivedByStaffUserId: string;
  receivedAt: string;
  createdAt: string;
  active: boolean;
  lines: GrnLineResponse[];
}

export interface GrnUpdateBody {
  supplierId: string;
  receivedAt: string;
  active?: boolean;
  /** When present, replaces GRN lines and adjusts stock. Omit to leave lines unchanged. */
  lines?: GrnLineRequest[];
}

export interface GrnLineRequest {
  itemId: string;
  qty: number;
  uomId?: string | null;
  receivedUnitCost?: number | null;
}

export interface CreateGrnBody {
  branchId: string;
  supplierId: string;
  purchaseOrderId?: string | null;
  lines: GrnLineRequest[];
}

export async function fetchGoodsReceiptNotes(
  token: string | null,
  orgId: string,
  branchId: string,
  params?: { page?: number; size?: number; includeInactive?: boolean }
): Promise<PageResponse<GoodsReceiptNoteResponse>> {
  const search = new URLSearchParams();
  search.set("branchId", branchId);
  if (params?.page !== undefined) search.set("page", String(params.page));
  if (params?.size !== undefined) search.set("size", String(params.size));
  if (params?.includeInactive === true) search.set("includeInactive", "true");
  const query = search.toString();
  return apiFetch<PageResponse<GoodsReceiptNoteResponse>>(
    `/api/v1/admin/orgs/${orgId}/goods-receipt-notes?${query}`,
    { token }
  );
}

export async function fetchGoodsReceiptNote(
  token: string | null,
  orgId: string,
  grnId: string
): Promise<GoodsReceiptNoteResponse> {
  return apiFetch<GoodsReceiptNoteResponse>(
    `/api/v1/admin/orgs/${orgId}/goods-receipt-notes/${grnId}`,
    { token }
  );
}

export async function createGoodsReceiptNote(
  token: string | null,
  orgId: string,
  body: CreateGrnBody
): Promise<GoodsReceiptNoteResponse> {
  return apiFetch<GoodsReceiptNoteResponse>(
    `/api/v1/admin/orgs/${orgId}/goods-receipt-notes`,
    {
      token,
      method: "POST",
      body: {
        branchId: body.branchId,
        supplierId: body.supplierId,
        purchaseOrderId: body.purchaseOrderId ?? null,
        lines: body.lines.map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          uomId: l.uomId ?? null,
          receivedUnitCost: l.receivedUnitCost ?? null,
        })),
      },
    }
  );
}

export async function updateGoodsReceiptNote(
  token: string | null,
  orgId: string,
  grnId: string,
  body: GrnUpdateBody
): Promise<GoodsReceiptNoteResponse> {
  return apiFetch<GoodsReceiptNoteResponse>(
    `/api/v1/admin/orgs/${orgId}/goods-receipt-notes/${grnId}`,
    {
      token,
      method: "PATCH",
      body: {
        supplierId: body.supplierId,
        receivedAt: body.receivedAt,
        active: body.active,
        ...(body.lines != null && { lines: body.lines }),
      },
    }
  );
}

/** Hard delete: reverses GRN stock movements, removes lines and receipt. Fails if stock was consumed. */
export async function deleteGoodsReceiptNotePermanently(
  token: string | null,
  orgId: string,
  grnId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/admin/orgs/${orgId}/goods-receipt-notes/${grnId}`,
    { token, method: "DELETE" }
  );
}
