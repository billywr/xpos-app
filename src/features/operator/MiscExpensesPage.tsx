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
  fetchMiscExpenses,
  createMiscExpense,
  updateMiscExpense,
  cancelMiscExpense,
  type MiscExpenseResponse,
  type MiscExpenseCreateRequest,
  type MiscExpenseUpdateRequest,
  type MiscExpenseCategory,
} from "@/api/miscExpenses";
import { SlideOver } from "@/components/ui/SlideOver";
import { Pagination, ConfirmDialog, TableSearchInput } from "@/components/ui";
import { useTableSearch } from "@/hooks/useTableSearch";
import { formatCurrency } from "@/utils/formatCurrency";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Receipt, Plus, Loader2, Pencil, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SearchableSelect } from "@/components/SearchableSelect";

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

const PAGE_SIZE = 20;
const EXPENSE_CATEGORIES: { value: MiscExpenseCategory; label: string }[] = [
  { value: "UTILITIES", label: "Utilities" },
  { value: "SUPPLIES", label: "Supplies" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "FUEL", label: "Fuel" },
  { value: "RENT", label: "Rent" },
  { value: "SALARIES", label: "Salaries" },
  { value: "OTHER", label: "Other" },
];

export function MiscExpensesPage() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);
  const branchName = useAppSelector(selectBranchName);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState<MiscExpenseCategory>("OTHER");
  const [formDescription, setFormDescription] = useState("");
  const [formIncurredBy, setFormIncurredBy] = useState("");
  const [formReceiptRef, setFormReceiptRef] = useState("");
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<MiscExpenseResponse | null>(
    null
  );
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState<MiscExpenseCategory>("OTHER");
  const [editDescription, setEditDescription] = useState("");
  const [editIncurredBy, setEditIncurredBy] = useState("");
  const [editReceiptRef, setEditReceiptRef] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [cancelDialogExpense, setCancelDialogExpense] =
    useState<MiscExpenseResponse | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const expenseCategoryOptions = useMemo(
    () => EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
    []
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["operator-misc-expenses", token, orgId, branchId, page],
    queryFn: () =>
      fetchMiscExpenses(token, orgId!, branchId!, { page, size: PAGE_SIZE }),
    enabled: Boolean(token && orgId && branchId),
  });

  const createMutation = useMutation({
    mutationFn: (body: MiscExpenseCreateRequest) =>
      createMiscExpense(token, orgId!, branchId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-misc-expenses"] });
      setFormOpen(false);
      setFormAmount("");
      setFormCategory("OTHER");
      setFormDescription("");
      setFormIncurredBy("");
      setFormReceiptRef("");
      toast.success("Expense recorded.", { title: "Miscellaneous expense" });
    },
    onError: (err) => {
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const expenses = data?.content ?? [];
  const { searchQuery, setSearchQuery, filteredRows: filteredExpenses } = useTableSearch(expenses);
  const totalElements = data?.totalElements ?? 0;
  const totalAmount = data?.totalAmount ?? 0;

  const updateMutation = useMutation({
    mutationFn: ({
      expenseId,
      body,
    }: {
      expenseId: string;
      body: MiscExpenseUpdateRequest;
    }) => updateMiscExpense(token, orgId!, branchId!, expenseId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-misc-expenses"] });
      setEditFormOpen(false);
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

  const cancelMutation = useMutation({
    mutationFn: (expenseId: string) =>
      cancelMiscExpense(token, orgId!, branchId!, expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-misc-expenses"] });
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

  const openEditForm = (e: MiscExpenseResponse) => {
    setEditingExpense(e);
    setEditAmount(String(e.amount));
    setEditCategory((e.category as MiscExpenseCategory) || "OTHER");
    setEditDescription(e.description ?? "");
    setEditIncurredBy(e.incurredBy ?? "");
    setEditReceiptRef(e.receiptRef ?? "");
    setEditFormOpen(true);
  };

  const handleEditSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editingExpense) return;
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0 || !editDescription.trim()) {
      toast.error("Enter a valid amount and description.");
      return;
    }
    setEditSubmitting(true);
    try {
      await updateMutation.mutateAsync({
        expenseId: editingExpense.id,
        body: {
          amount,
          category: editCategory,
          description: editDescription.trim(),
          incurredBy: editIncurredBy.trim() || undefined,
          receiptRef: editReceiptRef.trim() || undefined,
        },
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelDialogExpense) return;
    setCancelSubmitting(true);
    try {
      await cancelMutation.mutateAsync(cancelDialogExpense.id);
    } finally {
      setCancelSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0 || !formDescription.trim()) {
      toast.error("Enter a valid amount and description.");
      return;
    }
    createMutation.mutate({
      amount,
      category: formCategory,
      description: formDescription.trim(),
      incurredBy: formIncurredBy.trim() || undefined,
      receiptRef: formReceiptRef.trim() || undefined,
    });
  };

  if (!orgId || !branchId) {
    return (
      <div className="p-6">
        <p className="text-slate-500 dark:text-slate-400">
          Select organization and branch to manage expenses.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Miscellaneous Expenses"
          subtitle={`Record operational expenses for ${branchName ?? "this branch"}`}
          fallbackTo="/operator"
          noMargin
        />
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700"
        >
          <Plus className="h-5 w-5" />
          Record expense
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
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search expenses…" className="mb-4" />
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            {filteredExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Receipt className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                <p className="mt-4 text-slate-500 dark:text-slate-400">
                  {expenses.length === 0 ? "No expenses recorded yet. Record expenses such as utilities, supplies, or maintenance." : "No results match your search."}
                </p>
                {expenses.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setFormOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary-500 bg-transparent px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/30"
                  >
                    <Plus className="h-4 w-4" />
                    Record expense
                  </button>
                )}
              </div>
            ) : (
              <>
              <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">&larr; swipe table to see all columns &rarr;</p>
              <div className="relative overflow-auto">
                <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
                <table className="w-full divide-y divide-slate-200 dark:divide-slate-600" style={{ minWidth: "840px" }}>
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-20 bg-slate-50 px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500 sm:px-3 sm:py-3 dark:bg-slate-700/80 dark:text-slate-400">
                        Incurred by
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500 sm:px-3 sm:py-3 dark:text-slate-400">
                        Amount
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500 sm:px-3 sm:py-3 dark:text-slate-400">
                        Category
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500 sm:px-3 sm:py-3 dark:text-slate-400">
                        Desc.
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500 sm:px-3 sm:py-3 dark:text-slate-400">
                        Receipt ref
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500 sm:px-3 sm:py-3 dark:text-slate-400">
                        Created
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500 sm:px-3 sm:py-3 dark:text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                    {filteredExpenses.map((e: MiscExpenseResponse) => (
                      <tr
                        key={e.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      >
                        <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-xs text-slate-600 sm:px-3 sm:py-2 sm:text-sm dark:bg-slate-800 dark:text-slate-400">
                          {e.incurredBy ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-xs font-medium text-slate-900 sm:px-3 sm:py-2 sm:text-sm dark:text-white">
                          {formatCurrency(e.amount)}
                        </td>
                        <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                          <span className="inline-flex justify-start rounded-full bg-slate-100 px-2.5 py-0.5 text-left text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                            {e.category}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-600 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-400">
                          {e.description}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-500 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-400">
                          {e.receiptRef ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-500 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-400">
                          {new Date(e.createdAt).toLocaleString()}
                        </td>
                        <td className="px-2 py-1.5 text-left sm:px-3 sm:py-2">
                          <div className="flex justify-start gap-1">
                            <button
                              type="button"
                              onClick={() => openEditForm(e)}
                              className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-200"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCancelDialogExpense(e)}
                              className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                              title="Delete"
                            >
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
            {expenses.length > 0 ? (
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
          {expenses.length > 0 ? (
            <div className="mt-3 flex justify-end">
              <MiscExpensesTotalBadge totalAmount={totalAmount} />
            </div>
          ) : null}
        </>
      )}

      <SlideOver
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          if (!createMutation.isPending) {
            setFormAmount("");
            setFormCategory("OTHER");
            setFormDescription("");
            setFormIncurredBy("");
            setFormReceiptRef("");
          }
        }}
        title="Record miscellaneous expense"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
              htmlFor="category"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Category *
            </label>
            <SearchableSelect
              id="category"
              options={expenseCategoryOptions}
              value={formCategory}
              onChange={(v) => setFormCategory(v as MiscExpenseCategory)}
              placeholder="Search category…"
              className="mt-1 block w-full"
              controlClassName="shadow-sm focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
            />
          </div>
          <div>
            <label
              htmlFor="incurredBy"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Incurred by
            </label>
            <input
              id="incurredBy"
              type="text"
              value={formIncurredBy}
              onChange={(e) => setFormIncurredBy(e.target.value)}
              placeholder="Name of person who incurred the expense"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Description *
            </label>
            <textarea
              id="description"
              rows={3}
              required
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="e.g. Electricity bill for January"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="receiptRef"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Receipt / Invoice reference
            </label>
            <input
              id="receiptRef"
              type="text"
              value={formReceiptRef}
              onChange={(e) => setFormReceiptRef(e.target.value)}
              placeholder="Optional"
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
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Record expense
            </button>
          </div>
        </form>
      </SlideOver>

      <SlideOver
        open={editFormOpen}
        onClose={() => {
          setEditFormOpen(false);
          setEditingExpense(null);
          if (!editSubmitting) {
            setEditAmount("");
            setEditDescription("");
            setEditIncurredBy("");
            setEditReceiptRef("");
          }
        }}
        title="Edit expense"
      >
        {editingExpense && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
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
                htmlFor="editCategory"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Category *
              </label>
              <SearchableSelect
                id="editCategory"
                options={expenseCategoryOptions}
                value={editCategory}
                onChange={(v) => setEditCategory(v as MiscExpenseCategory)}
                placeholder="Search category…"
                className="mt-1 block w-full"
                controlClassName="shadow-sm focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
              />
            </div>
            <div>
              <label
                htmlFor="editIncurredBy"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Incurred by
              </label>
              <input
                id="editIncurredBy"
                type="text"
                value={editIncurredBy}
                onChange={(e) => setEditIncurredBy(e.target.value)}
                placeholder="Name of person who incurred the expense"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="editDescription"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Description *
              </label>
              <textarea
                id="editDescription"
                rows={3}
                required
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="editReceiptRef"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Receipt / Invoice reference
              </label>
              <input
                id="editReceiptRef"
                type="text"
                value={editReceiptRef}
                onChange={(e) => setEditReceiptRef(e.target.value)}
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

      <ConfirmDialog
        open={cancelDialogExpense !== null}
        onClose={() => !cancelSubmitting && setCancelDialogExpense(null)}
        onConfirm={handleCancelConfirm}
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
        loading={cancelSubmitting}
      />
    </div>
  );
}
