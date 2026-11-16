import { apiFetch } from "@/api/client";
import type { ReceiptDetailResponse, Sale } from "@/types/sales";

const salesPath = (
  orgId: string,
  branchId: string,
  terminalId: string
) => `/api/v1/operator/orgs/${orgId}/branches/${branchId}/terminals/${terminalId}/sales`;

export async function createSale(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  body: { customerId?: string | null }
): Promise<Sale> {
  return apiFetch<Sale>(salesPath(orgId, branchId, terminalId), {
    token,
    body: body ?? {},
    method: "POST" as RequestInit["method"],
  });
}

export async function fetchOpenOrHeldSales(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string
): Promise<Sale[]> {
  const res = await apiFetch<Sale[]>(salesPath(orgId, branchId, terminalId), {
    token,
  });
  return Array.isArray(res) ? res : [];
}

export async function fetchSale(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  saleId: string
): Promise<Sale> {
  return apiFetch<Sale>(
    `${salesPath(orgId, branchId, terminalId)}/${saleId}`,
    { token }
  );
}

export async function addSaleLine(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  saleId: string,
  body: {
    itemId: string;
    qty: number;
    uomId?: string | null;
    unitPriceOverride?: number | null;
    modifiers?: { modifierOptionId: string; qty: number }[];
  }
): Promise<Sale> {
  return apiFetch<Sale>(
    `${salesPath(orgId, branchId, terminalId)}/${saleId}/lines`,
    { token, body, method: "POST" as RequestInit["method"] }
  );
}

export async function addTender(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  saleId: string,
  body: { tenderTypeId: string; amount: number; currency: string }
): Promise<Sale> {
  return apiFetch<Sale>(
    `${salesPath(orgId, branchId, terminalId)}/${saleId}/tenders`,
    { token, body, method: "POST" as RequestInit["method"] }
  );
}

/** Operator: remove a tender from an open sale. Only one payment allowed at a time; remove before adding another. */
export async function removeTender(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  saleId: string,
  tenderId: string
): Promise<void> {
  await apiFetch<void>(
    `${salesPath(orgId, branchId, terminalId)}/${saleId}/tenders/${tenderId}`,
    { token, method: "DELETE" as RequestInit["method"] }
  );
}

export async function completeSale(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  saleId: string
): Promise<Sale> {
  return apiFetch<Sale>(
    `${salesPath(orgId, branchId, terminalId)}/${saleId}/complete`,
    { token, method: "POST" as RequestInit["method"] }
  );
}

/** Operator: void an open or held sale. Removes from open sales list. */
export async function voidSale(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  saleId: string
): Promise<Sale> {
  return apiFetch<Sale>(
    `${salesPath(orgId, branchId, terminalId)}/${saleId}/void`,
    { token, method: "POST" as RequestInit["method"] }
  );
}

export interface CompleteWithDebtRequest {
  customerName: string;
  customerPhone?: string;
  dueDate?: string;
}

export async function completeSaleWithDebt(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  saleId: string,
  body: CompleteWithDebtRequest
): Promise<Sale> {
  return apiFetch<Sale>(
    `${salesPath(orgId, branchId, terminalId)}/${saleId}/complete-with-debt`,
    { token, body, method: "POST" as RequestInit["method"] }
  );
}

export async function fetchReceiptDetails(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  saleId: string
): Promise<ReceiptDetailResponse> {
  return apiFetch<ReceiptDetailResponse>(
    `${salesPath(orgId, branchId, terminalId)}/${saleId}/receipt/details`,
    { token }
  );
}

/** Operator: list completed sales (receipts) for branch. */
const receiptsPath = (orgId: string, branchId: string) =>
  `/api/v1/operator/orgs/${orgId}/branches/${branchId}/receipts`;

export interface SaleSummary {
  id: string;
  orgId: string;
  branchId: string;
  terminalId: string;
  receiptNumber: number | null;
  status: string;
  total: number;
  createdByStaffUserId: string;
  createdByUsername: string | null;
  completedAt: string | null;
  createdAt: string;
}

export async function fetchOperatorReceipts(
  token: string | null,
  orgId: string,
  branchId: string,
  params?: { page?: number; size?: number; fromDate?: string; toDate?: string }
): Promise<import("@/types/api").PageResponse<SaleSummary>> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.size != null) search.set("size", String(params.size));
  if (params?.fromDate) search.set("fromDate", params.fromDate);
  if (params?.toDate) search.set("toDate", params.toDate);
  const qs = search.toString();
  return apiFetch(
    `${receiptsPath(orgId, branchId)}${qs ? `?${qs}` : ""}`,
    { token }
  );
}

export async function recordReceiptReprint(
  token: string | null,
  orgId: string,
  branchId: string,
  saleId: string
): Promise<void> {
  return apiFetch(
    `${receiptsPath(orgId, branchId)}/${saleId}/reprint`,
    { token, method: "POST" }
  );
}

/** Operator: refund a completed sale. Returns items to stock, cancels linked debts. */
export async function refundSale(
  token: string | null,
  orgId: string,
  branchId: string,
  saleId: string
): Promise<SaleSummary> {
  return apiFetch<SaleSummary>(
    `${receiptsPath(orgId, branchId)}/${saleId}/refund`,
    { token, method: "POST" }
  );
}
