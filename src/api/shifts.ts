import { apiFetch } from "@/api/client";
import { isApiFetchError } from "@/utils/apiError";
import type { Shift } from "@/types/shift";

/**
 * GET current open shift for terminal. Returns null when no open shift (404).
 */
export async function getCurrentShift(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string
): Promise<Shift | null> {
  try {
    return await apiFetch<Shift>(
      `/api/v1/operator/orgs/${orgId}/branches/${branchId}/terminals/${terminalId}/shifts/current`,
      { token }
    );
  } catch (err) {
    if (isApiFetchError(err) && err.status === 404) return null;
    throw err;
  }
}

export async function openShift(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  openingFloatAmount: number
): Promise<Shift> {
  return apiFetch<Shift>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/terminals/${terminalId}/shifts`,
    {
      token,
      method: "POST",
      body: { openingFloatAmount },
    }
  );
}

export async function closeShift(
  token: string | null,
  orgId: string,
  branchId: string,
  terminalId: string,
  shiftId: string,
  closingCountedAmount: number,
  expectedCashAmount: number
): Promise<Shift> {
  const varianceAmount = closingCountedAmount - expectedCashAmount;
  return apiFetch<Shift>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/terminals/${terminalId}/shifts/${shiftId}`,
    {
      token,
      method: "PATCH",
      body: {
        closingCountedAmount,
        expectedCashAmount,
        varianceAmount,
        varianceReasonCodeId: null,
        closedByManagerId: null,
      },
    }
  );
}
