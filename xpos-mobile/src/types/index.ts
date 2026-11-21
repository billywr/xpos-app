// API common types
export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  code: string;
  message: string;
  path: string;
  requestId?: string;
  details?: Record<string, string>;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

// Catalog types
export interface Item {
  id: string;
  orgId: string;
  sku: string | null;
  name: string;
  itemType: string;
  categoryId: string | null;
  categoryName?: string | null;
  taxProfileId?: string | null;
  trackInventory: boolean;
  active: boolean;
  buyingPrice: number | null;
  defaultSellingPrice: number | null;
  visibleInPos: boolean;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  orgId: string;
  parentId: string | null;
  name: string;
  type: string;
}

export interface ItemBarcode {
  id: string;
  itemId: string;
  barcode: string;
  primaryBarcode?: boolean;
}

// Standard Stock Count types
export interface StdStockCountRowResponse {
  itemId: string;
  sku: string;
  name: string;
  openingStock: number;
  addedStock: number;
  addedTodayStock: number;
  sellingPrice: number;
  closingStock: number | null;
  lastSavedAt: string | null;
  firstStockAddedAt: string | null;
  comments: string | null;
}

export interface StdStockCountSheetResponse {
  date: string;
  outletId: string;
  rows: StdStockCountRowResponse[];
}

export interface StdStockCountCountRequest {
  itemId: string;
  closingStock: number;
  comments?: string | null;
}

export interface StdStockCountSaveRequest {
  date: string;
  outletId: string;
  counts: StdStockCountCountRequest[];
}

export interface StdStockCountSalesLineResponse {
  itemId: string;
  name: string;
  impliedSold: number;
  alreadyRecorded: number;
  qtyToRecord: number;
  qtyRecorded: number | null;
  unitPrice: number;
  lineValue: number;
  status: string | null;
}

export interface StdStockCountSalesPreviewResponse {
  date: string;
  branchId: string;
  lines: StdStockCountSalesLineResponse[];
  totalQtyToRecord: number;
  totalValueToRecord: number;
}

export interface StdStockCountReconcileLineResponse {
  itemId: string;
  name: string;
  closingStock: number;
  onHandQty: number;
  variance: number;
}

export interface StdStockCountReconcilePreviewResponse {
  date: string;
  branchId: string;
  lines: StdStockCountReconcileLineResponse[];
  itemsAdjusted: number;
  itemsAlreadyMatched: number;
}

// Customer Debt types
export interface CustomerDebtResponse {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  saleId: string | null;
  amount: number;
  amountSettled: number;
  outstanding: number;
  currency: string;
  dueDate: string | null;
  status: string;
  notes: string | null;
  issuedBy: string | null;
  createdByStaffUserId: string;
  createdAt: string;
}

export interface DebtPendingTotalResponse {
  totalPending: number;
}

export interface CustomerDebtCreateRequest {
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  amount: number;
  dueDate?: string;
  notes?: string;
  issuedBy?: string;
}

// Misc Expense types
export interface MiscExpenseResponse {
  id: string;
  amount: number;
  category: string;
  description: string;
  incurredBy: string | null;
  receiptRef: string | null;
  terminalId: string | null;
  shiftId: string | null;
  createdByStaffUserId: string;
  createdAt: string;
}

export interface MiscExpenseCreateRequest {
  amount: number;
  category: string;
  description: string;
  incurredBy?: string;
  receiptRef?: string;
}

export interface MiscExpenseListResponse {
  content: MiscExpenseResponse[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  totalAmount: number;
}

// Org & Branch types
export interface Org {
  id: string;
  name: string;
  code: string;
}

export interface Branch {
  id: string;
  orgId: string;
  name: string;
  code: string;
}

export interface Terminal {
  id: string;
  branchId: string;
  name: string;
  code: string;
}

// Recurring Utility Overheads types
export type RecurringUtilityApplyTiming = "BEGINNING_OF_MONTH" | "END_OF_MONTH";

export interface RecurringUtilityResponse {
  id: string;
  orgId: string;
  branchId: string;
  name: string;
  amount: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  applyTiming: RecurringUtilityApplyTiming;
  notes?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  syncStatus?: "COMMITTED" | "PENDING" | "FAILED";
}

export interface RecurringUtilityCreateRequest {
  name: string;
  amount: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  applyTiming?: RecurringUtilityApplyTiming;
  notes?: string;
}

export interface RecurringUtilityUpdateRequest {
  name?: string;
  amount?: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  isRateChange?: boolean;
  applyTiming?: RecurringUtilityApplyTiming;
  active?: boolean;
  notes?: string;
}

export interface RecurringUtilityListResponse {
  items: RecurringUtilityResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface RecurringUtilitySummaryResponse {
  activeCount: number;
  monthlyTotalAmount: number;
}

