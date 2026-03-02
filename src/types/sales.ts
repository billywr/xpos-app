/**
 * API types for sales, tenders, tables. Align with backend DTOs.
 */

export interface SaleLineModifier {
  id: string;
  modifierOptionId: string;
  modifierOptionName: string;
  qty: number;
  unitPriceDelta: number;
}

export interface SaleLine {
  id: string;
  saleId: string;
  itemId: string;
  itemName: string;
  qty: number;
  uomId: string | null;
  unitPrice: number;
  lineSubtotal: number;
  lineTotal: number;
  createdAt: string;
  modifiers: SaleLineModifier[];
}

export interface Tender {
  id: string;
  saleId: string;
  tenderTypeId: string;
  tenderTypeCode: string;
  amount: number;
  currency: string;
  createdAt: string;
}

export interface Sale {
  id: string;
  orgId: string;
  branchId: string;
  terminalId: string;
  shiftId: string | null;
  status: string;
  receiptId: string | null;
  customerId: string | null;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  serviceChargeTotal: number;
  total: number;
  createdByStaffUserId: string;
  createdAt: string;
  completedAt: string | null;
  lines: SaleLine[];
  tenders: Tender[];
}

export interface TableEntityList {
  id: string;
  tableAreaId: string | null;
  name: string;
  capacity: number | null;
  status: string;
}

export interface TableEntity {
  id: string;
  orgId: string;
  branchId: string;
  tableAreaId: string | null;
  name: string;
  capacity: number | null;
  status: string;
  createdAt: string;
}

export interface TableArea {
  id: string;
  orgId: string;
  branchId: string;
  name: string;
  createdAt: string;
}

export interface TenderType {
  id: string;
  orgId: string;
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface PriceList {
  id: string;
  orgId: string;
  branchId: string | null;
  channel: string | null;
  name: string;
  priority: number;
  active: boolean;
}

export interface PriceListItem {
  id: string;
  priceListId: string;
  itemId: string;
  price: number;
  currency: string;
}

/** Receipt detail line modifier (from receipt/details API). */
export interface ReceiptDetailModifier {
  id: string;
  modifierOptionId: string;
  modifierOptionName: string;
  qty: number;
  priceDelta: number;
}

/** Receipt detail line item. */
export interface ReceiptDetailLineItem {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  uomId: string | null;
  unitPrice: number;
  lineSubtotal: number;
  lineTotal: number;
  modifiers: ReceiptDetailModifier[];
}

/** Receipt detail tax line. */
export interface ReceiptDetailTaxLine {
  id: string;
  taxProfileId: string;
  taxProfileName: string;
  taxRate: number;
  taxAmount: number;
}

/** Receipt detail tender. */
export interface ReceiptDetailTender {
  id: string;
  tenderTypeCode: string;
  tenderTypeName: string;
  amount: number;
  currency: string;
}

/** Full receipt payload for display/print (receipt/details API). */
export interface ReceiptDetailResponse {
  id: string;
  orgId: string;
  branchId: string;
  terminalId: string;
  businessDate: string;
  receiptNumber: number;
  printedAt: string | null;
  reprintCount: number;
  createdAt: string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  serviceChargeTotal: number;
  total: number;
  amountTendered: number;
  changeDue: number;
  debtAmount: number | null;
  debtDueDate: string | null;
  lines: ReceiptDetailLineItem[];
  taxLines: ReceiptDetailTaxLine[];
  tenders: ReceiptDetailTender[];
}
