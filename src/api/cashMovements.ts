import { apiFetch } from "@/api/client";
import type { CashMovement } from "@/types/cash";

/**
 * Operator: create cash movement (Paid in / Paid out). Requires open shift.
 */
export async function createCashMovement(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  type: "PAID_IN" | "PAID_OUT",
  amount: number,
  reasonCodeId?: string | null
): Promise<CashMovement> {
  return apiFetch<CashMovement>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/terminals/${terminalId}/cash-movements`,
    {
      token,
      method: "POST",
      body: {
        type,
        amount,
        reasonCodeId: reasonCodeId ?? null,
      },
    }
  );
}

/**
 * Operator: list cash movements for a shift.
 */
export async function getCashMovementsByShift(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  shiftId: string
): Promise<CashMovement[]> {
  const list = await apiFetch<CashMovement[]>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/terminals/${terminalId}/shifts/${shiftId}/cash-movements`,
    { token }
  );
  return Array.isArray(list) ? list : [];
}
