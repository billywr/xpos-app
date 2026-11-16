/**
 * Operator shift types. Align with backend ShiftResponse.
 */

export interface Shift {
  id: string;
  orgId: string;
  branchId: string;
  terminalId: string;
  staffUserId: string;
  openedAt: string;
  closedAt: string | null;
  status: string;
  openingFloatAmount: number;
  closingCountedAmount: number | null;
  expectedCashAmount: number | null;
  varianceAmount: number | null;
  closedByManagerId: string | null;
  varianceReasonCodeId: string | null;
}
