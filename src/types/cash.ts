/**
 * Cash movements and reporting. Align with backend DTOs.
 */

export interface CashMovement {
  id: string;
  shiftId: string;
  type: string;
  amount: number;
  reasonCodeId: string | null;
  createdByStaffUserId: string;
  createdAt: string;
}

export interface ZReportSummary {
  orgId: string;
  branchId: string;
  businessDate: string;
  salesTotal: number;
  taxTotal: number;
  cashTotal: number;
  mpesaTotal: number;
  cardTotal: number;
  otherTenderTotal: number;
  varianceTotal: number;
  saleCount: number;
}
