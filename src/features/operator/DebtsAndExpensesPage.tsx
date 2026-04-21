import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectBranchId,
  selectBranchName,
} from "@/store/selectors/orgContextSelectors";
import {
  fetchDebts,
  createDebt,
  updateDebt,
  cancelDebt,
  settleDebt,
  type CustomerDebtResponse,
  type CustomerDebtCreateRequest,
  type CustomerDebtUpdateRequest,
} from "@/api/debts";
import { createCustomer } from "@/api/customers";
import { fetchAllOrgItems } from "@/api/items";
import type { Item } from "@/types/catalog";
import {
  fetchMiscExpenses,
  fetchExpenseCategories,
  createMiscExpense,
  updateMiscExpense,
  cancelMiscExpense,
  type MiscExpenseResponse,
  type MiscExpenseCreateRequest,
  type MiscExpenseUpdateRequest,
} from "@/api/miscExpenses";
import { SlideOver } from "@/components/ui/SlideOver";
import { Pagination, ConfirmDialog, TableSearchInput } from "@/components/ui";
import { formatCurrency } from "@/utils/formatCurrency";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { downloadDebtsPdf } from "@/utils/debtsPdf";
import { downloadExpensesPdf } from "@/utils/expensesPdf";
import { recordedAtToCreatedAt, todayInputValue } from "@/utils/recordedAt";
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
import { PageHeader } from "@/components/PageHeader";
import { AdminTabList, AdminTabPanel } from "@/components/ui/AdminTabs";
import { SearchableSelect } from "@/components/SearchableSelect";
import { motion, AnimatePresence } from "framer-motion";

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


const PENDING_TOTAL_QUERY_KEY = "operator-debts-pending-total";

