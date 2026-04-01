import { useState, useMemo } from "react";
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
  fetchDebtPendingTotal,
  createDebt,
  updateDebt,
  cancelDebt,
  settleDebt,
  type CustomerDebtResponse,
  type CustomerDebtCreateRequest,
  type CustomerDebtUpdateRequest,
} from "@/api/debts";
import { createCustomer } from "@/api/customers";
import { SlideOver } from "@/components/ui/SlideOver";
import { Pagination, ConfirmDialog } from "@/components/ui";
import { formatCurrency } from "@/utils/formatCurrency";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import {
  HandCoins,
  Plus,
  Loader2,
  Pencil,
  XCircle,
  Banknote,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SearchableSelect } from "@/components/SearchableSelect";
import { motion, AnimatePresence } from "framer-motion";

const PAGE_SIZE = 20;

/** Default list: still owed (OPEN or PARTIAL). OPEN-only hid rows after any repayment. */
const STATUS_OUTSTANDING = "OUTSTANDING";

const STATUS_OPTIONS = [
  { value: STATUS_OUTSTANDING, label: "Outstanding (open + partial)" },
  { value: "OPEN", label: "Open only" },
  { value: "PARTIAL", label: "Partial only" },
  { value: "CLOSED", label: "Closed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "", label: "All" },
] as const;

function statusQueryForFilter(filter: string): string | readonly string[] | undefined {
  if (filter === "") {
    return undefined;
  }
  if (filter === STATUS_OUTSTANDING) {
    return ["OPEN", "PARTIAL"];
  }
  return filter;
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

export function DebtsPage() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);
  const branchName = useAppSelector(selectBranchName);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [formCustomerName, setFormCustomerName] = useState("");
  const [formCustomerPhone, setFormCustomerPhone] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<CustomerDebtResponse | null>(
    null
  );
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [clearDialogDebt, setClearDialogDebt] =
    useState<CustomerDebtResponse | null>(null);
  const [clearSubmitting, setClearSubmitting] = useState(false);
  const [settleFormOpen, setSettleFormOpen] = useState(false);
  const [settlingDebt, setSettlingDebt] =
    useState<CustomerDebtResponse | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleSubmitting, setSettleSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_OUTSTANDING);

  const debtStatusFilterOptions = useMemo(
    () => STATUS_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
    []
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["operator-debts", token, orgId, branchId, page, statusFilter],
    queryFn: () =>
      fetchDebts(token, orgId!, branchId!, {
        page,
        size: PAGE_SIZE,
        status: statusQueryForFilter(statusFilter),
      }),
    enabled: Boolean(token && orgId && branchId),
  });

  const { data: pendingTotalData, isLoading: pendingTotalLoading } = useQuery({
    queryKey: [PENDING_TOTAL_QUERY_KEY, token, orgId, branchId],
    queryFn: () => fetchDebtPendingTotal(token, orgId!, branchId!),
    enabled: Boolean(token && orgId && branchId),
  });


  const createMutation = useMutation({
    mutationFn: (body: CustomerDebtCreateRequest) =>
      createDebt(token, orgId!, branchId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-debts"] });
      queryClient.invalidateQueries({ queryKey: [PENDING_TOTAL_QUERY_KEY] });
      setFormOpen(false);
      setFormCustomerName("");
      setFormCustomerPhone("");
      setFormAmount("");
      setFormDueDate("");
      toast.success("Debt recorded.", { title: "Customer debt" });
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      debtId,
      body,
    }: {
      debtId: string;
      body: CustomerDebtUpdateRequest;
    }) => updateDebt(token, orgId!, branchId!, debtId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-debts"] });
      queryClient.invalidateQueries({ queryKey: [PENDING_TOTAL_QUERY_KEY] });
      setEditFormOpen(false);
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

  const cancelMutation = useMutation({
    mutationFn: (debtId: string) =>
      cancelDebt(token, orgId!, branchId!, debtId),
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
    mutationFn: ({
      debtId,
      paymentAmount,
    }: { debtId: string; paymentAmount: number }) =>
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

  const debts = data?.content ?? [];

  const openEditForm = (d: CustomerDebtResponse) => {
    setEditingDebt(d);
    setEditCustomerName(d.customerName);
    setEditCustomerPhone(d.customerPhone ?? "");
    setEditAmount(String(d.amount));
    setEditDueDate(d.dueDate ?? "");
    setEditNotes(d.notes ?? "");
    setEditFormOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebt) return;
    const name = editCustomerName.trim();
    if (!name) {
      toast.error("Customer name is required.");
      return;
    }
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    const phoneTrim = editCustomerPhone.trim();
    const customerPhonePayload: string | undefined =
      phoneTrim.length > 0 ? phoneTrim : editingDebt.customerPhone ? "" : undefined;
    setEditSubmitting(true);
    try {
      await updateMutation.mutateAsync({
        debtId: editingDebt.id,
        body: {
          customerName: name,
          ...(customerPhonePayload !== undefined ? { customerPhone: customerPhonePayload } : {}),
          amount,
          dueDate: editDueDate || undefined,
          notes: editNotes.trim() === "" ? "" : editNotes.trim(),
        },
      });
    } finally {
      setEditSubmitting(false);
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

  const handleClearConfirm = async () => {
    if (!clearDialogDebt) return;
    setClearSubmitting(true);
    try {
      await cancelMutation.mutateAsync(clearDialogDebt.id);
    } finally {
      setClearSubmitting(false);
    }
  };

  const canRecordPayment = (d: CustomerDebtResponse) =>
    d.status === "OPEN" || d.status === "PARTIAL";

  const canEdit = (d: CustomerDebtResponse) =>
    (d.status === "OPEN" || d.status === "PARTIAL")
    && Number(d.amountSettled ?? 0) === 0;

  const canClear = (d: CustomerDebtResponse) =>
    (d.status === "OPEN" || d.status === "PARTIAL")
    && Number(d.amountSettled ?? 0) === 0;
  const totalElements = data?.totalElements ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formAmount);
    const name = formCustomerName.trim();
    if (!name || isNaN(amount) || amount <= 0) {
      toast.error("Enter customer name and a valid amount.");
      return;
    }
    setSubmitting(true);
    try {
      const customer = await createCustomer(token, orgId!, {
        name,
        phone: formCustomerPhone.trim() || undefined,
      });
      await createMutation.mutateAsync({
        customerId: customer.id,
        amount,
        dueDate: formDueDate || undefined,
        notes: formNotes || undefined,
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!orgId || !branchId) {
    return (
      <div className="p-6">
        <p className="text-slate-500 dark:text-slate-400">
          Select organization and branch to manage debts.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Customer Debts"
          subtitle={`Record and view credit sales for ${branchName ?? "this branch"}`}
          fallbackTo="/operator"
          noMargin
        >
          <div className="mt-3 flex items-center gap-2">
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
                setPage(0);
              }}
              aria-label="Filter by status"
              placeholder="Search status…"
              compact
              className="min-w-[12rem]"
              controlClassName="border-slate-200 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 dark:border-slate-600 dark:focus:border-primary-400 dark:focus:ring-primary-400"
            />
          </div>
        </PageHeader>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700"
        >
          <Plus className="h-5 w-5" />
          Record debt
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
          <p className="font-medium text-red-800 dark:text-red-200">
            {getApiErrorMessage(error)}
          </p>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            {debts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <HandCoins className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                <p className="mt-4 text-slate-500 dark:text-slate-400">
                  No debts recorded yet. Record a debt when a customer buys on
                  credit.
                </p>
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary-500 bg-transparent px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/30"
                >
                  <Plus className="h-4 w-4" />
                  Record debt
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Original
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Repaid
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Balance
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Due date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Created
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                    {debts.map((d: CustomerDebtResponse) => (
                      <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          {d.customerName}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {d.customerPhone ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-left text-slate-700 dark:text-slate-300">
                          {formatCurrency(d.amount)}
                        </td>
                        <td className="px-4 py-3 text-left text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(d.amountSettled ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-left font-medium text-amber-600 dark:text-amber-400">
                          {formatCurrency(d.outstanding)}
                        </td>
                        <td className="px-4 py-3">
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
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {d.dueDate ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                          {new Date(d.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-left">
                          {canRecordPayment(d) ? (
                            <div className="flex flex-wrap justify-start gap-2">
                              <button
                                type="button"
                                onClick={() => openSettleForm(d)}
                                className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                                title="Record payment"
                              >
                                <Banknote className="h-4 w-4" />
                              </button>
                              {canEdit(d) && (
                                <button
                                  type="button"
                                  onClick={() => openEditForm(d)}
                                  className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-200"
                                  title="Edit customer debt"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              )}
                              {canClear(d) && (
                                <button
                                  type="button"
                                  onClick={() => setClearDialogDebt(d)}
                                  className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                  title="Clear debt"
                                >
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
            )}
            {debts.length > 0 ? (
              <div className="border-t border-slate-200 bg-slate-50/90 px-4 py-4 dark:border-slate-600 dark:bg-slate-900/50">
                <Pagination
                  page={data?.number ?? 0}
                  size={PAGE_SIZE}
                  totalElements={totalElements}
                  onPageChange={setPage}
                />
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex justify-end">
            <DebtPendingTotalDisplay
              loading={pendingTotalLoading}
              totalPending={pendingTotalData?.totalPending ?? 0}
            />
          </div>
        </>
      )}

      <SlideOver
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          if (!submitting) {
            setFormCustomerName("");
            setFormCustomerPhone("");
            setFormAmount("");
            setFormDueDate("");
          }
        }}
        title="Record customer debt"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="customerName"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Customer name *
            </label>
            <input
              id="customerName"
              type="text"
              required
              value={formCustomerName}
              onChange={(e) => setFormCustomerName(e.target.value)}
              placeholder="e.g. John Kamau"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="customerPhone"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Customer phone
            </label>
            <input
              id="customerPhone"
              type="tel"
              value={formCustomerPhone}
              onChange={(e) => setFormCustomerPhone(e.target.value)}
              placeholder="e.g. +254 700 123 456"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Amount (KES) *
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="dueDate"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Due date
            </label>
            <input
              id="dueDate"
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Notes
            </label>
            <textarea
              id="notes"
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Record debt
            </button>
          </div>
        </form>
      </SlideOver>

      <SlideOver
        open={editFormOpen}
        onClose={() => {
          setEditFormOpen(false);
          setEditingDebt(null);
          if (!editSubmitting) {
            setEditCustomerName("");
            setEditCustomerPhone("");
            setEditAmount("");
            setEditDueDate("");
            setEditNotes("");
          }
        }}
        title="Edit customer debt"
      >
        {editingDebt && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Same fields as recording a debt. Edits are only allowed before any repayment; use
              Record payment after that.
            </p>
            <div>
              <label
                htmlFor="editCustomerName"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Customer name *
              </label>
              <input
                id="editCustomerName"
                type="text"
                required
                value={editCustomerName}
                onChange={(e) => setEditCustomerName(e.target.value)}
                placeholder="e.g. John Kamau"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="editCustomerPhone"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Customer phone
              </label>
              <input
                id="editCustomerPhone"
                type="tel"
                value={editCustomerPhone}
                onChange={(e) => setEditCustomerPhone(e.target.value)}
                placeholder="e.g. +254 700 123 456"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="editAmount"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Amount (KES) *
              </label>
              <input
                id="editAmount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="editDueDate"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Due date
              </label>
              <input
                id="editDueDate"
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="editNotes"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Notes
              </label>
              <textarea
                id="editNotes"
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setEditFormOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {editSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Pencil className="h-4 w-4" />
                    Save
                  </>
                )}
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
              {settlingDebt.customerName} — outstanding{" "}
              {formatCurrency(settlingDebt.outstanding)}
            </p>
            <div>
              <label
                htmlFor="settleAmount"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Payment amount (KES) *
              </label>
              <input
                id="settleAmount"
                type="number"
                step="0.01"
                min="0.01"
                max={settlingDebt.outstanding}
                required
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                placeholder={`Max ${formatCurrency(settlingDebt.outstanding)}`}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setSettleFormOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={settleSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {settleSubmitting ? (
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
        onClose={() => !clearSubmitting && setClearDialogDebt(null)}
        onConfirm={handleClearConfirm}
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
        loading={clearSubmitting}
      />
    </div>
  );
}
