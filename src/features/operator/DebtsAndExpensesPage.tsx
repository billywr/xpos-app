import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken, selectUsername } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectBranchId,
  selectBranchName,
} from "@/store/selectors/orgContextSelectors";
import {
  fetchDebts,
  fetchGroupedDebts,
  createDebt,
  updateDebt,
  cancelDebt,
  settleDebt,
  settleCustomerDebtsBulkByName,
  type CustomerDebtResponse,
  type CustomerDebtCreateRequest,
  type CustomerDebtUpdateRequest,
} from "@/api/debts";
import { createCustomer } from "@/api/customers";
import { fetchMe } from "@/api/me";
import { fetchAllOrgItems } from "@/api/items";
import type { Item } from "@/types/catalog";
import {
  fetchMiscExpenses,
  fetchGroupedExpenses,
  fetchExpenseCategories,
  createMiscExpense,
  updateMiscExpense,
  cancelMiscExpense,
  type MiscExpenseResponse,
  type MiscExpenseCreateRequest,
  type MiscExpenseUpdateRequest,
} from "@/api/miscExpenses";
import { SlideOver } from "@/components/ui/SlideOver";
import {
  Pagination,
  ConfirmDialog,
  SortableTableHead,
  TableRowNumberHead,
  TableRowNumberCell,
  StatChip,
  TableSearchInput,
  DateInput,
  tableBodyRow,
  tableStickyFirstCell,
  tableStickyHeadCell,
  tableRowNoHead,
  tableRowNoCell,
} from "@/components/ui";
import { formatCurrency, formatAmount, formatPercent } from "@/utils/formatCurrency";
import { filterRowsBySearch } from "@/utils/tableSearchMatch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import {
  allocateCustomerDebtPayment,
  customerTotalOutstanding,
  normalizeCustomerName,
} from "@/utils/allocateCustomerDebtPayment";
import { useTableSort } from "@/hooks/useTableSort";
import { sortTableRows } from "@/utils/tableSort";
import { downloadDebtsPdf, downloadGroupedDebtsPdf } from "@/utils/debtsPdf";
import { downloadExpensesPdf, downloadGroupedExpensesPdf } from "@/utils/expensesPdf";
import { recordedAtToCreatedAt, todayInputValue } from "@/utils/recordedAt";
import {
  addSavedIssuedByName,
  buildIssuedBySelectOptions,
  readSavedIssuedByNames,
} from "@/utils/issuedByStorage";
import { useToast } from "@/contexts/ToastContext";
import {
  HandCoins,
  Plus,
  Minus,
  Loader2,
  Pencil,
  XCircle,
  Banknote,
  Receipt,
  FileDown,
  Check,
  X,
} from "lucide-react";
import { AdminTabList, AdminTabPanel } from "@/components/ui/AdminTabs";
import { SearchableSelect } from "@/components/SearchableSelect";
// ---------------------------------------------------------------------------
// Shared date helpers (same as StandardStockCountSheetPage)
// ---------------------------------------------------------------------------

/** YYYY-MM-DD in the browser's local calendar (not UTC). */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayStr(): string {
  return toDateStr(new Date());
}

/** Default "from" date: 30 days before today (inclusive, local calendar). */
function defaultFromDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return toDateStr(d);
}

/** Earliest createdAt among debts (local calendar). Backend list sort ignores Pageable. */
function earliestDebtDateStr(debts: CustomerDebtResponse[]): string | null {
  let earliest: string | null = null;
  for (const d of debts) {
    if (!d.createdAt) {
      continue;
    }
    const ds = toDateStr(new Date(d.createdAt));
    if (earliest === null || ds < earliest) {
      earliest = ds;
    }
  }
  return earliest;
}

// ---------------------------------------------------------------------------
// Debts helpers
// ---------------------------------------------------------------------------

const DEBTS_PAGE_SIZE = 20;

interface BorrowedLineDraft {
  itemId: string;
  itemName: string;
  sku: string | null;
  unitPrice: number;
  qty: number;
}

function borrowedItemsNoteBlock(lines: BorrowedLineDraft[]): string {
  if (lines.length === 0) {
    return "";
  }
  const rows = lines.map(
    (l) =>
      `• ${l.itemName} × ${l.qty} @ ${formatCurrency(l.unitPrice)} = ${formatCurrency(
        l.qty * l.unitPrice
      )}`
  );
  return ["Borrowed items:", ...rows].join("\n");
}

/** Default list: still owed (OPEN or PARTIAL). OPEN-only hid rows after any repayment. */
const STATUS_OUTSTANDING = "OUTSTANDING";

/**
 * Cancelled debts are treated as permanently-removed audit records: they never
 * factor into pending totals and are excluded from the default "All" view.
 * They only appear when the user explicitly filters by "Cancelled".
 */
const STATUS_OPTIONS = [
  { value: STATUS_OUTSTANDING, label: "Outstanding (open + partial)" },
  { value: "OPEN", label: "Open only" },
  { value: "PARTIAL", label: "Partial only" },
  { value: "CLOSED", label: "Closed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "", label: "All (excluding cancelled)" },
] as const;

function statusQueryForFilter(filter: string): string | readonly string[] | undefined {
  if (filter === "") {
    // "All" excludes CANCELLED — cancelled debts are audit-only.
    return ["OPEN", "PARTIAL", "CLOSED"];
  }
  if (filter === STATUS_OUTSTANDING) {
    return ["OPEN", "PARTIAL"];
  }
  return filter;
}

/** Locale-aware A→Z comparator by customer name (case-insensitive). */
function debtByNameAsc(a: CustomerDebtResponse, b: CustomerDebtResponse): number {
  return a.customerName.localeCompare(b.customerName, undefined, { sensitivity: "base" });
}

const DEBT_SORT: Record<string, (row: CustomerDebtResponse) => unknown> = {
  customer: (row: CustomerDebtResponse) => row.customerName,
  phone: (row: CustomerDebtResponse) => row.customerPhone ?? "",
  amount: (row: CustomerDebtResponse) => row.amount,
  amountSettled: (row: CustomerDebtResponse) => row.amountSettled ?? 0,
  outstanding: (row: CustomerDebtResponse) => row.outstanding,
  status: (row: CustomerDebtResponse) => row.status,
  due: (row: CustomerDebtResponse) => row.dueDate ?? "",
  issuedBy: (row: CustomerDebtResponse) => row.issuedBy ?? "",
  created: (row: CustomerDebtResponse) => row.createdAt,
  notes: (row: CustomerDebtResponse) => row.notes ?? "",
};

/**
 * Sort key for expenses: prefer the "incurred by" person's name, fall back to
 * the description so every row has something to sort against.
 */
function expenseSortKey(e: MiscExpenseResponse): string {
  return (e.incurredBy && e.incurredBy.trim()) || e.description || "";
}

function expenseByNameAsc(a: MiscExpenseResponse, b: MiscExpenseResponse): number {
  return expenseSortKey(a).localeCompare(
    expenseSortKey(b),
    undefined,
    { sensitivity: "base" },
  );
}

const EXPENSE_SORT: Record<string, (row: MiscExpenseResponse) => unknown> = {
  incurredBy: (row: MiscExpenseResponse) => row.incurredBy ?? "",
  amount: (row: MiscExpenseResponse) => row.amount,
  category: (row: MiscExpenseResponse) => row.category ?? "",
  description: (row: MiscExpenseResponse) => row.description ?? "",
  receiptRef: (row: MiscExpenseResponse) => row.receiptRef ?? "",
  created: (row: MiscExpenseResponse) => row.createdAt ?? "",
};

/** Validate an inline-pay input. Returns null when empty or valid. */
function validateInlinePay(raw: string, outstanding: number): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n)) return "Enter a number.";
  if (n <= 0) return "Must be greater than 0.";
  if (n > outstanding) return `Max ${formatCurrency(outstanding)}.`;
  return null;
}

export type DebtGroupByOption = "none" | "customer" | "issuedBy" | "status" | "date";
export type ExpenseGroupByOption = "none" | "category" | "incurredBy" | "date";

const DEBT_GROUP_BY_OPTIONS: { value: DebtGroupByOption; label: string }[] = [
  { value: "none", label: "None" },
  { value: "customer", label: "Customer Name" },
  { value: "issuedBy", label: "Issued by" },
  { value: "status", label: "Status" },
  { value: "date", label: "Recorded Date" },
];

const EXPENSE_GROUP_BY_OPTIONS: { value: ExpenseGroupByOption; label: string }[] = [
  { value: "none", label: "None" },
  { value: "category", label: "Category" },
  { value: "incurredBy", label: "Incurred by" },
  { value: "date", label: "Recorded Date" },
];



const PENDING_TOTAL_QUERY_KEY = "operator-debts-pending-total";

function DebtPendingTotalDisplay(props: {
  totalPending: number;
  loading: boolean;
  onClick?: () => void;
}) {
  const { totalPending, loading, onClick } = props;
  return (
    <StatChip
      label="Total pending"
      value={loading ? "…" : formatCurrency(totalPending)}
      tone="debt"
      onClick={onClick}
      className="min-w-[min(100%,17rem)] max-w-full shrink-0"
    />
  );
}

// ---------------------------------------------------------------------------
// Expenses helpers
// ---------------------------------------------------------------------------

const EXPENSES_PAGE_SIZE = 20;
const DEFAULT_EXPENSE_CATEGORIES = [
  "Utilities",
  "Supplies",
  "Maintenance",
  "Transport",
  "Fuel",
  "Rent",
  "Salaries",
  "Other",
];

function MiscExpensesTotalBadge(props: {
  totalAmount: number;
  onClick?: () => void;
}) {
  const { totalAmount, onClick } = props;
  return (
    <StatChip
      label="Total"
      value={formatCurrency(totalAmount)}
      tone="expense"
      onClick={onClick}
      className="max-w-full"
    />
  );
}