function DebtPendingTotalDisplay(props: { totalPending: number; loading: boolean }) {
  const { totalPending, loading } = props;
  return (
    <motion.div
      className="flex min-w-[min(100%,17rem)] max-w-full shrink-0 items-center justify-between gap-4 rounded-2xl border-2 border-emerald-500 bg-slate-900 px-5 py-3.5 shadow-md shadow-emerald-950/40 dark:border-emerald-400 dark:shadow-emerald-950/60"
      whileHover={{
        y: [0, -6, 0, -4, 0],
        transition: { duration: 0.55, ease: "easeInOut" },
      }}
    >
      <span className="text-xs font-bold uppercase tracking-widest text-emerald-500 dark:text-emerald-400">
        Total pending
      </span>
      <AnimatePresence mode="wait">
        <motion.span
          key={loading ? "loading" : String(totalPending)}
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className="text-right text-lg font-bold tabular-nums tracking-tight text-emerald-50"
        >
          {loading ? "…" : formatCurrency(totalPending)}
        </motion.span>
      </AnimatePresence>
    </motion.div>
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

function MiscExpensesTotalBadge(props: { totalAmount: number }) {
  const { totalAmount } = props;
  return (
    <div
      className="inline-flex max-w-full items-center justify-between gap-4 rounded-full border-2 border-emerald-500 bg-slate-900 px-6 py-3 shadow-md shadow-emerald-950/40 dark:border-emerald-400 dark:shadow-emerald-950/60"
      role="status"
    >
      <span className="text-xs font-bold uppercase tracking-widest text-emerald-500 dark:text-emerald-400">
        Total
      </span>
      <span className="text-right text-lg font-bold tabular-nums text-white dark:text-white">
        {formatCurrency(totalAmount)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type TabId = "debts" | "expenses";

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function DebtsAndExpensesPage() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);
  const branchName = useAppSelector(selectBranchName);
  const queryClient = useQueryClient();
  const toast = useToast();

  // Shared state
  const [tab, setTab] = useState<TabId>("debts");
  const [fromDate, setFromDate] = useState(defaultFromDateStr);
  const [toDate, setToDate] = useState(todayStr);

  // -----------------------------------------------------------------------
  // Debts state
  // -----------------------------------------------------------------------
  const [debtsPage, setDebtsPage] = useState(0);
  const [debtFormOpen, setDebtFormOpen] = useState(false);
  const [debtFormCustomerName, setDebtFormCustomerName] = useState("");
  const [debtFormCustomerPhone, setDebtFormCustomerPhone] = useState("");
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
  const [editDebtAmount, setEditDebtAmount] = useState("");
  const [editDebtDueDate, setEditDebtDueDate] = useState("");
  const [editDebtNotes, setEditDebtNotes] = useState("");
  const [editDebtSubmitting, setEditDebtSubmitting] = useState(false);
  const [clearDialogDebt, setClearDialogDebt] = useState<CustomerDebtResponse | null>(null);
  const [clearDebtSubmitting, setClearDebtSubmitting] = useState(false);
  const [settleFormOpen, setSettleFormOpen] = useState(false);
  const [settlingDebt, setSettlingDebt] = useState<CustomerDebtResponse | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleSubmitting, setSettleSubmitting] = useState(false);
  const [inlinePayDebtId, setInlinePayDebtId] = useState<string | null>(null);
  const [inlinePayValue, setInlinePayValue] = useState("");
  const [inlinePaySubmitting, setInlinePaySubmitting] = useState(false);
  const [inlineNameDebtId, setInlineNameDebtId] = useState<string | null>(null);
  const [inlineNameValue, setInlineNameValue] = useState("");
  const [inlineNameSubmitting, setInlineNameSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_OUTSTANDING);

  const debtStatusFilterOptions = useMemo(
    () => STATUS_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
    []
  );

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
  const { data: debtsData, isLoading: debtsLoading, isError: debtsIsError, error: debtsError } = useQuery({
    queryKey: ["operator-debts", token, orgId, branchId, debtsPage, statusFilter, fromDate, toDate],
    queryFn: () =>
      fetchDebts(token, orgId!, branchId!, {
        page: debtsPage,
        size: DEBTS_PAGE_SIZE,
        status: statusQueryForFilter(statusFilter),
        fromDate,
        toDate,
      }),
    enabled: Boolean(token && orgId && branchId),
  });

  const { data: debtsTotalPage, isLoading: pendingTotalLoading } = useQuery({
    queryKey: [PENDING_TOTAL_QUERY_KEY, token, orgId, branchId, fromDate, toDate, statusFilter],
    queryFn: () =>
      fetchDebts(token, orgId!, branchId!, {
        page: 0,
        size: 2000,
        status: statusQueryForFilter(statusFilter),
        fromDate,
        toDate,
      }),
    enabled: Boolean(token && orgId && branchId),
  });
  const pendingTotalForDateRange = useMemo(
    () =>
      (debtsTotalPage?.content ?? [])
        .filter((d) => d.status !== "CANCELLED")
        .reduce((sum, d) => sum + (d.outstanding ?? 0), 0),
    [debtsTotalPage],
  );

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
  const { data: expensesData, isLoading: expensesLoading, isError: expensesIsError, error: expensesError } = useQuery({
    queryKey: ["operator-misc-expenses", token, orgId, branchId, expensesPage, fromDate, toDate],
    queryFn: () =>
      fetchMiscExpenses(token, orgId!, branchId!, {
        page: expensesPage,
        size: EXPENSES_PAGE_SIZE,
        fromDate,
        toDate,
      }),
    enabled: Boolean(token && orgId && branchId),
  });

  // Full dataset for the current date range — powers cross-page search.
  const { data: expensesTotalPage } = useQuery({
    queryKey: ["operator-misc-expenses-all", token, orgId, branchId, fromDate, toDate],
    queryFn: () =>
      fetchMiscExpenses(token, orgId!, branchId!, {
        page: 0,
        size: 2000,
        fromDate,
        toDate,
      }),
    enabled: Boolean(token && orgId && branchId),
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

  const createDebtMutation = useMutation({
    mutationFn: (body: CustomerDebtCreateRequest) =>
      createDebt(token, orgId!, branchId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-debts"] });
      queryClient.invalidateQueries({ queryKey: [PENDING_TOTAL_QUERY_KEY] });
      setDebtFormOpen(false);
      setDebtFormCustomerName("");
      setDebtFormCustomerPhone("");
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
    onSuccess: () => {
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

  const settleMutation = useMutation({
    mutationFn: ({ debtId, paymentAmount }: { debtId: string; paymentAmount: number }) =>
      settleDebt(token, orgId!, branchId!, debtId, paymentAmount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-debts"] });
      queryClient.invalidateQueries({ queryKey: [PENDING_TOTAL_QUERY_KEY] });
      setSettleFormOpen(false);
      setSettlingDebt(null);
      setSettleAmount("");
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
  const sortedDebts = useMemo(() => {
    const source = debtsAll.length > 0 ? debtsAll : debts;
    return [...source].sort(debtByNameAsc);
  }, [debtsAll, debts]);
  const [debtSearchQuery, setDebtSearchQuery] = useState("");
  const debtSearchActive = debtSearchQuery.trim().length > 0;
  const filteredDebts = useMemo(() => {
    if (!debtSearchActive) return sortedDebts;
    const q = debtSearchQuery.trim().toLowerCase();
    return sortedDebts.filter((row) =>
      Object.values(row as unknown as Record<string, unknown>).some((v) =>
        v == null ? false : String(v).toLowerCase().includes(q),
      ),
    );
  }, [debtSearchActive, debtSearchQuery, sortedDebts]);
  const visibleDebts = useMemo(() => {
    if (debtSearchActive) return filteredDebts;
    const start = debtsPage * DEBTS_PAGE_SIZE;
    return filteredDebts.slice(start, start + DEBTS_PAGE_SIZE);
  }, [debtSearchActive, filteredDebts, debtsPage]);

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
  const showDebtNotesCol = useMemo(
    () =>
      filteredDebts.some(
        (d: CustomerDebtResponse) => !!d.notes && d.notes.trim() !== ""
      ),
    [filteredDebts]
  );
  const debtTotalElements = filteredDebts.length;

  const openDebtEditForm = (d: CustomerDebtResponse) => {
    setEditingDebt(d);
    setEditDebtCustomerName(d.customerName);
    setEditDebtCustomerPhone(d.customerPhone ?? "");
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
        },
      });
    } finally {
      setEditDebtSubmitting(false);
    }
  };

  const openSettleForm = (d: CustomerDebtResponse) => {
    setSettlingDebt(d);
    setSettleAmount("");
    setSettleFormOpen(true);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingDebt) return;
    const amount = parseFloat(settleAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount.");
      return;
    }
    if (amount > settlingDebt.outstanding) {
      toast.error("Payment cannot exceed outstanding amount.");
      return;
    }
    setSettleSubmitting(true);
    try {
      await settleMutation.mutateAsync({
        debtId: settlingDebt.id,
        paymentAmount: amount,
      });
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
  const sortedExpenses = useMemo(() => {
    const source = expensesAll.length > 0 ? expensesAll : expenses;
    return [...source].sort(expenseByNameAsc);
  }, [expensesAll, expenses]);
  const [expSearchQuery, setExpSearchQuery] = useState("");
  const expSearchActive = expSearchQuery.trim().length > 0;
  const filteredExpenses = useMemo(() => {
    if (!expSearchActive) return sortedExpenses;
    const q = expSearchQuery.trim().toLowerCase();
    return sortedExpenses.filter((row) =>
      Object.values(row as unknown as Record<string, unknown>).some((v) =>
        v == null ? false : String(v).toLowerCase().includes(q),
      ),
    );
  }, [expSearchActive, expSearchQuery, sortedExpenses]);
  const visibleExpenses = useMemo(() => {
    if (expSearchActive) return filteredExpenses;
    const start = expensesPage * EXPENSES_PAGE_SIZE;
    return filteredExpenses.slice(start, start + EXPENSES_PAGE_SIZE);
  }, [expSearchActive, filteredExpenses, expensesPage]);

  const showExpIncurredByCol = useMemo(
    () =>
      filteredExpenses.some(
        (e: MiscExpenseResponse) =>
          !!e.incurredBy && e.incurredBy.trim() !== "" && e.incurredBy !== "—"
      ),
    [filteredExpenses]
  );
  const showExpReceiptRefCol = useMemo(
    () =>
      filteredExpenses.some(
        (e: MiscExpenseResponse) =>
          !!e.receiptRef && e.receiptRef.trim() !== "" && e.receiptRef !== "—"
      ),
    [filteredExpenses]
  );
  const expTotalElements = filteredExpenses.length;
  const expTotalAmount = expensesData?.totalAmount ?? 0;

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
    if (isNaN(amount) || amount <= 0 || !editExpDescription.trim()) {
      toast.error("Enter a valid amount and description.");
      return;
    }
    setEditExpSubmitting(true);
    try {
      await updateExpMutation.mutateAsync({
        expenseId: editingExpense.id,
        body: {
          amount,
          category: editExpCategory,
          description: editExpDescription.trim(),
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
    if (isNaN(amount) || amount <= 0 || !expFormDescription.trim()) {
      toast.error("Enter a valid amount and description.");
      return;
    }
    createExpMutation.mutate({
      amount,
      category: expFormCategory,
      description: expFormDescription.trim(),
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
  const dateRangeLabel = `${fromDate} to ${toDate}`;

  const handleDownloadDebtsPdf = async () => {
    if (!orgId || !branchId) return;
    setDebtsPdfLoading(true);
    try {
      const resp = await fetchDebts(token, orgId, branchId, {
        page: 0,
        size: 2000,
        status: statusQueryForFilter(statusFilter),
        fromDate,
        toDate,
      });
      const rows = [...(resp.content ?? [])].sort(debtByNameAsc);
      if (rows.length === 0) {
        toast.error("No debts matching the selected filters to export.");
        return;
      }
      const statusLabel =
        STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? "All";
      downloadDebtsPdf(rows, {
        branchName,
        statusFilterLabel: statusLabel,
        dateRangeLabel,
      });
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
    if (!orgId || !branchId) return;
    setExpensesPdfLoading(true);
    try {
      const resp = await fetchMiscExpenses(token, orgId, branchId, {
        page: 0,
        size: 2000,
        fromDate,
        toDate,
      });
      const rows = [...(resp.content ?? [])].sort(expenseByNameAsc);
      if (rows.length === 0) {
        toast.error("No expenses in the selected date range to export.");
        return;
      }
      downloadExpensesPdf(rows, {
        branchName,
        dateRangeLabel,
        totalAmount: resp.totalAmount,
      });
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
    <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
      {/* Header: title + date picker + tabs */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader
            title="Debts & Expenses"
            subtitle={branchName ?? "this branch"}
            fallbackTo="/operator"
            noMargin
          />
        </div>

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
      </div>

      {/* ================================================================= */}
      {/* DEBTS TAB                                                         */}
      {/* ================================================================= */}
      {tab === "debts" && (
        <AdminTabPanel panelId="debts-expenses-panel-debts" tabId="debts-expenses-tab-debts">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="debt-status-filter"
                className="text-sm font-medium text-slate-600 dark:text-slate-400"
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
                className="w-full min-w-0 sm:min-w-[12rem]"
                controlClassName="border-slate-200 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 dark:border-slate-600 dark:focus:border-primary-400 dark:focus:ring-primary-400"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {debtTotalElements > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadDebtsPdf}
                  disabled={debtsPdfLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  title={`Download debts from ${fromDate} to ${toDate} (status: ${
                    STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? "All"
                  })`}
                >
                  {debtsPdfLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <FileDown className="h-5 w-5" />
                  )}
                  Download PDF
                </button>
              )}
              <button
                type="button"
                onClick={() => setDebtFormOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700"
              >
                <Plus className="h-5 w-5" />
                Record debt
              </button>
            </div>
          </div>

          {debtsLoading && (
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

          {!debtsLoading && !debtsIsError && (
            <>
              <div className="mb-4 flex items-center gap-2">
                <TableSearchInput value={debtSearchQuery} onChange={setDebtSearchQuery} placeholder="Search debts…" />
                <div className="flex shrink-0 items-center gap-1">
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value || todayStr())} className="w-[8.5rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" aria-label="From date" />
                  <span className="text-xs text-slate-400">to</span>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value || todayStr())} className="w-[8.5rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" aria-label="To date" />
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                {filteredDebts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <HandCoins className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                    <p className="mt-4 text-slate-500 dark:text-slate-400">
                      {!debtSearchActive ? "No debts recorded yet. Record a debt when a customer buys on credit." : "No results match your search."}
                    </p>
                    {!debtSearchActive && (
                      <button
                        type="button"
                        onClick={() => setDebtFormOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary-500 bg-transparent px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/30"
                      >
                        <Plus className="h-4 w-4" />
                        Record debt
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {debtTotalElements > 0 && !debtSearchActive && (
                      <Pagination
                        position="top"
                        page={debtsPage}
                        size={DEBTS_PAGE_SIZE}
                        totalElements={debtTotalElements}
                        onPageChange={setDebtsPage}
                      />
                    )}
                    {debtSearchActive && (
                      <p className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                        Showing {filteredDebts.length} match{filteredDebts.length === 1 ? "" : "es"} across all pages in the selected range.
                      </p>
                    )}
                    <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">&larr; swipe table to see all columns &rarr;</p>
                    <div className="relative min-h-0 flex-1 overflow-auto">
                      <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
                      <table className="w-full divide-y divide-slate-200 dark:divide-slate-600" style={{ minWidth: "1100px" }}>
                        <thead className="bg-slate-50 dark:bg-slate-700">
                          <tr>
                            <th className="sticky left-0 z-20 bg-slate-50 px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:bg-slate-700 dark:text-slate-300">Customer</th>
                            {showDebtPhoneCol && (
                              <th className="px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300">Phone</th>
                            )}
                            <th className="px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300">Original</th>
                            <th className="px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300">Repaid</th>
                            <th className="px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300">Balance</th>
                            <th className="px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300">Status</th>
                            {showDebtDueCol && (
                              <th className="px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300">Due</th>
                            )}
                            <th className="px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300">Created</th>
                            {showDebtNotesCol && (
                              <th className="px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300">Notes</th>
                            )}
                            <th className="px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                          {visibleDebts.map((d: CustomerDebtResponse) => (
                            <tr key={d.id} className="group hover:bg-slate-100 dark:hover:bg-slate-700">
                              <td
                                className={`sticky left-0 z-10 bg-white group-hover:!bg-slate-100 dark:bg-slate-800 dark:group-hover:!bg-slate-700 px-4 py-2 text-lg font-bold text-slate-900 sm:px-6 sm:py-2.5 sm:text-xl dark:text-white ${
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
                                <td className="px-4 py-2 text-lg text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl dark:text-slate-400">{d.customerPhone ?? "—"}</td>
                              )}
                              <td className="px-4 py-2 text-left text-lg tabular-nums text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl dark:text-slate-400">{formatCurrency(d.amount)}</td>
                              <td
                                className={`px-4 py-2 text-left text-lg tabular-nums font-bold text-emerald-600 sm:px-6 sm:py-2.5 sm:text-xl dark:text-emerald-400 ${
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
                                  formatCurrency(d.amountSettled ?? 0)
                                )}
                              </td>
                              <td className="px-4 py-2 text-left text-lg tabular-nums font-bold text-red-600 sm:px-6 sm:py-2.5 sm:text-xl dark:text-red-400">{formatCurrency(d.outstanding)}</td>
                              <td className="px-4 py-2 sm:px-6 sm:py-2.5">
                                <span
                                  className={`inline-flex justify-start rounded-full px-2.5 py-0.5 text-left text-xs font-medium ${
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
                                <td className="px-4 py-2 text-lg text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl dark:text-slate-400">{d.dueDate ?? "—"}</td>
                              )}
                              <td className="px-4 py-2 text-lg text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl dark:text-slate-400">{new Date(d.createdAt).toLocaleString()}</td>
                              {showDebtNotesCol && (
                                <td className="max-w-[14rem] px-4 py-2 align-top text-lg text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl dark:text-slate-400">
                                  {d.notes?.trim() ? (
                                    <div className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words">{d.notes}</div>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              )}
                              <td className="px-4 py-2 text-left sm:px-6 sm:py-2.5">
                                {canRecordPayment(d) ? (
                                  <div className="flex flex-wrap justify-start gap-2">
                                    <button type="button" onClick={() => openSettleForm(d)} className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30" title="Record payment">
                                      <Banknote className="h-4 w-4" />
                                    </button>
                                    {canEditDebt(d) && (
                                      <button type="button" onClick={() => openDebtEditForm(d)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-200" title="Edit customer debt">
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                    )}
                                    {canClearDebt(d) && (
                                      <button type="button" onClick={() => setClearDialogDebt(d)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400" title="Clear debt">
                                        <XCircle className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-3 flex justify-end">
                <DebtPendingTotalDisplay
                  loading={pendingTotalLoading}
                  totalPending={pendingTotalForDateRange}
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
          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {expTotalElements > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadExpensesPdf}
                  disabled={expensesPdfLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  title={`Download all expenses from ${fromDate} to ${toDate}`}
                >
                  {expensesPdfLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <FileDown className="h-5 w-5" />
                  )}
                  Download PDF
                </button>
              )}
              <button
                type="button"
                onClick={() => setExpFormOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700"
              >
                <Plus className="h-5 w-5" />
                Record expense
              </button>
            </div>
          </div>

          {expensesLoading && (
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

          {!expensesLoading && !expensesIsError && (
            <>
              <div className="mb-4 flex items-center gap-2">
                <TableSearchInput value={expSearchQuery} onChange={setExpSearchQuery} placeholder="Search expenses…" />
                <div className="flex shrink-0 items-center gap-1">
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value || todayStr())} className="w-[8.5rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" aria-label="From date" />
                  <span className="text-xs text-slate-400">to</span>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value || todayStr())} className="w-[8.5rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white" aria-label="To date" />
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                {filteredExpenses.length === 0 ? (
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
                    {expTotalElements > 0 && !expSearchActive && (
                      <Pagination
                        position="top"
                        page={expensesPage}
                        size={EXPENSES_PAGE_SIZE}
                        totalElements={expTotalElements}
                        onPageChange={setExpensesPage}
                      />
                    )}
                    {expSearchActive && (
                      <p className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                        Showing {filteredExpenses.length} match{filteredExpenses.length === 1 ? "" : "es"} across all pages in the selected range.
                      </p>
                    )}
                    <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">&larr; swipe table to see all columns &rarr;</p>
                    <div className="relative min-h-0 flex-1 overflow-auto">
                      <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
                      <table className="w-full divide-y divide-slate-200 dark:divide-slate-600" style={{ minWidth: "840px" }}>
                        <thead className="bg-slate-50 dark:bg-slate-700">
                          <tr>
                            {showExpIncurredByCol && (
                              <th className="sticky left-0 z-20 bg-slate-50 px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:bg-slate-700 dark:text-slate-300">Incurred by</th>
                            )}
                            <th className="px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300">Amount</th>
                            <th className="px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300">Category</th>
                            <th className="px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300">Desc.</th>
                            {showExpReceiptRefCol && (
                              <th className="px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300">Receipt ref</th>
                            )}
                            <th className="px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300">Created</th>
                            <th className="px-4 py-3 text-left text-lg font-semibold uppercase tracking-wide text-slate-700 sm:px-6 sm:py-3 sm:text-xl dark:text-slate-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                          {visibleExpenses.map((e: MiscExpenseResponse) => (
                            <tr key={e.id} className="group hover:bg-slate-100 dark:hover:bg-slate-700">
                              {showExpIncurredByCol && (
                                <td className="sticky left-0 z-10 bg-white group-hover:!bg-slate-100 dark:bg-slate-800 dark:group-hover:!bg-slate-700 px-4 py-2 text-lg font-semibold text-slate-700 sm:px-6 sm:py-2.5 sm:text-xl dark:text-slate-300">{e.incurredBy ?? "—"}</td>
                              )}
                              <td className="px-4 py-2 text-lg font-semibold tabular-nums text-slate-700 sm:px-6 sm:py-2.5 sm:text-xl dark:text-slate-300">{formatCurrency(e.amount)}</td>
                              <td className="px-4 py-2 sm:px-6 sm:py-2.5">
                                <span className="inline-flex justify-start rounded-full bg-slate-100 px-2.5 py-0.5 text-left text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">{e.category}</span>
                              </td>
                              <td className="px-4 py-2 text-lg text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl dark:text-slate-400">{e.description}</td>
                              {showExpReceiptRefCol && (
                                <td className="px-4 py-2 text-lg text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl dark:text-slate-400">{e.receiptRef ?? "—"}</td>
                              )}
                              <td className="px-4 py-2 text-lg text-slate-600 sm:px-6 sm:py-2.5 sm:text-xl dark:text-slate-400">{new Date(e.createdAt).toLocaleString()}</td>
                              <td className="px-4 py-2 text-left sm:px-6 sm:py-2.5">
                                <div className="flex justify-start gap-1">
                                  <button type="button" onClick={() => openExpEditForm(e)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-200" title="Edit">
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button type="button" onClick={() => setCancelDialogExpense(e)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400" title="Delete">
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
              {expTotalElements > 0 ? (
                <div className="mt-3 flex justify-end">
                  <MiscExpensesTotalBadge totalAmount={expTotalAmount} />
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
            <input id="debtRecordedOn" type="date" required max={todayInputValue()} value={debtFormRecordedOn} onChange={(e) => setDebtFormRecordedOn(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Defaults to today. Pick a past date when entering an old debt.</p>
          </div>
          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Due date</label>
            <input id="dueDate" type="date" value={debtFormDueDate} onChange={(e) => setDebtFormDueDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
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
              <label htmlFor="editDebtAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Amount (KES) *</label>
              <input id="editDebtAmount" type="number" step="0.01" min="0.01" required value={editDebtAmount} onChange={(e) => setEditDebtAmount(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label htmlFor="editDebtDueDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Due date</label>
              <input id="editDebtDueDate" type="date" value={editDebtDueDate} onChange={(e) => setEditDebtDueDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
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
          if (!settleSubmitting) setSettleAmount("");
        }}
        title="Record payment"
      >
        {settlingDebt && (
          <form onSubmit={handleSettleSubmit} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {settlingDebt.customerName} — outstanding {formatCurrency(settlingDebt.outstanding)}
            </p>
            <div>
              <label htmlFor="settleAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Payment amount (KES) *</label>
              <input id="settleAmount" type="number" step="0.01" min="0.01" max={settlingDebt.outstanding} required value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} placeholder={`Max ${formatCurrency(settlingDebt.outstanding)}`} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setSettleFormOpen(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Cancel</button>
              <button type="submit" disabled={settleSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                {settleSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Banknote className="h-4 w-4" />Record payment</>}
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
            <input id="expRecordedOn" type="date" required max={todayInputValue()} value={expFormRecordedOn} onChange={(e) => setExpFormRecordedOn(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
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
            <label htmlFor="expDescription" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description *</label>
            <textarea id="expDescription" rows={3} required value={expFormDescription} onChange={(e) => setExpFormDescription(e.target.value)} placeholder="e.g. Electricity bill for January" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
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
              <label htmlFor="editExpDescription" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description *</label>
              <textarea id="editExpDescription" rows={3} required value={editExpDescription} onChange={(e) => setEditExpDescription(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white" />
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
    </div>
  );
}