function RecordedDateFilters(props: {
  fromDate: string | null;
  toDate: string;
  onRecordedDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onOnRecordedDateChange: (value: string) => void;
  onClearOnRecordedDate: () => void;
}) {
  const {
    fromDate,
    toDate,
    onRecordedDate,
    onFromDateChange,
    onToDateChange,
    onOnRecordedDateChange,
    onClearOnRecordedDate,
  } = props;
  const dateInputClassName =
    "w-[8.5rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white";

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      <DateInput
        value={fromDate ?? ""}
        onChange={(e) => onFromDateChange(e.target.value || todayStr())}
        className={dateInputClassName}
        aria-label="From date"
      />
      <span className="text-xs text-slate-400">to</span>
      <DateInput
        value={toDate}
        onChange={(e) => onToDateChange(e.target.value || todayStr())}
        className={dateInputClassName}
        aria-label="To date"
      />
      <span className="text-xs text-slate-400">|</span>
      <span className="text-xs text-slate-400">On</span>
      <DateInput
        value={onRecordedDate}
        onChange={(e) => onOnRecordedDateChange(e.target.value)}
        className={dateInputClassName}
        aria-label="On date recorded"
      />
      {onRecordedDate ? (
        <button
          type="button"
          onClick={onClearOnRecordedDate}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          aria-label="Clear on date filter"
          title="Clear on date filter"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type TabId = "debts" | "expenses";

// ---------------------------------------------------------------------------
// Main page component
export interface DebtsAndExpensesPageProps {
  orgId?: string;
  branchId?: string;
  branchName?: string;
}

export function DebtsAndExpensesPage({
  orgId: propOrgId,
  branchId: propBranchId,
  branchName: propBranchName,
}: DebtsAndExpensesPageProps = {}) {
  const token = useAppSelector(selectToken);
  const keycloakUsername = useAppSelector(selectUsername);
  const contextOrgId = useAppSelector(selectOrgId);
  const contextBranchId = useAppSelector(selectBranchId);
  const contextBranchName = useAppSelector(selectBranchName);

  const orgId = propOrgId ?? contextOrgId;
  const branchId = propBranchId ?? contextBranchId;
  const branchName = propBranchName ?? contextBranchName;
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: meData } = useQuery({
    queryKey: ["me", token, orgId],
    queryFn: () => fetchMe(token, orgId!),
    enabled: Boolean(token && orgId),
  });

  const defaultIssuedByName =
    meData?.profile?.displayName?.trim() ||
    keycloakUsername ||
    meData?.username ||
    "";

  // Shared state
  const [tab, setTab] = useState<TabId>("debts");
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState(todayStr);
  const [onRecordedDate, setOnRecordedDate] = useState("");
  const fromDateBootstrappedRef = useRef(false);

  const dateRangeReady = fromDate !== null;
  const effectiveFromDate = onRecordedDate || fromDate!;
  const effectiveToDate = onRecordedDate || toDate;
  const dateRangeLabel = onRecordedDate
    ? onRecordedDate
    : `${fromDate ?? ""} to ${toDate}`;

  useEffect(() => {
    fromDateBootstrappedRef.current = false;
    setFromDate(null);
    setOnRecordedDate("");
  }, [orgId, branchId]);

  const { data: activeDebtsBootstrapPage, isLoading: activeDebtsBootstrapLoading } = useQuery({
    queryKey: ["operator-debts-active-bootstrap", token, orgId, branchId],
    queryFn: () =>
      fetchDebts(token, orgId!, branchId!, {
        page: 0,
        size: 2000,
        status: ["OPEN", "PARTIAL"],
      }),
    enabled: Boolean(token && orgId && branchId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (fromDateBootstrappedRef.current || activeDebtsBootstrapLoading) {
      return;
    }
    if (activeDebtsBootstrapPage === undefined) {
      return;
    }
    const earliest = earliestDebtDateStr(activeDebtsBootstrapPage.content ?? []);
    setFromDate(earliest ?? defaultFromDateStr());
    fromDateBootstrappedRef.current = true;
  }, [activeDebtsBootstrapPage, activeDebtsBootstrapLoading]);

  // -----------------------------------------------------------------------
  // Debts state
  // -----------------------------------------------------------------------
  const [debtsPage, setDebtsPage] = useState(0);
  const [debtFormOpen, setDebtFormOpen] = useState(false);
  const [debtFormCustomerName, setDebtFormCustomerName] = useState("");
  const [debtFormCustomerPhone, setDebtFormCustomerPhone] = useState("");
  const [debtFormIssuedBy, setDebtFormIssuedBy] = useState("");
  const [issuedByNamesRevision, setIssuedByNamesRevision] = useState(0);
  const [debtFormAmount, setDebtFormAmount] = useState("");
  const [debtFormRecordedOn, setDebtFormRecordedOn] = useState(todayInputValue());
  const [debtFormDueDate, setDebtFormDueDate] = useState("");
  const [debtFormNotes, setDebtFormNotes] = useState("");
  const [debtFormBorrowedLines, setDebtFormBorrowedLines] = useState<BorrowedLineDraft[]>([]);
  const [debtFormAddItemId, setDebtFormAddItemId] = useState("");
  const [debtSubmitting, setDebtSubmitting] = useState(false);
  const [debtEditFormOpen, setDebtEditFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<CustomerDebtResponse | null>(null);
  const [editDebtCustomerName, setEditDebtCustomerName] = useState("");
  const [editDebtCustomerPhone, setEditDebtCustomerPhone] = useState("");
  const [editDebtIssuedBy, setEditDebtIssuedBy] = useState("");
  const [editDebtAmount, setEditDebtAmount] = useState("");
  const [editDebtDueDate, setEditDebtDueDate] = useState("");
  const [editDebtNotes, setEditDebtNotes] = useState("");
  const [editDebtSubmitting, setEditDebtSubmitting] = useState(false);
  const [clearDialogDebt, setClearDialogDebt] = useState<CustomerDebtResponse | null>(null);
  const [clearDebtSubmitting, setClearDebtSubmitting] = useState(false);
  const [settleFormOpen, setSettleFormOpen] = useState(false);
  const [settlingDebt, setSettlingDebt] = useState<CustomerDebtResponse | null>(null);
  const [settlingCustomerName, setSettlingCustomerName] = useState("");
  const [settleSingleDebtOnly, setSettleSingleDebtOnly] = useState(false);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleSubmitting, setSettleSubmitting] = useState(false);
  const [inlinePayDebtId, setInlinePayDebtId] = useState<string | null>(null);
  const [inlinePayValue, setInlinePayValue] = useState("");
  const [inlinePaySubmitting, setInlinePaySubmitting] = useState(false);
  const [inlineNameDebtId, setInlineNameDebtId] = useState<string | null>(null);
  const [inlineNameValue, setInlineNameValue] = useState("");
  const [inlineNameSubmitting, setInlineNameSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_OUTSTANDING);
  const {
    sortColumn: debtSortColumn,
    sortDirection: debtSortDirection,
    toggleSort: toggleDebtSort,
  } = useTableSort("debts");

  const debtStatusFilterOptions = useMemo(
    () => STATUS_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
    []
  );

  const [debtGroupBy, setDebtGroupBy] = useState<DebtGroupByOption>("none");

  // -----------------------------------------------------------------------
  // Expenses state
  // -----------------------------------------------------------------------
  const [expensesPage, setExpensesPage] = useState(0);
  const [expFormOpen, setExpFormOpen] = useState(false);
  const [expFormAmount, setExpFormAmount] = useState("");
  const [expFormCategory, setExpFormCategory] = useState("Other");
  const [expFormDescription, setExpFormDescription] = useState("");
  const [expFormIncurredBy, setExpFormIncurredBy] = useState("");
  const [expFormReceiptRef, setExpFormReceiptRef] = useState("");
  const [expFormRecordedOn, setExpFormRecordedOn] = useState(todayInputValue());
  const [expEditFormOpen, setExpEditFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<MiscExpenseResponse | null>(null);
  const [editExpAmount, setEditExpAmount] = useState("");
  const [editExpCategory, setEditExpCategory] = useState("Other");
  const [editExpDescription, setEditExpDescription] = useState("");
  const [editExpIncurredBy, setEditExpIncurredBy] = useState("");
  const [editExpReceiptRef, setEditExpReceiptRef] = useState("");
  const [editExpSubmitting, setEditExpSubmitting] = useState(false);
  const [cancelDialogExpense, setCancelDialogExpense] = useState<MiscExpenseResponse | null>(null);
  const [cancelExpSubmitting, setCancelExpSubmitting] = useState(false);
  const {
    sortColumn: expSortColumn,
    sortDirection: expSortDirection,
    toggleSort: toggleExpSort,
  } = useTableSort("expenses");

  const [expGroupBy, setExpGroupBy] = useState<ExpenseGroupByOption>("none");

  const handleOnRecordedDateChange = (value: string) => {
    setOnRecordedDate(value);
    setDebtsPage(0);
    setExpensesPage(0);
  };

  const clearOnRecordedDate = () => {
    setOnRecordedDate("");
    setDebtsPage(0);
    setExpensesPage(0);
  };

  const { data: categoriesFromApi } = useQuery({
    queryKey: ["expense-categories", token, orgId],
    queryFn: () => fetchExpenseCategories(token, orgId!, branchId!),
    enabled: Boolean(token && orgId && branchId),
    staleTime: 60_000,
  });

  const expenseCategoryOptions = useMemo(() => {
    const fromApi = categoriesFromApi ?? [];
    const merged = new Set([...fromApi, ...DEFAULT_EXPENSE_CATEGORIES]);
    return [...merged]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
      .map((c) => ({ value: c, label: c }));
  }, [categoriesFromApi]);


  // -----------------------------------------------------------------------
  // Debts queries
  // -----------------------------------------------------------------------
  const { data: debtsData, isLoading: debtsLoading, isError: debtsIsError, error: debtsError, refetch: refetchDebts, isFetching: isDebtsFetching } = useQuery({
    queryKey: ["operator-debts", token, orgId, branchId, debtsPage, statusFilter, fromDate, toDate, onRecordedDate],
    queryFn: () =>
      fetchDebts(token, orgId!, branchId!, {
        page: debtsPage,
        size: DEBTS_PAGE_SIZE,
        status: statusQueryForFilter(statusFilter),
        fromDate: effectiveFromDate,
        toDate: effectiveToDate,
      }),
    enabled: Boolean(token && orgId && branchId && dateRangeReady),
  });

  const { data: debtsTotalPage, isLoading: pendingTotalLoading } = useQuery({
    queryKey: [PENDING_TOTAL_QUERY_KEY, token, orgId, branchId, fromDate, toDate, onRecordedDate, statusFilter],
    queryFn: () =>
      fetchDebts(token, orgId!, branchId!, {
        page: 0,
        size: 2000,
        status: statusQueryForFilter(statusFilter),
        fromDate: effectiveFromDate,
        toDate: effectiveToDate,
      }),
    enabled: Boolean(token && orgId && branchId && dateRangeReady),
  });

  const { data: issuedByDebtsPage } = useQuery({
    queryKey: ["operator-debts-issued-by-names", token, orgId, branchId],
    queryFn: () =>
      fetchDebts(token, orgId!, branchId!, {
        page: 0,
        size: 2000,
      }),
    enabled: Boolean(token && orgId && branchId),
    staleTime: 60_000,
  });

  const { data: serverGroupedDebts = [], isLoading: isGroupedDebtsLoading } = useQuery({
    queryKey: [
      "operator-debts",
      "grouped",
      token,
      orgId,
      branchId,
      debtGroupBy,
      statusFilter,
      effectiveFromDate,
      effectiveToDate,
    ],
    queryFn: () =>
      fetchGroupedDebts(token, orgId!, branchId!, {
        groupBy: debtGroupBy,
        status: statusQueryForFilter(statusFilter),
        fromDate: effectiveFromDate,
        toDate: effectiveToDate,
      }),
    enabled: Boolean(token && orgId && branchId && dateRangeReady && debtGroupBy !== "none"),
  });

  const issuedBySelectOptions = useMemo(() => {
    if (!orgId || !branchId) {
      return [];
    }
    const fromDebts = (issuedByDebtsPage?.content ?? [])
      .map((d) => d.issuedBy)
      .filter((name): name is string => !!name && name.trim() !== "");
    const fromStorage = readSavedIssuedByNames(orgId, branchId);
    return buildIssuedBySelectOptions([...fromDebts, ...fromStorage]);
  }, [issuedByDebtsPage, orgId, branchId, issuedByNamesRevision]);

  const registerIssuedByName = (name: string | undefined) => {
    const trimmed = name?.trim();
    if (!orgId || !branchId || !trimmed) {
      return;
    }
    addSavedIssuedByName(orgId, branchId, trimmed);
    setIssuedByNamesRevision((r) => r + 1);
    void queryClient.invalidateQueries({
      queryKey: ["operator-debts-issued-by-names"],
    });
  };

  // Per-customer outstanding totals, sorted max → min, for the "Total pending"
  // breakdown modal. Cancelled debts are excluded to match the pending total.
  const [debtBreakdownOpen, setDebtBreakdownOpen] = useState(false);

  const debtFormDataEnabled = Boolean(debtFormOpen && token && orgId);


  const { data: debtCatalogItems = [], isLoading: debtCatalogLoading } = useQuery({
    queryKey: ["debts-record-catalog", orgId],
    queryFn: () => fetchAllOrgItems(token!, orgId!),
    enabled: debtFormDataEnabled,
  });

  const pricedItemsForDebt = useMemo(() => {
    const out: { item: Item; price: number }[] = [];
    for (const item of debtCatalogItems) {
      if (!item.active) {
        continue;
      }
      const price = item.defaultSellingPrice;
      if (price != null && price > 0) {
        out.push({ item, price });
      }
    }
    out.sort((a, b) =>
      a.item.name.localeCompare(b.item.name, undefined, { sensitivity: "base" })
    );
    return out;
  }, [debtCatalogItems]);

  const debtAddItemOptions = useMemo(
    () => [
      { value: "", label: "Search or select item to add…" },
      ...pricedItemsForDebt.map(({ item, price }) => ({
        value: item.id,
        label: item.name,
        detail: `${formatCurrency(price)}${item.sku ? ` · ${item.sku}` : ""}`,
      })),
    ],
    [pricedItemsForDebt]
  );

  const borrowedItemsSubtotal = useMemo(
    () => debtFormBorrowedLines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0),
    [debtFormBorrowedLines]
  );

  // -----------------------------------------------------------------------
  // Expenses queries
  // -----------------------------------------------------------------------
  const { data: expensesData, isLoading: expensesLoading, isError: expensesIsError, error: expensesError, refetch: refetchExpenses, isFetching: isExpensesFetching } = useQuery({
    queryKey: ["operator-misc-expenses", token, orgId, branchId, expensesPage, fromDate, toDate, onRecordedDate],
    queryFn: () =>
      fetchMiscExpenses(token, orgId!, branchId!, {
        page: expensesPage,
        size: EXPENSES_PAGE_SIZE,
        fromDate: effectiveFromDate,
        toDate: effectiveToDate,
      }),
    enabled: Boolean(token && orgId && branchId && dateRangeReady),
  });

  // Full dataset for the current date range — powers cross-page search.
  const { data: expensesTotalPage } = useQuery({
    queryKey: ["operator-misc-expenses-all", token, orgId, branchId, fromDate, toDate, onRecordedDate],
    queryFn: () =>
      fetchMiscExpenses(token, orgId!, branchId!, {
        page: 0,
        size: 2000,
        fromDate: effectiveFromDate,
        toDate: effectiveToDate,
      }),
    enabled: Boolean(token && orgId && branchId && dateRangeReady),
  });

  const { data: serverGroupedExpenses = [], isLoading: isGroupedExpensesLoading } = useQuery({
    queryKey: [
      "operator-misc-expenses",
      "grouped",
      token,
      orgId,
      branchId,
      expGroupBy,
      effectiveFromDate,
      effectiveToDate,
    ],
    queryFn: () =>
      fetchGroupedExpenses(token, orgId!, branchId!, {
        groupBy: expGroupBy,
        fromDate: effectiveFromDate,
        toDate: effectiveToDate,
      }),
    enabled: Boolean(token && orgId && branchId && dateRangeReady && expGroupBy !== "none"),
  });

  // -----------------------------------------------------------------------
  // Debts mutations
  // -----------------------------------------------------------------------
  const handleAddBorrowedItem = (itemId: string) => {
    if (!itemId) return;
    const row = pricedItemsForDebt.find((x) => x.item.id === itemId);
    if (!row) return;
    setDebtFormBorrowedLines((prev) => {
      const idx = prev.findIndex((l) => l.itemId === itemId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          itemId: row.item.id,
          itemName: row.item.name,
          sku: row.item.sku,
          unitPrice: row.price,
          qty: 1,
        },
      ];
    });
    setDebtFormAddItemId("");
  };

  const adjustBorrowedQty = (itemId: string, delta: number) => {
    setDebtFormBorrowedLines((prev) => {
      const idx = prev.findIndex((l) => l.itemId === itemId);
      if (idx < 0) return prev;
      const line = prev[idx];
      const nextQty = line.qty + delta;
      if (nextQty < 1) return prev.filter((l) => l.itemId !== itemId);
      const next = [...prev];
      next[idx] = { ...line, qty: nextQty };
      return next;
    });
  };

  const removeBorrowedLine = (itemId: string) => {
    setDebtFormBorrowedLines((prev) => prev.filter((l) => l.itemId !== itemId));
  };

  const openDebtRecordForm = () => {
    setDebtFormIssuedBy(defaultIssuedByName);
    setDebtFormOpen(true);
  };

  const createDebtMutation = useMutation({
    mutationFn: (body: CustomerDebtCreateRequest) =>
      createDebt(token, orgId!, branchId!, body),
    onSuccess: (_data, variables) => {
      registerIssuedByName(variables.issuedBy);
      queryClient.invalidateQueries({ queryKey: ["operator-debts"] });
      queryClient.invalidateQueries({ queryKey: [PENDING_TOTAL_QUERY_KEY] });
      setDebtFormOpen(false);
      setDebtFormCustomerName("");
      setDebtFormCustomerPhone("");
      setDebtFormIssuedBy("");
      setDebtFormAmount("");
      setDebtFormRecordedOn(todayInputValue());
      setDebtFormDueDate("");
      setDebtFormNotes("");
      setDebtFormBorrowedLines([]);
      setDebtFormAddItemId("");
      toast.success("Debt recorded.", { title: "Customer debt" });
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const updateDebtMutation = useMutation({
    mutationFn: ({ debtId, body }: { debtId: string; body: CustomerDebtUpdateRequest }) =>
      updateDebt(token, orgId!, branchId!, debtId, body),
    onSuccess: (_data, variables) => {
      registerIssuedByName(variables.body.issuedBy);
      queryClient.invalidateQueries({ queryKey: ["operator-debts"] });
      queryClient.invalidateQueries({ queryKey: [PENDING_TOTAL_QUERY_KEY] });
      setDebtEditFormOpen(false);
      setEditingDebt(null);
      toast.success("Debt updated.", { title: "Customer debt" });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  const cancelDebtMutation = useMutation({
    mutationFn: (debtId: string) => cancelDebt(token, orgId!, branchId!, debtId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-debts"] });
      queryClient.invalidateQueries({ queryKey: [PENDING_TOTAL_QUERY_KEY] });
      setClearDialogDebt(null);
      toast.success("Debt cleared.", { title: "Customer debt" });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  const settleBulkMutation = useMutation({
    mutationFn: ({
      customerName,
      paymentAmount,
    }: {
      customerName: string;
      paymentAmount: number;
    }) =>
      settleCustomerDebtsBulkByName(token, orgId!, branchId!, customerName, paymentAmount),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["operator-debts"] });
      queryClient.invalidateQueries({ queryKey: [PENDING_TOTAL_QUERY_KEY] });
      setSettleFormOpen(false);
      setSettlingDebt(null);
      setSettlingCustomerName("");
      setSettleAmount("");
      setSettleSingleDebtOnly(false);
      const count = result.allocations.length;
      toast.success(
        `${formatCurrency(result.totalApplied)} applied across ${count} debt${count === 1 ? "" : "s"} (oldest first).`,
        { title: "Customer debt" }
      );
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  const settleMutation = useMutation({
    mutationFn: ({ debtId, paymentAmount }: { debtId: string; paymentAmount: number }) =>
      settleDebt(token, orgId!, branchId!, debtId, paymentAmount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-debts"] });
      queryClient.invalidateQueries({ queryKey: [PENDING_TOTAL_QUERY_KEY] });
      setSettleFormOpen(false);
      setSettlingDebt(null);
      setSettlingCustomerName("");
      setSettleAmount("");
      setSettleSingleDebtOnly(false);
      toast.success("Payment recorded.", { title: "Customer debt" });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  // -----------------------------------------------------------------------
  // Expenses mutations
  // -----------------------------------------------------------------------
  const createExpMutation = useMutation({
    mutationFn: (body: MiscExpenseCreateRequest) =>
      createMiscExpense(token, orgId!, branchId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-misc-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      setExpFormOpen(false);
      setExpFormAmount("");
      setExpFormCategory("Other");
      setExpFormDescription("");
      setExpFormIncurredBy("");
      setExpFormReceiptRef("");
      setExpFormRecordedOn(todayInputValue());
      toast.success("Expense recorded.", { title: "Miscellaneous expense" });
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const updateExpMutation = useMutation({
    mutationFn: ({ expenseId, body }: { expenseId: string; body: MiscExpenseUpdateRequest }) =>
      updateMiscExpense(token, orgId!, branchId!, expenseId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-misc-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      setExpEditFormOpen(false);
      setEditingExpense(null);
      toast.success("Expense updated.", { title: "Miscellaneous expense" });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  const cancelExpMutation = useMutation({
    mutationFn: (expenseId: string) => cancelMiscExpense(token, orgId!, branchId!, expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-misc-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      setCancelDialogExpense(null);
      toast.success("Expense deleted.", { title: "Miscellaneous expense" });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  // -----------------------------------------------------------------------
  // Debts derived data + handlers
  // -----------------------------------------------------------------------
  // We render from the bulk dataset (already fetched for search/totals), not
  // the paginated API response — that lets us sort alphabetically A–Z across
  // every page instead of just the visible 20 rows.
  const debts = useMemo(() => debtsData?.content ?? [], [debtsData]);
  const debtsAll = useMemo(() => debtsTotalPage?.content ?? [], [debtsTotalPage]);
  const baseDebts = useMemo(() => {
    const source = debtsAll.length > 0 ? debtsAll : debts;
    return [...source].sort(debtByNameAsc);
  }, [debtsAll, debts]);
  const [debtSearchQuery, setDebtSearchQuery] = useState("");
  const debtSearchActive = debtSearchQuery.trim().length > 0;
  const filteredDebts = useMemo(
    () =>
      debtSearchActive
        ? filterRowsBySearch(baseDebts, debtSearchQuery, undefined, DEBT_SORT)
        : baseDebts,
    [baseDebts, debtSearchActive, debtSearchQuery]
  );
  const sortedDebts = useMemo(
    () =>
      sortTableRows(
        filteredDebts,
        { column: debtSortColumn, direction: debtSortDirection },
        (row, column) => DEBT_SORT[column]?.(row) ?? null
      ),
    [filteredDebts, debtSortColumn, debtSortDirection]
  );
  const visibleDebts = useMemo(() => {
    if (debtSearchActive) return sortedDebts;
    const start = debtsPage * DEBTS_PAGE_SIZE;
    return sortedDebts.slice(start, start + DEBTS_PAGE_SIZE);
  }, [debtSearchActive, sortedDebts, debtsPage]);

  const showDebtPhoneCol = useMemo(
    () =>
      filteredDebts.some(
        (d: CustomerDebtResponse) =>
          !!d.customerPhone && d.customerPhone.trim() !== "" && d.customerPhone !== "—"
      ),
    [filteredDebts]
  );
  const showDebtDueCol = useMemo(
    () =>
      filteredDebts.some(
        (d: CustomerDebtResponse) =>
          !!d.dueDate && d.dueDate !== "" && d.dueDate !== "—"
      ),
    [filteredDebts]
  );
  const showDebtIssuedByCol = useMemo(
    () =>
      filteredDebts.some(
        (d: CustomerDebtResponse) =>
          !!d.issuedBy && d.issuedBy.trim() !== "" && d.issuedBy !== "—"
      ),
    [filteredDebts]
  );
  const showDebtNotesCol = useMemo(
    () =>
      filteredDebts.some(
        (d: CustomerDebtResponse) => !!d.notes && d.notes.trim() !== ""
      ),
    [filteredDebts]
  );
  const debtTotalElements = sortedDebts.length;

  const filteredGroupedDebts = useMemo(() => {
    if (!debtSearchActive) return serverGroupedDebts;
    const q = debtSearchQuery.trim().toLowerCase();
    return serverGroupedDebts.filter((g) => g.groupLabel.toLowerCase().includes(q));
  }, [serverGroupedDebts, debtSearchActive, debtSearchQuery]);

  const pendingTotalForDateRange = useMemo(
    () =>
      debtGroupBy !== "none"
        ? filteredGroupedDebts.reduce((sum, g) => sum + (g.totalOutstanding ?? 0), 0)
        : sortedDebts
            .filter((d) => d.status !== "CANCELLED")
            .reduce((sum, d) => sum + (d.outstanding ?? 0), 0),
    [debtGroupBy, filteredGroupedDebts, sortedDebts],
  );

  const debtsByCustomer = useMemo(() => {
    const acc = new Map<string, { customerName: string; amount: number }>();
    for (const d of sortedDebts) {
      if (d.status === "CANCELLED") continue;
      const amt = Number(d.outstanding ?? 0);
      if (amt <= 0) continue;
      const key = normalizeCustomerName(d.customerName);
      const existing = acc.get(key);
      if (existing) {
        existing.amount += amt;
      } else {
        acc.set(key, { customerName: d.customerName, amount: amt });
      }
    }
    const total = [...acc.values()].reduce((s, row) => s + row.amount, 0);
    return {
      rows: [...acc.values()]
        .map((row) => ({
          ...row,
          pct: total > 0 ? (row.amount / total) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount),
      total,
    };
  }, [sortedDebts]);

  const settlingCustomerDebts = useMemo(() => {
    if (!settlingCustomerName.trim()) return [];
    const key = normalizeCustomerName(settlingCustomerName);
    return baseDebts.filter(
      (d) =>
        normalizeCustomerName(d.customerName) === key &&
        (d.status === "OPEN" || d.status === "PARTIAL") &&
        (d.outstanding ?? 0) > 0
    );
  }, [baseDebts, settlingCustomerName]);

  const settlingCustomerOutstanding = useMemo(
    () => customerTotalOutstanding(settlingCustomerDebts),
    [settlingCustomerDebts]
  );

  const settleUsesLumpSum =
    !settleSingleDebtOnly && settlingCustomerDebts.length >= 2;

  const settleMaxAmount = settleUsesLumpSum
    ? settlingCustomerOutstanding
    : settlingDebt?.outstanding ?? settlingCustomerDebts[0]?.outstanding ?? 0;

  const allocationPreview = useMemo(() => {
    const amount = Number.parseFloat(settleAmount);
    if (!settleUsesLumpSum || !Number.isFinite(amount) || amount <= 0) {
      return null;
    }
    return allocateCustomerDebtPayment(settlingCustomerDebts, amount);
  }, [settleUsesLumpSum, settleAmount, settlingCustomerDebts]);

  const openDebtEditForm = (d: CustomerDebtResponse) => {
    setEditingDebt(d);
    setEditDebtCustomerName(d.customerName);
    setEditDebtCustomerPhone(d.customerPhone ?? "");
    setEditDebtIssuedBy(d.issuedBy ?? "");
    setEditDebtAmount(String(d.amount));
    setEditDebtDueDate(d.dueDate ?? "");
    setEditDebtNotes(d.notes ?? "");
    setDebtEditFormOpen(true);
  };

  const handleDebtEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebt) return;
    const name = editDebtCustomerName.trim();
    if (!name) {
      toast.error("Customer name is required.");
      return;
    }
    const amount = parseFloat(editDebtAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    const phoneTrim = editDebtCustomerPhone.trim();
    const customerPhonePayload: string | undefined =
      phoneTrim.length > 0 ? phoneTrim : editingDebt.customerPhone ? "" : undefined;
    setEditDebtSubmitting(true);
    try {
      await updateDebtMutation.mutateAsync({
        debtId: editingDebt.id,
        body: {
          customerName: name,
          ...(customerPhonePayload !== undefined ? { customerPhone: customerPhonePayload } : {}),
          amount,
          dueDate: editDebtDueDate || undefined,
          notes: editDebtNotes.trim() === "" ? "" : editDebtNotes.trim(),
          issuedBy: editDebtIssuedBy.trim() || undefined,
        },
      });
    } finally {
      setEditDebtSubmitting(false);
    }
  };

  const openSettleForm = (d: CustomerDebtResponse) => {
    setSettlingDebt(d);
    setSettlingCustomerName(d.customerName);
    setSettleSingleDebtOnly(false);
    setSettleAmount("");
    setSettleFormOpen(true);
  };

  const openCustomerSettleForm = (customerName: string) => {
    setSettlingDebt(null);
    setSettlingCustomerName(customerName);
    setSettleSingleDebtOnly(false);
    setSettleAmount("");
    setSettleFormOpen(true);
    setDebtBreakdownOpen(false);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingCustomerName.trim()) return;
    const amount = parseFloat(settleAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }
    if (amount > settleMaxAmount) {
      toast.error(
        settleUsesLumpSum
          ? "Payment cannot exceed the customer's total outstanding amount."
          : "Payment cannot exceed outstanding amount."
      );
      return;
    }
    setSettleSubmitting(true);
    try {
      if (settleUsesLumpSum) {
        await settleBulkMutation.mutateAsync({
          customerName: settlingCustomerName.trim(),
          paymentAmount: amount,
        });
      } else {
        const debtId = settlingDebt?.id ?? settlingCustomerDebts[0]?.id;
        if (!debtId) {
          toast.error("No open debt found for this customer.");
          return;
        }
        await settleMutation.mutateAsync({
          debtId,
          paymentAmount: amount,
        });
      }
    } finally {
      setSettleSubmitting(false);
    }
  };

  const handleClearDebtConfirm = async () => {
    if (!clearDialogDebt) return;
    setClearDebtSubmitting(true);
    try {
      await cancelDebtMutation.mutateAsync(clearDialogDebt.id);
    } finally {
      setClearDebtSubmitting(false);
    }
  };

  const canRecordPayment = (d: CustomerDebtResponse) =>
    d.status === "OPEN" || d.status === "PARTIAL";

  const canEditDebt = (d: CustomerDebtResponse) =>
    (d.status === "OPEN" || d.status === "PARTIAL") && Number(d.amountSettled ?? 0) === 0;

  const canClearDebt = (d: CustomerDebtResponse) =>
    (d.status === "OPEN" || d.status === "PARTIAL") && Number(d.amountSettled ?? 0) === 0;

  const startInlinePay = (d: CustomerDebtResponse) => {
    setInlinePayDebtId(d.id);
    setInlinePayValue("");
  };

  const cancelInlinePay = () => {
    setInlinePayDebtId(null);
    setInlinePayValue("");
  };

  const submitInlinePay = async (d: CustomerDebtResponse) => {
    const err = validateInlinePay(inlinePayValue, d.outstanding);
    if (err !== null || inlinePayValue.trim() === "") {
      toast.error(err ?? "Enter a payment amount.");
      return;
    }
    const n = Number.parseFloat(inlinePayValue);
    setInlinePaySubmitting(true);
    try {
      await settleMutation.mutateAsync({ debtId: d.id, paymentAmount: n });
      cancelInlinePay();
    } finally {
      setInlinePaySubmitting(false);
    }
  };

  const startInlineName = (d: CustomerDebtResponse) => {
    setInlineNameDebtId(d.id);
    setInlineNameValue(d.customerName);
  };

  const cancelInlineName = () => {
    setInlineNameDebtId(null);
    setInlineNameValue("");
  };

  const submitInlineName = async (d: CustomerDebtResponse) => {
    const name = inlineNameValue.trim();
    if (name === "") {
      toast.error("Customer name cannot be empty.");
      return;
    }
    if (name === d.customerName) {
      cancelInlineName();
      return;
    }
    setInlineNameSubmitting(true);
    try {
      await updateDebtMutation.mutateAsync({
        debtId: d.id,
        body: { customerName: name },
      });
      cancelInlineName();
    } finally {
      setInlineNameSubmitting(false);
    }
  };

  const handleDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = debtFormCustomerName.trim();
    const manualAmount = parseFloat(debtFormAmount);
    const fromItems = debtFormBorrowedLines.length > 0 ? borrowedItemsSubtotal : 0;
    const amount =
      debtFormBorrowedLines.length > 0 ? Number(fromItems.toFixed(2)) : manualAmount;
    if (!name) {
      toast.error("Enter customer name.");
      return;
    }
    if (debtFormBorrowedLines.length > 0) {
      if (fromItems <= 0 || Number.isNaN(fromItems)) {
        toast.error("Add at least one borrowed item with quantity.");
        return;
      }
    } else if (isNaN(manualAmount) || manualAmount <= 0) {
      toast.error("Enter a valid amount or add borrowed items.");
      return;
    }
    const itemsBlock = borrowedItemsNoteBlock(debtFormBorrowedLines);
    const userNotes = debtFormNotes.trim();
    const combinedNotes =
      [itemsBlock, userNotes].filter((s) => s.length > 0).join("\n\n") || undefined;
    setDebtSubmitting(true);
    try {
      const customer = await createCustomer(token, orgId!, {
        name,
        phone: debtFormCustomerPhone.trim() || undefined,
      });
      await createDebtMutation.mutateAsync({
        customerId: customer.id,
        amount,
        dueDate: debtFormDueDate || undefined,
        notes: combinedNotes,
        issuedBy: debtFormIssuedBy.trim() || undefined,
        createdAt: recordedAtToCreatedAt(debtFormRecordedOn),
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    } finally {
      setDebtSubmitting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Expenses derived data + handlers
  // -----------------------------------------------------------------------
  const expenses = useMemo(() => expensesData?.content ?? [], [expensesData]);
  const expensesAll = useMemo(
    () => expensesTotalPage?.content ?? [],
    [expensesTotalPage],
  );
  // Same approach as debts: render from the bulk dataset so the A–Z ordering
  // holds across every page. Sort key is "incurredBy" when present (person's
  // name), otherwise "description" — keeps rows with a real name grouped.
  const baseExpenses = useMemo(() => {
    const source = expensesAll.length > 0 ? expensesAll : expenses;
    return [...source].sort(expenseByNameAsc);
  }, [expensesAll, expenses]);
  const [expSearchQuery, setExpSearchQuery] = useState("");
  const expSearchActive = expSearchQuery.trim().length > 0;
  const filteredExpenses = useMemo(
    () =>
      expSearchActive
        ? filterRowsBySearch(baseExpenses, expSearchQuery, undefined, EXPENSE_SORT)
        : baseExpenses,
    [baseExpenses, expSearchActive, expSearchQuery]
  );
  const sortedExpenses = useMemo(
    () =>
      sortTableRows(
        filteredExpenses,
        { column: expSortColumn, direction: expSortDirection },
        (row, column) => EXPENSE_SORT[column]?.(row) ?? null
      ),
    [filteredExpenses, expSortColumn, expSortDirection]
  );
  const visibleExpenses = useMemo(() => {
    if (expSearchActive) return sortedExpenses;
    const start = expensesPage * EXPENSES_PAGE_SIZE;
    return sortedExpenses.slice(start, start + EXPENSES_PAGE_SIZE);
  }, [expSearchActive, sortedExpenses, expensesPage]);

  const showExpIncurredByCol = useMemo(
    () =>
      sortedExpenses.some(
        (e: MiscExpenseResponse) =>
          !!e.incurredBy && e.incurredBy.trim() !== "" && e.incurredBy !== "—"
      ),
    [sortedExpenses]
  );
  const showExpReceiptRefCol = useMemo(
    () =>
      sortedExpenses.some(
        (e: MiscExpenseResponse) =>
          !!e.receiptRef && e.receiptRef.trim() !== "" && e.receiptRef !== "—"
      ),
    [sortedExpenses]
  );
  const expTotalElements = sortedExpenses.length;
  const filteredGroupedExpenses = useMemo(() => {
    if (!expSearchActive) return serverGroupedExpenses;
    const q = expSearchQuery.trim().toLowerCase();
    return serverGroupedExpenses.filter((g) => g.groupLabel.toLowerCase().includes(q));
  }, [serverGroupedExpenses, expSearchActive, expSearchQuery]);

  const expTotalAmount = useMemo(
    () =>
      expGroupBy !== "none"
        ? filteredGroupedExpenses.reduce((sum, g) => sum + Number(g.totalAmount ?? 0), 0)
        : sortedExpenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0),
    [expGroupBy, filteredGroupedExpenses, sortedExpenses],
  );

  // Per-category subtotals, sorted max → min, for the "TOTAL" breakdown modal.
  const [expBreakdownOpen, setExpBreakdownOpen] = useState(false);
  const expensesByCategory = useMemo(() => {
    const acc = new Map<string, number>();
    for (const e of sortedExpenses) {
      acc.set(e.category, (acc.get(e.category) ?? 0) + Number(e.amount ?? 0));
    }
    const total = [...acc.values()].reduce((s, a) => s + a, 0);
    return {
      rows: [...acc.entries()]
        .map(([category, amount]) => ({
          category,
          amount,
          pct: total > 0 ? (amount / total) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount),
      total,
    };
  }, [sortedExpenses]);

  const openExpEditForm = (e: MiscExpenseResponse) => {
    setEditingExpense(e);
    setEditExpAmount(String(e.amount));
    setEditExpCategory(e.category || "Other");
    setEditExpDescription(e.description ?? "");
    setEditExpIncurredBy(e.incurredBy ?? "");
    setEditExpReceiptRef(e.receiptRef ?? "");
    setExpEditFormOpen(true);
  };

  const handleExpEditSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editingExpense) return;
    const amount = parseFloat(editExpAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    setEditExpSubmitting(true);
    try {
      await updateExpMutation.mutateAsync({
        expenseId: editingExpense.id,
        body: {
          amount,
          category: editExpCategory,
          description: editExpDescription.trim() || editExpCategory || "General",
          incurredBy: editExpIncurredBy.trim() || undefined,
          receiptRef: editExpReceiptRef.trim() || undefined,
        },
      });
    } finally {
      setEditExpSubmitting(false);
    }
  };

  const handleCancelExpConfirm = async () => {
    if (!cancelDialogExpense) return;
    setCancelExpSubmitting(true);
    try {
      await cancelExpMutation.mutateAsync(cancelDialogExpense.id);
    } finally {
      setCancelExpSubmitting(false);
    }
  };

  const handleExpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expFormAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    createExpMutation.mutate({
      amount,
      category: expFormCategory,
      description: expFormDescription.trim() || expFormCategory || "General",
      incurredBy: expFormIncurredBy.trim() || undefined,
      receiptRef: expFormReceiptRef.trim() || undefined,
      createdAt: recordedAtToCreatedAt(expFormRecordedOn),
    });
  };

  // -----------------------------------------------------------------------
  // PDF report downloads — all statuses, all rows in the selected date range
  // -----------------------------------------------------------------------
  const [debtsPdfLoading, setDebtsPdfLoading] = useState(false);
  const [expensesPdfLoading, setExpensesPdfLoading] = useState(false);

  const handleDownloadDebtsPdf = async () => {
    if (!orgId || !branchId || !dateRangeReady) return;
    setDebtsPdfLoading(true);
    try {
      const statusLabel =
        STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? "All";

      if (debtGroupBy !== "none") {
        if (filteredGroupedDebts.length === 0) {
          toast.error("No debts matching the selected filters to export.");
          return;
        }
        const groupByLabel =
          DEBT_GROUP_BY_OPTIONS.find((o) => o.value === debtGroupBy)?.label ?? debtGroupBy;
        downloadGroupedDebtsPdf(filteredGroupedDebts, {
          branchName,
          statusFilterLabel: statusLabel,
          dateRangeLabel,
          groupByLabel,
          searchQuery: debtSearchActive ? debtSearchQuery.trim() : undefined,
        });
      } else {
        const resp = await fetchDebts(token, orgId, branchId, {
          page: 0,
          size: 2000,
          status: statusQueryForFilter(statusFilter),
          fromDate: effectiveFromDate,
          toDate: effectiveToDate,
        });
        let rows = [...(resp.content ?? [])];
        if (debtSearchActive) {
          rows = filterRowsBySearch(rows, debtSearchQuery, undefined, DEBT_SORT);
        }
        rows = sortTableRows(
          rows,
          { column: debtSortColumn, direction: debtSortDirection },
          (row, column) => DEBT_SORT[column]?.(row) ?? null
        );
        if (rows.length === 0) {
          toast.error("No debts matching the selected filters to export.");
          return;
        }
        downloadDebtsPdf(rows, {
          branchName,
          statusFilterLabel: statusLabel,
          dateRangeLabel,
          searchQuery: debtSearchActive ? debtSearchQuery.trim() : undefined,
        });
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    } finally {
      setDebtsPdfLoading(false);
    }
  };

  const handleDownloadExpensesPdf = async () => {
    if (!orgId || !branchId || !dateRangeReady) return;
    setExpensesPdfLoading(true);
    try {
      if (expGroupBy !== "none") {
        if (filteredGroupedExpenses.length === 0) {
          toast.error("No expenses in the selected date range to export.");
          return;
        }
        const groupByLabel =
          EXPENSE_GROUP_BY_OPTIONS.find((o) => o.value === expGroupBy)?.label ?? expGroupBy;
        downloadGroupedExpensesPdf(filteredGroupedExpenses, {
          branchName,
          dateRangeLabel,
          groupByLabel,
          searchQuery: expSearchActive ? expSearchQuery.trim() : undefined,
        });
      } else {
        const resp = await fetchMiscExpenses(token, orgId, branchId, {
          page: 0,
          size: 2000,
          fromDate: effectiveFromDate,
          toDate: effectiveToDate,
        });
        let rows = [...(resp.content ?? [])];
        if (expSearchActive) {
          rows = filterRowsBySearch(rows, expSearchQuery, undefined, EXPENSE_SORT);
        }
        rows = sortTableRows(
          rows,
          { column: expSortColumn, direction: expSortDirection },
          (row, column) => EXPENSE_SORT[column]?.(row) ?? null
        );
        if (rows.length === 0) {
          toast.error("No expenses in the selected date range to export.");
          return;
        }
        const totalAmount = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
        downloadExpensesPdf(rows, {
          branchName,
          dateRangeLabel,
          searchQuery: expSearchActive ? expSearchQuery.trim() : undefined,
          totalAmount,
        });
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    } finally {
      setExpensesPdfLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // Guards
  // -----------------------------------------------------------------------
  if (!orgId || !branchId) {
    return (
      <div className="p-6">
        <p className="text-slate-500 dark:text-slate-400">
          Select organization and branch to manage debts and expenses.
        </p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-0 flex-1 overflow-auto p-1.5 sm:p-5">
      {/* Top Bar: Tabs on left, Actions (Download PDF + Record button) on right */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <AdminTabList
          tabListId="debts-expenses"
          ariaLabel="Debts and Expenses"
          tabs={[
            { id: "debts", label: "Debts", icon: HandCoins, enabled: true },
            { id: "expenses", label: "Expenses", icon: Receipt, enabled: true },
          ]}
          activeTab={tab}
          onTabChange={(id) => setTab(id as TabId)}
        />

        <div className="flex items-center gap-2">
          {tab === "debts" ? (
            <>
              {(debtGroupBy !== "none"
                ? filteredGroupedDebts.length > 0
                : debtTotalElements > 0) && (
                <button
                  type="button"
                  onClick={handleDownloadDebtsPdf}
                  disabled={debtsPdfLoading}
                  className="hidden xl:inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  title={
                    debtGroupBy !== "none"
                      ? `Download debts report (grouped by ${DEBT_GROUP_BY_OPTIONS.find((o) => o.value === debtGroupBy)?.label ?? debtGroupBy})`
                      : `Download debts from ${dateRangeLabel}`
                  }
                >
                  {debtsPdfLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Download PDF</span>
                </button>
              )}
              <button
                type="button"
                onClick={openDebtRecordForm}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700"
              >
                <Plus className="h-4 w-4" />
                <span>Record debt</span>
              </button>
            </>
          ) : (
            <>
              {(expGroupBy !== "none"
                ? filteredGroupedExpenses.length > 0
                : expTotalElements > 0) && (
                <button
                  type="button"
                  onClick={handleDownloadExpensesPdf}
                  disabled={expensesPdfLoading}
                  className="hidden xl:inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  title={
                    expGroupBy !== "none"
                      ? `Download expenses report (grouped by ${EXPENSE_GROUP_BY_OPTIONS.find((o) => o.value === expGroupBy)?.label ?? expGroupBy})`
                      : `Download all expenses from ${dateRangeLabel}`
                  }
                >
                  {expensesPdfLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Download PDF</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setExpFormOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700"
              >
                <Plus className="h-4 w-4" />
                <span>Record expense</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* DEBTS TAB                                                         */}
      {/* ================================================================= */}
      {tab === "debts" && (
        <AdminTabPanel panelId="debts-expenses-panel-debts" tabId="debts-expenses-tab-debts">

          {(debtsLoading || activeDebtsBootstrapLoading || !dateRangeReady || (debtGroupBy !== "none" && isGroupedDebtsLoading)) && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
            </div>
          )}

          {debtsIsError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
              <p className="font-medium text-red-800 dark:text-red-200">
                {getApiErrorMessage(debtsError)}
              </p>
            </div>
          )}

          {!debtsLoading && !activeDebtsBootstrapLoading && dateRangeReady && !debtsIsError && !(debtGroupBy !== "none" && isGroupedDebtsLoading) && (
            <>
              <div className="mb-4 flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <TableSearchInput value={debtSearchQuery} onChange={setDebtSearchQuery} placeholder="Search debts…" />
                  <div className="hidden xl:flex items-center gap-1.5">
                    <label
                      htmlFor="debt-status-filter"
                      className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400"
                    >
                      Status
                    </label>
                    <SearchableSelect
                      id="debt-status-filter"
                      options={debtStatusFilterOptions}
                      value={statusFilter}
                      onChange={(v) => {
                        setStatusFilter(v);
                        setDebtsPage(0);
                      }}
                      aria-label="Filter by status"
                      placeholder="Search status…"
                      compact
                      className="w-44"
                      controlClassName="border-slate-200 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 dark:border-slate-600 dark:focus:border-primary-400 dark:focus:ring-primary-400"
                    />
                  </div>
                  <div className="hidden xl:flex items-center gap-1.5">
                    <label
                      htmlFor="debt-group-by"
                      className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400"
                    >
                      Group by
                    </label>
                    <SearchableSelect
                      id="debt-group-by"
                      options={DEBT_GROUP_BY_OPTIONS}
                      value={debtGroupBy}
                      onChange={(v) => {
                        setDebtGroupBy(v as DebtGroupByOption);
                        setDebtsPage(0);
                      }}
                      aria-label="Group debts by"
                      placeholder="Group by…"
                      compact
                      className="w-48"
                      controlClassName="border-slate-200 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 dark:border-slate-600 dark:focus:border-primary-400 dark:focus:ring-primary-400"
                    />
                  </div>
                  <div className="hidden xl:block">
                    <RecordedDateFilters
                      fromDate={fromDate}
                      toDate={toDate}
                      onRecordedDate={onRecordedDate}
                      onFromDateChange={setFromDate}
                      onToDateChange={setToDate}
                      onOnRecordedDateChange={handleOnRecordedDateChange}
                      onClearOnRecordedDate={clearOnRecordedDate}
                    />
                  </div>
                </div>
                {onRecordedDate ? (
                  <p className="hidden xl:block text-xs text-slate-500 dark:text-slate-400">
                    Showing debts recorded on {onRecordedDate}
                  </p>
                ) : null}
              </div>
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                {(debtGroupBy !== "none" ? filteredGroupedDebts.length === 0 : filteredDebts.length === 0) ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <HandCoins className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                    <p className="mt-4 text-slate-500 dark:text-slate-400">
                      {!debtSearchActive ? "No debts recorded yet. Record a debt when a customer buys on credit." : "No results match your search."}
                    </p>
                    {!debtSearchActive && (
                      <button
                        type="button"
                        onClick={openDebtRecordForm}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary-500 bg-transparent px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/30"
                      >
                        <Plus className="h-4 w-4" />
                        Record debt
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {debtSearchActive && (
                      <p className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                        Showing {debtGroupBy !== "none" ? filteredGroupedDebts.length : filteredDebts.length} match{(debtGroupBy !== "none" ? filteredGroupedDebts.length : filteredDebts.length) === 1 ? "" : "es"}{debtGroupBy === "none" ? " across all pages in the selected range." : "."}
                      </p>
                    )}
                    <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">&larr; swipe table to see all columns &rarr;</p>
                    <div className="relative min-h-0 flex-1 overflow-auto">
                      <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
                      <table className="w-full min-w-full divide-y divide-slate-200 dark:divide-slate-600 xl:min-w-[1100px]">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                          <tr>
                            <TableRowNumberHead className={`${tableRowNoHead} hidden xl:table-cell`} />
                            {debtGroupBy !== "none" ? (
                              <>
                                <th
                                  className={`${tableStickyHeadCell} px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300`}
                                >
                                  {debtGroupBy === "customer"
                                    ? "Customer"
                                    : debtGroupBy === "issuedBy"
                                      ? "Issued by"
                                      : debtGroupBy === "status"
                                        ? "Status"
                                        : "Date"}
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300">
                                  Original (KSH)
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300">
                                  Repaid (KSH)
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300">
                                  Balance (KSH)
                                </th>
                              </>
                            ) : (
                              <>
                                <SortableTableHead
                                  columnKey="customer"
                                  label="Customer"
                                  sortColumn={debtSortColumn}
                                  sortDirection={debtSortDirection}
                                  onSort={toggleDebtSort}
                                  className={`${tableStickyHeadCell} px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300`}
                                />
                                {showDebtPhoneCol && (
                                  <SortableTableHead
                                    columnKey="phone"
                                    label="Phone"
                                    sortColumn={debtSortColumn}
                                    sortDirection={debtSortDirection}
                                    onSort={toggleDebtSort}
                                    className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300"
                                  />
                                )}
                                <SortableTableHead
                                  columnKey="amount"
                                  label="Original (KSH)"
                                  sortColumn={debtSortColumn}
                                  sortDirection={debtSortDirection}
                                  onSort={toggleDebtSort}
                                  className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300"
                                />
                                <SortableTableHead
                                  columnKey="amountSettled"
                                  label="Repaid (KSH)"
                                  sortColumn={debtSortColumn}
                                  sortDirection={debtSortDirection}
                                  onSort={toggleDebtSort}
                                  className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300"
                                />
                                <SortableTableHead
                                  columnKey="outstanding"
                                  label="Balance (KSH)"
                                  sortColumn={debtSortColumn}
                                  sortDirection={debtSortDirection}
                                  onSort={toggleDebtSort}
                                  className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300"
                                />
                                <SortableTableHead
                                  columnKey="status"
                                  label="Status"
                                  sortColumn={debtSortColumn}
                                  sortDirection={debtSortDirection}
                                  onSort={toggleDebtSort}
                                  className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300"
                                />
                                {showDebtDueCol && (
                                  <SortableTableHead
                                    columnKey="due"
                                    label="Due"
                                    sortColumn={debtSortColumn}
                                    sortDirection={debtSortDirection}
                                    onSort={toggleDebtSort}
                                    className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300"
                                  />
                                )}
                                {showDebtIssuedByCol && (
                                  <SortableTableHead
                                    columnKey="issuedBy"
                                    label="Issued by"
                                    sortColumn={debtSortColumn}
                                    sortDirection={debtSortDirection}
                                    onSort={toggleDebtSort}
                                    className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300"
                                  />
                                )}
                                <SortableTableHead
                                  columnKey="created"
                                  label="Created"
                                  sortColumn={debtSortColumn}
                                  sortDirection={debtSortDirection}
                                  onSort={toggleDebtSort}
                                  className="hidden px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl xl:table-cell dark:text-slate-300"
                                />
                                {showDebtNotesCol && (
                                  <SortableTableHead
                                    columnKey="notes"
                                    label="Notes"
                                    sortColumn={debtSortColumn}
                                    sortDirection={debtSortDirection}
                                    onSort={toggleDebtSort}
                                    className="hidden px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl xl:table-cell dark:text-slate-300"
                                  />
                                )}
                                <SortableTableHead
                                  columnKey="actions"
                                  label="Actions"
                                  sortColumn={debtSortColumn}
                                  sortDirection={debtSortDirection}
                                  onSort={toggleDebtSort}
                                  sortable={false}
                                  className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300"
                                />
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                          {debtGroupBy !== "none" ? (
                            filteredGroupedDebts.map((group, index) => (
                              <tr key={group.groupKey} className={tableBodyRow}>
                                <TableRowNumberCell
                                  className={`${tableRowNoCell} hidden xl:table-cell`}
                                  page={0}
                                  pageSize={filteredGroupedDebts.length}
                                  indexInPage={index}
                                />
                                <td
                                  className={`${tableStickyFirstCell} px-2 py-1.5 text-xs font-bold text-slate-900 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-white`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{group.groupLabel}</span>
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                      {group.count} {group.count === 1 ? "debt" : "debts"}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-2 py-1.5 text-left text-xs font-semibold tabular-nums text-slate-700 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-slate-300">
                                  {formatAmount(group.totalAmount)}
                                </td>
                                <td className="px-2 py-1.5 text-left text-xs font-semibold tabular-nums text-emerald-600 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-emerald-400">
                                  {formatAmount(group.totalAmountSettled)}
                                </td>
                                <td className="px-2 py-1.5 text-left text-xs font-bold tabular-nums text-red-600 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-red-400">
                                  {formatAmount(group.totalOutstanding)}
                                </td>
                              </tr>
                            ))
                          ) : (
                            visibleDebts.map((d: CustomerDebtResponse, index) => (
                              <tr key={d.id} className={tableBodyRow}>
                                <TableRowNumberCell className={`${tableRowNoCell} hidden xl:table-cell`} page={debtsPage} pageSize={DEBTS_PAGE_SIZE} indexInPage={index} />
                                <td
                                  className={`${tableStickyFirstCell} px-2 py-1.5 text-xs font-bold text-slate-900 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-white ${
                                    inlineNameDebtId !== d.id
                                      ? "cursor-pointer hover:underline"
                                      : ""
                                  }`}
                                  onClick={() => {
                                    if (inlineNameDebtId !== d.id) {
                                      startInlineName(d);
                                    }
                                  }}
                                  title={
                                    inlineNameDebtId !== d.id
                                      ? "Click to fix customer name"
                                      : undefined
                                  }
                                >
                                  {inlineNameDebtId === d.id ? (
                                    (() => {
                                      const trimmed = inlineNameValue.trim();
                                      const empty = trimmed === "";
                                      const unchanged = trimmed === d.customerName;
                                      return (
                                        <div
                                          className="flex flex-wrap items-center gap-2"
                                          onClick={(ev) => ev.stopPropagation()}
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              autoFocus
                                              type="text"
                                              value={inlineNameValue}
                                              disabled={inlineNameSubmitting}
                                              onChange={(ev) => setInlineNameValue(ev.target.value)}
                                              onFocus={(ev) => ev.currentTarget.select()}
                                              onKeyDown={(ev) => {
                                                if (ev.key === "Enter") {
                                                  ev.preventDefault();
                                                  void submitInlineName(d);
                                                } else if (ev.key === "Escape") {
                                                  ev.preventDefault();
                                                  cancelInlineName();
                                                }
                                              }}
                                              aria-invalid={empty}
                                              aria-label={`Edit customer name for ${d.customerName}`}
                                              className={`w-44 rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 ${
                                                empty
                                                  ? "border-red-400 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:bg-red-950/40 dark:text-red-200"
                                                  : "border-primary-300 bg-white text-slate-900 focus:border-primary-500 focus:ring-primary-500 dark:border-primary-700 dark:bg-slate-900 dark:text-white"
                                              }`}
                                            />
                                            <button
                                              type="button"
                                              onClick={() => void submitInlineName(d)}
                                              disabled={inlineNameSubmitting || empty || unchanged}
                                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                                              aria-label="Save name"
                                              title="Save (Enter)"
                                            >
                                              {inlineNameSubmitting ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                              ) : (
                                                <Check className="h-5 w-5" />
                                              )}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={cancelInlineName}
                                              disabled={inlineNameSubmitting}
                                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                              aria-label="Cancel"
                                              title="Cancel (Esc)"
                                            >
                                              <X className="h-5 w-5" />
                                            </button>
                                          </div>
                                          {empty && (
                                            <span className="w-full text-xs text-red-600 dark:text-red-400">
                                              Name cannot be empty.
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    d.customerName
                                  )}
                                </td>
                                {showDebtPhoneCol && (
                                  <td className="px-2 py-1.5 text-xs text-slate-600 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-slate-400">{d.customerPhone ?? "—"}</td>
                                )}
                                <td className="px-2 py-1.5 text-left text-xs tabular-nums text-slate-600 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-slate-400">{formatAmount(d.amount)}</td>
                                <td
                                  className={`px-2 py-1.5 text-left text-xs tabular-nums font-bold text-emerald-600 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-emerald-400 ${
                                    canRecordPayment(d) && inlinePayDebtId !== d.id
                                      ? "cursor-pointer hover:underline"
                                      : ""
                                  }`}
                                  onClick={() => {
                                    if (canRecordPayment(d) && inlinePayDebtId !== d.id) {
                                      startInlinePay(d);
                                    }
                                  }}
                                  title={
                                    canRecordPayment(d) && inlinePayDebtId !== d.id
                                      ? "Click to record a payment"
                                      : undefined
                                  }
                                >
                                  {inlinePayDebtId === d.id ? (
                                    (() => {
                                      const err = validateInlinePay(inlinePayValue, d.outstanding);
                                      const empty = inlinePayValue.trim() === "";
                                      return (
                                        <div
                                          className="flex flex-wrap items-center gap-2"
                                          onClick={(ev) => ev.stopPropagation()}
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              autoFocus
                                              type="number"
                                              step="0.01"
                                              min="0.01"
                                              max={d.outstanding}
                                              value={inlinePayValue}
                                              disabled={inlinePaySubmitting}
                                              onChange={(ev) => setInlinePayValue(ev.target.value)}
                                              onKeyDown={(ev) => {
                                                if (ev.key === "Enter") {
                                                  ev.preventDefault();
                                                  void submitInlinePay(d);
                                                } else if (ev.key === "Escape") {
                                                  ev.preventDefault();
                                                  cancelInlinePay();
                                                }
                                              }}
                                              placeholder={`Max ${d.outstanding.toFixed(2)}`}
                                              aria-invalid={!!err}
                                              aria-label={`Record payment for ${d.customerName}`}
                                              className={`w-32 rounded border px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-1 ${
                                                err
                                                  ? "border-red-400 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:bg-red-950/40 dark:text-red-200"
                                                  : "border-emerald-300 bg-white text-slate-900 focus:border-emerald-500 focus:ring-emerald-500 dark:border-emerald-700 dark:bg-slate-900 dark:text-white"
                                              }`}
                                            />
                                            <button
                                              type="button"
                                              onClick={() => void submitInlinePay(d)}
                                              disabled={inlinePaySubmitting || !!err || empty}
                                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                                              aria-label="Save payment"
                                              title="Save payment (Enter)"
                                            >
                                              {inlinePaySubmitting ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                              ) : (
                                                <Check className="h-5 w-5" />
                                              )}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={cancelInlinePay}
                                              disabled={inlinePaySubmitting}
                                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                              aria-label="Cancel"
                                              title="Cancel (Esc)"
                                            >
                                              <X className="h-5 w-5" />
                                            </button>
                                          </div>
                                          {err ? (
                                            <span className="w-full text-xs text-red-600 dark:text-red-400">
                                              {err}
                                            </span>
                                          ) : !empty ? (
                                            <span className="w-full text-xs text-slate-500 dark:text-slate-400">
                                              New balance {formatCurrency(d.outstanding - Number.parseFloat(inlinePayValue))}
                                            </span>
                                          ) : null}
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    formatAmount(d.amountSettled ?? 0)
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-left text-xs tabular-nums font-bold text-red-600 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-red-400">{formatAmount(d.outstanding)}</td>
                                <td className="px-2 py-1.5 sm:px-6 sm:py-2.5">
                                  <span
                                    className={`inline-flex justify-start rounded-full px-2.5 py-0.5 text-left text-[11px] font-medium sm:text-xs ${
                                      d.status === "OPEN" || d.status === "PARTIAL"
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                        : d.status === "CLOSED"
                                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                                          : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                                    }`}
                                  >
                                    {d.status === "CLOSED" ? "Closed" : d.status}
                                  </span>
                                </td>
                                {showDebtDueCol && (
                                  <td className="px-2 py-1.5 text-xs text-slate-600 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-slate-400">{d.dueDate ?? "—"}</td>
                                )}
                                {showDebtIssuedByCol && (
                                  <td className="px-2 py-1.5 text-xs text-slate-600 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-slate-400">{d.issuedBy ?? "—"}</td>
                                )}
                                <td className="hidden px-4 py-2 text-lg text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl xl:table-cell dark:text-slate-400">{new Date(d.createdAt).toLocaleString()}</td>
                                {showDebtNotesCol && (
                                  <td className="hidden max-w-[14rem] px-4 py-2 align-top text-lg text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl xl:table-cell dark:text-slate-400">
                                    {d.notes?.trim() ? (
                                      <div className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words">{d.notes}</div>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                )}
                                <td className="px-2 py-1.5 text-left sm:px-6 sm:py-2.5">
                                  {canRecordPayment(d) ? (
                                    <div className="flex flex-wrap justify-start gap-1">
                                      <button type="button" onClick={() => openSettleForm(d)} className="rounded p-1 text-emerald-600 hover:bg-emerald-50 sm:p-1.5 dark:text-emerald-400 dark:hover:bg-emerald-900/30" title="Record payment">
                                        <Banknote className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                      </button>
                                      {canEditDebt(d) && (
                                        <button type="button" onClick={() => openDebtEditForm(d)} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:p-1.5 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-200" title="Edit customer debt">
                                          <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        </button>
                                      )}
                                      {canClearDebt(d) && (
                                        <button type="button" onClick={() => setClearDialogDebt(d)} className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 sm:p-1.5 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400" title="Clear debt">
                                          <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    canClearDebt(d) && (
                                      <button type="button" onClick={() => setClearDialogDebt(d)} className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 sm:p-1.5 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400" title="Clear debt">
                                        <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                      </button>
                                    )
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {debtTotalElements > 0 && !debtSearchActive && debtGroupBy === "none" && (
                      <Pagination
                        page={debtsPage}
                        size={DEBTS_PAGE_SIZE}
                        totalElements={debtTotalElements}
                        onPageChange={setDebtsPage}
                        onRefresh={() => void refetchDebts()}
                        isRefreshing={isDebtsFetching}
                      />
                    )}
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-col items-end gap-1">
                {debtSearchActive && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Total reflects {filteredDebts.length} search match
                    {filteredDebts.length === 1 ? "" : "es"} only.
                  </p>
                )}
                <DebtPendingTotalDisplay
                  loading={pendingTotalLoading}
                  totalPending={pendingTotalForDateRange}
                  onClick={
                    debtsByCustomer.rows.length > 0
                      ? () => setDebtBreakdownOpen(true)
                      : undefined
                  }
                />
              </div>
            </>
          )}
        </AdminTabPanel>
      )}

      {/* ================================================================= */}
      {/* EXPENSES TAB                                                      */}
      {/* ================================================================= */}
      {tab === "expenses" && (
        <AdminTabPanel panelId="debts-expenses-panel-expenses" tabId="debts-expenses-tab-expenses">


          {(expensesLoading || activeDebtsBootstrapLoading || !dateRangeReady || (expGroupBy !== "none" && isGroupedExpensesLoading)) && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
            </div>
          )}

          {expensesIsError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
              <p className="font-medium text-red-800 dark:text-red-200">
                {getApiErrorMessage(expensesError)}
              </p>
            </div>
          )}

          {!expensesLoading && !activeDebtsBootstrapLoading && dateRangeReady && !expensesIsError && !(expGroupBy !== "none" && isGroupedExpensesLoading) && (
            <>
              <div className="mb-4 flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <TableSearchInput value={expSearchQuery} onChange={setExpSearchQuery} placeholder="Search expenses…" />
                  <div className="hidden xl:flex items-center gap-1.5">
                    <label
                      htmlFor="exp-group-by"
                      className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400"
                    >
                      Group by
                    </label>
                    <SearchableSelect
                      id="exp-group-by"
                      options={EXPENSE_GROUP_BY_OPTIONS}
                      value={expGroupBy}
                      onChange={(v) => {
                        setExpGroupBy(v as ExpenseGroupByOption);
                        setExpensesPage(0);
                      }}
                      aria-label="Group expenses by"
                      placeholder="Group by…"
                      compact
                      className="w-48"
                      controlClassName="border-slate-200 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 dark:border-slate-600 dark:focus:border-primary-400 dark:focus:ring-primary-400"
                    />
                  </div>
                  <div className="hidden xl:block">
                    <RecordedDateFilters
                      fromDate={fromDate}
                      toDate={toDate}
                      onRecordedDate={onRecordedDate}
                      onFromDateChange={setFromDate}
                      onToDateChange={setToDate}
                      onOnRecordedDateChange={handleOnRecordedDateChange}
                      onClearOnRecordedDate={clearOnRecordedDate}
                    />
                  </div>
                </div>
                {onRecordedDate ? (
                  <p className="hidden xl:block text-xs text-slate-500 dark:text-slate-400">
                    Showing expenses recorded on {onRecordedDate}
                  </p>
                ) : null}
              </div>
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                {(expGroupBy !== "none" ? filteredGroupedExpenses.length === 0 : filteredExpenses.length === 0) ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Receipt className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                    <p className="mt-4 text-slate-500 dark:text-slate-400">
                      {!expSearchActive ? "No expenses recorded yet. Record expenses such as utilities, supplies, or maintenance." : "No results match your search."}
                    </p>
                    {!expSearchActive && (
                      <button
                        type="button"
                        onClick={() => setExpFormOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary-500 bg-transparent px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/30"
                      >
                        <Plus className="h-4 w-4" />
                        Record expense
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {expSearchActive && (
                      <p className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                        Showing {expGroupBy !== "none" ? filteredGroupedExpenses.length : filteredExpenses.length} match{(expGroupBy !== "none" ? filteredGroupedExpenses.length : filteredExpenses.length) === 1 ? "" : "es"}{expGroupBy === "none" ? " across all pages in the selected range." : "."}
                      </p>
                    )}
                    <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">&larr; swipe table to see all columns &rarr;</p>
                    <div className="relative min-h-0 flex-1 overflow-auto">
                      <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
                      <table className="w-full min-w-full divide-y divide-slate-200 dark:divide-slate-600 xl:min-w-[840px]">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                          <tr>
                            <TableRowNumberHead className={`${tableRowNoHead} hidden xl:table-cell`} />
                            {expGroupBy !== "none" ? (
                              <>
                                <th
                                  className={`${tableStickyHeadCell} px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300`}
                                >
                                  {expGroupBy === "category"
                                    ? "Category"
                                    : expGroupBy === "incurredBy"
                                      ? "Incurred by"
                                      : "Date"}
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300">
                                  Amount (KSH)
                                </th>
                              </>
                            ) : (
                              <>
                                {showExpIncurredByCol && (
                                  <SortableTableHead
                                    columnKey="incurredBy"
                                    label="Incurred by"
                                    sortColumn={expSortColumn}
                                    sortDirection={expSortDirection}
                                    onSort={toggleExpSort}
                                    className={`${tableStickyHeadCell} px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300`}
                                  />
                                )}
                                <SortableTableHead
                                  columnKey="amount"
                                  label="Amount (KSH)"
                                  sortColumn={expSortColumn}
                                  sortDirection={expSortDirection}
                                  onSort={toggleExpSort}
                                  className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300"
                                />
                                <SortableTableHead
                                  columnKey="category"
                                  label="Category"
                                  sortColumn={expSortColumn}
                                  sortDirection={expSortDirection}
                                  onSort={toggleExpSort}
                                  className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300"
                                />
                                <SortableTableHead
                                  columnKey="description"
                                  label="Desc."
                                  sortColumn={expSortColumn}
                                  sortDirection={expSortDirection}
                                  onSort={toggleExpSort}
                                  className="hidden px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl xl:table-cell dark:text-slate-300"
                                />
                                {showExpReceiptRefCol && (
                                  <SortableTableHead
                                    columnKey="receiptRef"
                                    label="Receipt ref"
                                    sortColumn={expSortColumn}
                                    sortDirection={expSortDirection}
                                    onSort={toggleExpSort}
                                    className="hidden px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl xl:table-cell dark:text-slate-300"
                                  />
                                )}
                                <SortableTableHead
                                  columnKey="created"
                                  label="Created"
                                  sortColumn={expSortColumn}
                                  sortDirection={expSortDirection}
                                  onSort={toggleExpSort}
                                  className="hidden px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl xl:table-cell dark:text-slate-300"
                                />
                                <SortableTableHead
                                  columnKey="actions"
                                  label="Actions"
                                  sortColumn={expSortColumn}
                                  sortDirection={expSortDirection}
                                  onSort={toggleExpSort}
                                  sortable={false}
                                  className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300"
                                />
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                          {expGroupBy !== "none" ? (
                            filteredGroupedExpenses.map((group, index) => (
                              <tr key={group.groupKey} className={tableBodyRow}>
                                <TableRowNumberCell
                                  className={`${tableRowNoCell} hidden xl:table-cell`}
                                  page={0}
                                  pageSize={filteredGroupedExpenses.length}
                                  indexInPage={index}
                                />
                                <td
                                  className={`${tableStickyFirstCell} px-2 py-1.5 text-xs font-bold text-slate-900 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-white`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{group.groupLabel}</span>
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                      {group.count} {group.count === 1 ? "expense" : "expenses"}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-2 py-1.5 text-left text-xs font-semibold tabular-nums text-slate-700 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-slate-300">
                                  {formatAmount(group.totalAmount)}
                                </td>
                              </tr>
                            ))
                          ) : (
                            visibleExpenses.map((e: MiscExpenseResponse, index) => (
                              <tr key={e.id} className={tableBodyRow}>
                                <TableRowNumberCell className={`${tableRowNoCell} hidden xl:table-cell`} page={expensesPage} pageSize={EXPENSES_PAGE_SIZE} indexInPage={index} />
                                {showExpIncurredByCol && (
                                  <td className={`${tableStickyFirstCell} px-2 py-1.5 text-xs font-semibold text-slate-700 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-slate-300`}>{e.incurredBy ?? "—"}</td>
                                )}
                                <td className="px-2 py-1.5 text-left text-xs font-semibold tabular-nums text-slate-700 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-slate-300">{formatAmount(e.amount)}</td>
                                <td className="px-2 py-1.5 sm:px-6 sm:py-2.5">
                                  <span className="inline-flex justify-start rounded-full bg-slate-100 px-2 py-0.5 text-left text-[11px] font-medium text-slate-700 sm:text-xs xl:text-sm dark:bg-slate-700 dark:text-slate-300">{e.category}</span>
                                </td>
                                <td className="hidden px-4 py-2 text-lg text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl xl:table-cell dark:text-slate-400">{e.description || "—"}</td>
                                {showExpReceiptRefCol && (
                                  <td className="hidden px-4 py-2 text-lg text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl xl:table-cell dark:text-slate-400">{e.receiptRef ?? "—"}</td>
                                )}
                                <td className="hidden px-4 py-2 text-lg text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl xl:table-cell dark:text-slate-400">{new Date(e.createdAt).toLocaleString()}</td>
                                <td className="px-2 py-1.5 text-left sm:px-6 sm:py-2.5">
                                  <div className="flex justify-start gap-1">
                                    <button type="button" onClick={() => openExpEditForm(e)} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:p-1.5 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-200" title="Edit">
                                      <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    </button>
                                    <button type="button" onClick={() => setCancelDialogExpense(e)} className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-600 sm:p-1.5 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400" title="Delete">
                                      <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {expTotalElements > 0 && !expSearchActive && expGroupBy === "none" && (
                      <Pagination
                        page={expensesPage}
                        size={EXPENSES_PAGE_SIZE}
                        totalElements={expTotalElements}
                        onPageChange={setExpensesPage}
                        onRefresh={() => void refetchExpenses()}
                        isRefreshing={isExpensesFetching}
                      />
                    )}
                  </>
                )}
              </div>
              {expTotalElements > 0 ? (
                <div className="mt-3 flex flex-col items-end gap-1">
                  {expSearchActive && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Total reflects {filteredExpenses.length} search match
                      {filteredExpenses.length === 1 ? "" : "es"} only.
                    </p>
                  )}
                  <MiscExpensesTotalBadge
                    totalAmount={expTotalAmount}
                    onClick={
                      expensesByCategory.rows.length > 0
                        ? () => setExpBreakdownOpen(true)
                        : undefined
                    }
                  />
                </div>
              ) : null}
            </>
          )}
        </AdminTabPanel>
      )}

      {/* ================================================================= */}
      {/* DEBTS SLIDE-OVERS & DIALOGS                                       */}
      {/* ================================================================= */}
      <SlideOver
        open={debtFormOpen}
        onClose={() => {
          setDebtFormOpen(false);
          if (!debtSubmitting) {
            setDebtFormCustomerName("");
            setDebtFormCustomerPhone("");
            setDebtFormIssuedBy("");
            setDebtFormAmount("");
            setDebtFormRecordedOn(todayInputValue());
            setDebtFormDueDate("");
            setDebtFormNotes("");
            setDebtFormBorrowedLines([]);
            setDebtFormAddItemId("");
          }
        }}
        title="Record customer debt"
      >
        <form onSubmit={handleDebtSubmit} className="space-y-4">
          <div>
            <label htmlFor="customerName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Customer name *</label>
            <input id="customerName" type="text" required value={debtFormCustomerName} onChange={(e) => setDebtFormCustomerName(e.target.value)} placeholder="e.g. John Kamau" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          </div>
          <div>
            <label htmlFor="customerPhone" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Customer phone</label>
            <input id="customerPhone" type="tel" value={debtFormCustomerPhone} onChange={(e) => setDebtFormCustomerPhone(e.target.value)} placeholder="e.g. +254 700 123 456" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          </div>
          <div>
            <label htmlFor="debtIssuedBy" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Issued by</label>
            <SearchableSelect
              id="debtIssuedBy"
              aria-label="Issued by"
              options={issuedBySelectOptions}
              value={debtFormIssuedBy}
              onChange={setDebtFormIssuedBy}
              allowCustomValue
              placeholder="Search or type a name…"
              className="mt-1 block w-full"
              controlClassName="border-slate-300 shadow-sm focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 dark:border-slate-600 dark:focus-within:border-primary-400 dark:focus-within:ring-primary-400"
            />
          </div>
          <div>
            <span id="borrowed-items-label" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Items borrowed</span>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Add lines from the branch price list (or default selling price). Debt total fills from
              these lines; use amount below only when you are not listing items.
            </p>
            {debtCatalogLoading ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading catalog…</p>
            ) : pricedItemsForDebt.length === 0 ? (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                No priced items found. Add items to this branch&apos;s price list (or set default
                selling prices) to select products here.
              </p>
            ) : (
              <div className="mt-2">
                <SearchableSelect
                  aria-label="Add borrowed item"
                  options={debtAddItemOptions}
                  value={debtFormAddItemId}
                  onChange={(v) => handleAddBorrowedItem(v)}
                  placeholder="Search item…"
                  unknownValueDisplay="Select item…"
                  optionsOrder="as_given"
                  className="w-full"
                  controlClassName="border-slate-300 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 dark:border-slate-600 dark:focus-within:border-primary-400 dark:focus-within:ring-primary-400"
                />
              </div>
            )}
            {debtFormBorrowedLines.length > 0 ? (
              <ul className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-600 dark:bg-slate-900/40">
                {debtFormBorrowedLines.map((line) => (
                  <li key={line.itemId} className="flex flex-wrap items-center gap-2 rounded-md bg-white px-2 py-2 dark:bg-slate-800">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-white">{line.itemName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {formatCurrency(line.unitPrice)} each{line.sku ? ` · ${line.sku}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => adjustBorrowedQty(line.itemId, -1)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700" aria-label={`Decrease quantity for ${line.itemName}`}>
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{line.qty}</span>
                      <button type="button" onClick={() => adjustBorrowedQty(line.itemId, 1)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700" aria-label={`Increase quantity for ${line.itemName}`}>
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="w-full text-right text-sm font-medium tabular-nums text-slate-800 dark:text-slate-200 sm:w-auto sm:text-left">{formatCurrency(line.qty * line.unitPrice)}</div>
                    <button type="button" onClick={() => removeBorrowedLine(line.itemId)} className="shrink-0 rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label={`Remove ${line.itemName}`}>
                      <XCircle className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <label htmlFor="debtAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Amount (KES) *</label>
            {debtFormBorrowedLines.length > 0 ? (
              <>
                <input id="debtAmount" type="text" readOnly value={formatCurrency(borrowedItemsSubtotal)} className="mt-1 block w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white" aria-describedby="amount-items-hint" />
                <p id="amount-items-hint" className="mt-1 text-xs text-slate-500 dark:text-slate-400">Total from borrowed items above. Remove all lines to enter a custom amount.</p>
              </>
            ) : (
              <input id="debtAmount" type="number" step="0.01" min="0.01" required value={debtFormAmount} onChange={(e) => setDebtFormAmount(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            )}
          </div>
          <div>
            <label htmlFor="debtRecordedOn" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date recorded *</label>
            <DateInput id="debtRecordedOn" required max={todayInputValue()} value={debtFormRecordedOn} onChange={(e) => setDebtFormRecordedOn(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Defaults to today. Pick a past date when entering an old debt.</p>
          </div>
          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Due date</label>
            <DateInput id="dueDate" value={debtFormDueDate} onChange={(e) => setDebtFormDueDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
            <textarea id="notes" rows={2} value={debtFormNotes} onChange={(e) => setDebtFormNotes(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setDebtFormOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancel</button>
            <button type="submit" disabled={debtSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
              {debtSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Record debt
            </button>
          </div>
        </form>
      </SlideOver>

      <SlideOver
        open={debtEditFormOpen}
        onClose={() => {
          setDebtEditFormOpen(false);
          setEditingDebt(null);
          if (!editDebtSubmitting) {
            setEditDebtCustomerName("");
            setEditDebtCustomerPhone("");
            setEditDebtIssuedBy("");
            setEditDebtAmount("");
            setEditDebtDueDate("");
            setEditDebtNotes("");
          }
        }}
        title="Edit customer debt"
      >
        {editingDebt && (
          <form onSubmit={handleDebtEditSubmit} className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Same fields as recording a debt. Edits are only allowed before any repayment; use
              Record payment after that.
            </p>
            <div>
              <label htmlFor="editCustomerName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Customer name *</label>
              <input id="editCustomerName" type="text" required value={editDebtCustomerName} onChange={(e) => setEditDebtCustomerName(e.target.value)} placeholder="e.g. John Kamau" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label htmlFor="editCustomerPhone" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Customer phone</label>
              <input id="editCustomerPhone" type="tel" value={editDebtCustomerPhone} onChange={(e) => setEditDebtCustomerPhone(e.target.value)} placeholder="e.g. +254 700 123 456" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label htmlFor="editDebtIssuedBy" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Issued by</label>
              <SearchableSelect
                id="editDebtIssuedBy"
                aria-label="Issued by"
                options={issuedBySelectOptions}
                value={editDebtIssuedBy}
                onChange={setEditDebtIssuedBy}
                allowCustomValue
                placeholder="Search or type a name…"
                className="mt-1 block w-full"
                controlClassName="border-slate-300 shadow-sm focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 dark:border-slate-600 dark:focus-within:border-primary-400 dark:focus-within:ring-primary-400"
              />
            </div>
            <div>
              <label htmlFor="editDebtAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Amount (KES) *</label>
              <input id="editDebtAmount" type="number" step="0.01" min="0.01" required value={editDebtAmount} onChange={(e) => setEditDebtAmount(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label htmlFor="editDebtDueDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Due date</label>
              <DateInput id="editDebtDueDate" value={editDebtDueDate} onChange={(e) => setEditDebtDueDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label htmlFor="editDebtNotes" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
              <textarea id="editDebtNotes" rows={2} value={editDebtNotes} onChange={(e) => setEditDebtNotes(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setDebtEditFormOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancel</button>
              <button type="submit" disabled={editDebtSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                {editDebtSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Pencil className="h-4 w-4" />Save</>}
              </button>
            </div>
          </form>
        )}
      </SlideOver>

      <SlideOver
        open={settleFormOpen}
        onClose={() => {
          setSettleFormOpen(false);
          setSettlingDebt(null);
          setSettlingCustomerName("");
          setSettleSingleDebtOnly(false);
          if (!settleSubmitting && !settleBulkMutation.isPending) setSettleAmount("");
        }}
        title="Record payment"
        maxWidth="max-w-xl"
      >
        {settlingCustomerName.trim() && (
          <form onSubmit={handleSettleSubmit} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {settlingCustomerName}
              {settleUsesLumpSum
                ? ` — total outstanding ${formatCurrency(settlingCustomerOutstanding)} across ${settlingCustomerDebts.length} debts`
                : settlingDebt
                  ? ` — outstanding ${formatCurrency(settlingDebt.outstanding)}`
                  : settlingCustomerDebts[0]
                    ? ` — outstanding ${formatCurrency(settlingCustomerDebts[0].outstanding)}`
                    : ""}
            </p>
            {settlingCustomerDebts.length >= 2 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setSettleSingleDebtOnly(false)}
                  className={`rounded-lg px-3 py-1.5 font-medium ${
                    !settleSingleDebtOnly
                      ? "bg-primary-600 text-white"
                      : "border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300"
                  }`}
                >
                  Lump-sum (oldest first)
                </button>
                {settlingDebt && (
                  <button
                    type="button"
                    onClick={() => setSettleSingleDebtOnly(true)}
                    className={`rounded-lg px-3 py-1.5 font-medium ${
                      settleSingleDebtOnly
                        ? "bg-primary-600 text-white"
                        : "border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300"
                    }`}
                  >
                    This debt only
                  </button>
                )}
              </div>
            )}
            <div>
              <label htmlFor="settleAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Payment amount (KES) *
              </label>
              <input
                id="settleAmount"
                type="number"
                step="0.01"
                min="0.01"
                max={settleMaxAmount}
                required
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                placeholder={`Max ${formatCurrency(settleMaxAmount)}`}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            {allocationPreview && allocationPreview.allocations.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600">
                <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
                  Allocation preview (oldest first)
                </p>
                <div className="max-h-56 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2">Recorded</th>
                        <th className="px-3 py-2 text-left">Outstanding</th>
                        <th className="px-3 py-2 text-left">Applied</th>
                        <th className="px-3 py-2 text-left">After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                      {allocationPreview.allocations.map((line) => (
                        <tr key={line.debtId}>
                          <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-400">
                            {new Date(line.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 text-left tabular-nums">
                            {formatAmount(line.outstandingBefore)}
                          </td>
                          <td className="px-3 py-2 text-left tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatAmount(line.appliedAmount)}
                          </td>
                          <td className="px-3 py-2 text-left tabular-nums">
                            {formatAmount(line.outstandingAfter)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setSettleFormOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={settleSubmitting || settleBulkMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {settleSubmitting || settleBulkMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Banknote className="h-4 w-4" />
                    Record payment
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </SlideOver>

      <ConfirmDialog
        open={clearDialogDebt !== null}
        onClose={() => !clearDebtSubmitting && setClearDialogDebt(null)}
        onConfirm={handleClearDebtConfirm}
        title="Clear debt"
        message={
          clearDialogDebt ? (
            <>
              Clear this debt for {clearDialogDebt.customerName} (
              {formatCurrency(clearDialogDebt.outstanding)} outstanding)? The
              record will be kept for audit.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Clear debt"
        variant="danger"
        loading={clearDebtSubmitting}
      />

      {/* ================================================================= */}
      {/* EXPENSES SLIDE-OVERS & DIALOGS                                    */}
      {/* ================================================================= */}
      <SlideOver
        open={expFormOpen}
        onClose={() => {
          setExpFormOpen(false);
          if (!createExpMutation.isPending) {
            setExpFormAmount("");
            setExpFormCategory("Other");
            setExpFormDescription("");
            setExpFormIncurredBy("");
            setExpFormReceiptRef("");
            setExpFormRecordedOn(todayInputValue());
          }
        }}
        title="Record miscellaneous expense"
      >
        <form onSubmit={handleExpSubmit} className="space-y-4">
          <div>
            <label htmlFor="expRecordedOn" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date recorded *</label>
            <DateInput id="expRecordedOn" required max={todayInputValue()} value={expFormRecordedOn} onChange={(e) => setExpFormRecordedOn(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Defaults to today. Pick a past date when entering an old expense.</p>
          </div>
          <div>
            <label htmlFor="expAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Amount (KES) *</label>
            <input id="expAmount" type="number" step="0.01" min="0.01" required value={expFormAmount} onChange={(e) => setExpFormAmount(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          </div>
          <div>
            <label htmlFor="expCategory" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Spent on *</label>
            <SearchableSelect
              id="expCategory"
              options={expenseCategoryOptions}
              value={expFormCategory}
              onChange={setExpFormCategory}
              allowCustomValue
              placeholder="Type or search…"
              className="mt-1 block w-full"
              controlClassName="shadow-sm focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="expIncurredBy" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Incurred by</label>
            <input id="expIncurredBy" type="text" value={expFormIncurredBy} onChange={(e) => setExpFormIncurredBy(e.target.value)} placeholder="Name of person who incurred the expense" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          </div>
          <div>
            <label htmlFor="expDescription" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
            <textarea id="expDescription" rows={3} value={expFormDescription} onChange={(e) => setExpFormDescription(e.target.value)} placeholder="Optional — e.g. Electricity bill for January" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          </div>
          <div>
            <label htmlFor="expReceiptRef" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Receipt / Invoice reference</label>
            <input id="expReceiptRef" type="text" value={expFormReceiptRef} onChange={(e) => setExpFormReceiptRef(e.target.value)} placeholder="Optional" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setExpFormOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancel</button>
            <button type="submit" disabled={createExpMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
              {createExpMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Record expense
            </button>
          </div>
        </form>
      </SlideOver>

      <SlideOver
        open={expEditFormOpen}
        onClose={() => {
          setExpEditFormOpen(false);
          setEditingExpense(null);
          if (!editExpSubmitting) {
            setEditExpAmount("");
            setEditExpDescription("");
            setEditExpIncurredBy("");
            setEditExpReceiptRef("");
          }
        }}
        title="Edit expense"
      >
        {editingExpense && (
          <form onSubmit={handleExpEditSubmit} className="space-y-4">
            <div>
              <label htmlFor="editExpAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Amount (KES) *</label>
              <input id="editExpAmount" type="number" step="0.01" min="0.01" required value={editExpAmount} onChange={(e) => setEditExpAmount(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label htmlFor="editExpCategory" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Spent on *</label>
              <SearchableSelect
                id="editExpCategory"
                options={expenseCategoryOptions}
                value={editExpCategory}
                onChange={setEditExpCategory}
                allowCustomValue
                placeholder="Type or search…"
                className="mt-1 block w-full"
                controlClassName="shadow-sm focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
              />
            </div>
            <div>
              <label htmlFor="editExpIncurredBy" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Incurred by</label>
              <input id="editExpIncurredBy" type="text" value={editExpIncurredBy} onChange={(e) => setEditExpIncurredBy(e.target.value)} placeholder="Name of person who incurred the expense" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label htmlFor="editExpDescription" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <textarea id="editExpDescription" rows={3} value={editExpDescription} onChange={(e) => setEditExpDescription(e.target.value)} placeholder="Optional — e.g. Electricity bill for January" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label htmlFor="editExpReceiptRef" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Receipt / Invoice reference</label>
              <input id="editExpReceiptRef" type="text" value={editExpReceiptRef} onChange={(e) => setEditExpReceiptRef(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setExpEditFormOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancel</button>
              <button type="submit" disabled={editExpSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                {editExpSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Pencil className="h-4 w-4" />Save</>}
              </button>
            </div>
          </form>
        )}
      </SlideOver>

      <ConfirmDialog
        open={cancelDialogExpense !== null}
        onClose={() => !cancelExpSubmitting && setCancelDialogExpense(null)}
        onConfirm={handleCancelExpConfirm}
        title="Delete expense"
        message={
          cancelDialogExpense ? (
            <>
              Soft delete expense for {formatCurrency(cancelDialogExpense.amount)} —{" "}
              {cancelDialogExpense.description}? The record will be kept for audit.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Delete"
        variant="danger"
        loading={cancelExpSubmitting}
      />

      {debtBreakdownOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="debt-breakdown-title"
        >
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-slate-950/60"
            aria-hidden
            onClick={() => setDebtBreakdownOpen(false)}
          />
          <div className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-700">
              <div>
                <h3
                  id="debt-breakdown-title"
                  className="text-xl font-bold text-slate-900 dark:text-white"
                >
                  Pending debts by customer
                </h3>
                <p className="mt-1 text-base font-medium text-slate-500 dark:text-slate-400">
                  {dateRangeLabel} · {debtsByCustomer.rows.length} customer
                  {debtsByCustomer.rows.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDebtBreakdownOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:text-slate-400 dark:hover:bg-slate-700"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-lg">
                <thead className="sticky top-0 bg-slate-100 text-left text-lg font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left">Customer</th>
                    <th className="px-6 py-3 text-left">Outstanding (KSH)</th>
                    <th className="px-6 py-3 text-left">Share</th>
                    <th className="px-6 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {debtsByCustomer.rows.map((r) => (
                    <tr
                      key={normalizeCustomerName(r.customerName)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/40"
                    >
                      <td className="px-6 py-2.5 text-left text-lg font-semibold text-slate-900 dark:text-white">
                        {r.customerName}
                      </td>
                      <td className="px-6 py-2.5 text-left text-lg font-semibold tabular-nums text-red-600 dark:text-red-400">
                        {formatAmount(r.amount)}
                      </td>
                      <td className="px-6 py-2.5 text-left text-lg font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                        {formatPercent(r.pct, 2)}
                      </td>
                      <td className="px-6 py-2.5 text-left">
                        <button
                          type="button"
                          onClick={() => openCustomerSettleForm(r.customerName)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                        >
                          <Banknote className="h-4 w-4" />
                          Pay
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 border-t-2 border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800">
                  <tr>
                    <td className="px-6 py-4 text-left text-xl font-bold text-slate-900 dark:text-white">
                      Total pending
                    </td>
                    <td className="px-6 py-4 text-left text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatAmount(debtsByCustomer.total)}
                    </td>
                    <td className="px-6 py-4 text-left text-lg font-bold tabular-nums text-slate-600 dark:text-slate-300">
                      100%
                    </td>
                    <td className="px-6 py-4" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {expBreakdownOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exp-breakdown-title"
        >
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm dark:bg-slate-950/60"
            aria-hidden
            onClick={() => setExpBreakdownOpen(false)}
          />
          <div className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-700">
              <div>
                <h3
                  id="exp-breakdown-title"
                  className="text-xl font-bold text-slate-900 dark:text-white"
                >
                  Expenses by category
                </h3>
                <p className="mt-1 text-base font-medium text-slate-500 dark:text-slate-400">
                  {dateRangeLabel} · {expensesByCategory.rows.length} categor
                  {expensesByCategory.rows.length === 1 ? "y" : "ies"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpBreakdownOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:text-slate-400 dark:hover:bg-slate-700"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-lg">
                <thead className="sticky top-0 bg-slate-100 text-left text-lg font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left">Category</th>
                    <th className="px-6 py-3 text-left">Total (KSH)</th>
                    <th className="px-6 py-3 text-left">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {expensesByCategory.rows.map((r) => (
                    <tr
                      key={r.category}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/40"
                    >
                      <td className="px-6 py-2.5 text-left text-lg font-semibold text-slate-900 dark:text-white">
                        {r.category}
                      </td>
                      <td className="px-6 py-2.5 text-left text-lg font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                        {formatAmount(r.amount)}
                      </td>
                      <td className="px-6 py-2.5 text-left text-lg font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                        {formatPercent(r.pct, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 border-t-2 border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800">
                  <tr>
                    <td className="px-6 py-4 text-left text-xl font-bold text-slate-900 dark:text-white">
                      Total
                    </td>
                    <td className="px-6 py-4 text-left text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatAmount(expensesByCategory.total)}
                    </td>
                    <td className="px-6 py-4 text-left text-lg font-bold tabular-nums text-slate-600 dark:text-slate-300">
                      100%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
