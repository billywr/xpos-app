import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  fetchRecurringUtilities,
  fetchRecurringUtilitySummary,
  createRecurringUtility,
  updateRecurringUtility,
  deleteRecurringUtility,
  type RecurringUtility,
  type RecurringUtilityApplyTiming,
  type RecurringUtilityCreateRequest,
  type RecurringUtilityUpdateRequest,
} from "@/api/recurringUtilities";
import { SlideOver } from "@/components/ui/SlideOver";
import {
  Pagination,
  ConfirmDialog,
  TableRowNumberHead,
  TableRowNumberCell,
  StatChip,
  TableSearchInput,
  tableBodyRow,
  tableRowNoHead,
  tableRowNoCell,
} from "@/components/ui";
import { SearchableSelect } from "@/components/SearchableSelect";
import { formatAmount, formatAmountWithCommas } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import { generateUtilitiesPdf } from "@/utils/utilitiesPdf";
import { getApiErrorMessage } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/utils/cn";
import {
  Building2,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Power,
} from "lucide-react";
import {
  DEFAULT_UTILITY_PRESETS,
  readSavedUtilityPresets,
  addUtilityPreset,
  removeUtilityPreset,
} from "@/utils/utilityPresetsStorage";

export { DEFAULT_UTILITY_PRESETS };

export function formatMonthYear(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const [year, month] = dateStr.slice(0, 7).split("-");
  if (!year || !month) return dateStr;
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const mIdx = parseInt(month, 10) - 1;
  return `${monthNames[mIdx] ?? month} ${year}`;
}

export function getUtilityStatus(u: RecurringUtility): {
  label: "ACTIVE" | "ENDED" | "UPCOMING" | "PAUSED";
  className: string;
} {
  const todayYm = new Date().toISOString().slice(0, 7);
  const effectiveDate = u.effectiveFrom || (u.createdAt ? u.createdAt.slice(0, 10) : undefined);
  const fromYm = effectiveDate ? effectiveDate.slice(0, 7) : undefined;
  const toYm = u.effectiveTo ? u.effectiveTo.slice(0, 7) : undefined;

  if (toYm && toYm < todayYm) {
    return {
      label: "ENDED",
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    };
  }
  if (!u.active) {
    return {
      label: "PAUSED",
      className: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
    };
  }
  if (fromYm && fromYm > todayYm) {
    return {
      label: "UPCOMING",
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    };
  }
  return {
    label: "ACTIVE",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  };
}

export interface UtilitiesTabPanelProps {
  orgId: string;
  branchId: string;
  branchName?: string | null;
  isCreateOpen: boolean;
  setIsCreateOpen: (open: boolean) => void;
  downloadPdfRef?: React.MutableRefObject<(() => void) | null>;
}

export function UtilitiesTabPanel({
  orgId,
  branchId,
  branchName,
  isCreateOpen,
  setIsCreateOpen,
  downloadPdfRef,
}: UtilitiesTabPanelProps) {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Modals state
  const [editingUtility, setEditingUtility] = useState<RecurringUtility | null>(null);
  const [deletingUtility, setDeletingUtility] = useState<RecurringUtility | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formEffectiveFrom, setFormEffectiveFrom] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}-01`;
  });
  const [formEffectiveTo, setFormEffectiveTo] = useState("");
  const [formApplyTiming, setFormApplyTiming] =
    useState<RecurringUtilityApplyTiming>("BEGINNING_OF_MONTH");
  const [formNotes, setFormNotes] = useState("");
  const [formActive, setFormActive] = useState(true);

  const isEffectiveToBeforeFrom = Boolean(
    formEffectiveFrom &&
      formEffectiveTo &&
      formEffectiveTo.slice(0, 7) < formEffectiveFrom.slice(0, 7)
  );

  useEffect(() => {
    if (isCreateOpen) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      setFormName("");
      setFormAmount("");
      setFormEffectiveFrom(`${year}-${month}-01`);
      setFormEffectiveTo("");
      setFormApplyTiming("BEGINNING_OF_MONTH");
      setFormNotes("");
      setFormActive(true);
    }
  }, [isCreateOpen]);

  const activeParam =
    activeFilter === "active" ? true : activeFilter === "inactive" ? false : undefined;

  const {
    data: utilitiesData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["recurring-utilities", orgId, branchId, activeParam, search, page],
    queryFn: () =>
      fetchRecurringUtilities(token, orgId, branchId, {
        active: activeParam,
        query: search || undefined,
        page,
        size: pageSize,
      }),
    enabled: Boolean(token && orgId && branchId),
  });

  const { data: summaryData } = useQuery({
    queryKey: ["recurring-utilities-summary", orgId, branchId],
    queryFn: () => fetchRecurringUtilitySummary(token, orgId, branchId),
    enabled: Boolean(token && orgId && branchId),
  });

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["recurring-utilities"] });
    queryClient.invalidateQueries({ queryKey: ["recurring-utilities-summary"] });
    queryClient.invalidateQueries({ queryKey: ["revenue-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["admin-revenue-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["admin-revenue-utilities"] });
  };

  const createMutation = useMutation({
    mutationFn: (body: RecurringUtilityCreateRequest) =>
      createRecurringUtility(token, orgId, branchId, body),
    onSuccess: () => {
      invalidateQueries();
      toast.success("Recurring utility added successfully.");
      setIsCreateOpen(false);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: RecurringUtilityUpdateRequest }) =>
      updateRecurringUtility(token, orgId, branchId, id, body),
    onSuccess: () => {
      invalidateQueries();
      toast.success("Utility updated successfully.");
      setEditingUtility(null);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateRecurringUtility(token, orgId, branchId, id, { active }),
    onSuccess: (_, vars) => {
      invalidateQueries();
      toast.success(vars.active ? "Utility activated." : "Utility paused.");
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRecurringUtility(token, orgId, branchId, id),
    onSuccess: () => {
      invalidateQueries();
      toast.success("Utility deleted.");
      setDeletingUtility(null);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const [presets, setPresets] = useState<string[]>(() =>
    readSavedUtilityPresets(orgId, branchId)
  );

  useEffect(() => {
    setPresets(readSavedUtilityPresets(orgId, branchId));
  }, [orgId, branchId]);

  const handleAddPreset = useCallback(
    (nameToAdd: string) => {
      const trimmed = nameToAdd.trim();
      if (!trimmed) return;
      const updated = addUtilityPreset(orgId, branchId, trimmed);
      setPresets(updated);
      toast.success(`"${trimmed}" added to presets.`);
    },
    [orgId, branchId, toast]
  );

  const handleDeletePreset = useCallback(
    (nameToDelete: string) => {
      const trimmed = nameToDelete.trim();
      const updated = removeUtilityPreset(orgId, branchId, trimmed);
      setPresets(updated);
      if (formName.localeCompare(trimmed, undefined, { sensitivity: "base" }) === 0) {
        setFormName("");
      }
      toast.success(`"${trimmed}" removed from presets.`);
    },
    [orgId, branchId, formName, toast]
  );

  const utilities = useMemo(() => utilitiesData?.items ?? [], [utilitiesData?.items]);

  // Build searchable dropdown options from saved presets
  const utilityOptions = useMemo(() => {
    return presets.map((name) => ({
      value: name,
      label: name,
    }));
  }, [presets]);

  const openEdit = (u: RecurringUtility) => {
    setEditingUtility(u);
    setFormName(u.name);
    setFormAmount(formatAmountWithCommas(String(u.amount)));
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const initialEffective =
      u.effectiveFrom ||
      (u.createdAt ? u.createdAt.slice(0, 10) : `${year}-${month}-01`);
    setFormEffectiveFrom(initialEffective);
    setFormEffectiveTo(u.effectiveTo || "");
    setFormApplyTiming(u.applyTiming ?? "BEGINNING_OF_MONTH");
    setFormNotes(u.notes ?? "");
    setFormActive(u.active);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Please provide a utility name.");
      return;
    }
    const parsedAmount = parseFloat(formAmount.replace(/,/g, ""));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount greater than zero.");
      return;
    }
    if (!formEffectiveFrom) {
      toast.error("Please select an effective from month.");
      return;
    }
    if (
      formEffectiveTo &&
      formEffectiveTo.slice(0, 7) < formEffectiveFrom.slice(0, 7)
    ) {
      toast.error(
        `Effective to month (${formatMonthYear(formEffectiveTo)}) cannot be earlier than Effective from month (${formatMonthYear(formEffectiveFrom)}). It must be ${formatMonthYear(formEffectiveFrom)} or a future month.`
      );
      return;
    }

    const trimmedName = formName.trim();
    const updated = addUtilityPreset(orgId, branchId, trimmedName);
    setPresets(updated);

    createMutation.mutate({
      name: trimmedName,
      amount: parsedAmount,
      effectiveFrom: formEffectiveFrom || undefined,
      effectiveTo: formEffectiveTo ? `${formEffectiveTo.slice(0, 7)}-01` : undefined,
      applyTiming: formApplyTiming,
      notes: formNotes.trim() || undefined,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUtility) return;
    if (!formName.trim()) {
      toast.error("Please provide a utility name.");
      return;
    }
    const parsedAmount = parseFloat(formAmount.replace(/,/g, ""));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount greater than zero.");
      return;
    }
    if (!formEffectiveFrom) {
      toast.error("Please select an effective from month.");
      return;
    }
    if (
      formEffectiveTo &&
      formEffectiveTo.slice(0, 7) < formEffectiveFrom.slice(0, 7)
    ) {
      toast.error(
        `Effective to month (${formatMonthYear(formEffectiveTo)}) cannot be earlier than Effective from month (${formatMonthYear(formEffectiveFrom)}). It must be ${formatMonthYear(formEffectiveFrom)} or a future month.`
      );
      return;
    }

    const trimmedName = formName.trim();
    const updated = addUtilityPreset(orgId, branchId, trimmedName);
    setPresets(updated);

    updateMutation.mutate({
      id: editingUtility.id,
      body: {
        name: trimmedName,
        amount: parsedAmount,
        effectiveFrom: formEffectiveFrom || undefined,
        effectiveTo: formEffectiveTo ? `${formEffectiveTo.slice(0, 7)}-01` : null,
        applyTiming: formApplyTiming,
        notes: formNotes.trim() || undefined,
        active: formActive,
      },
    });
  };

  const handleDownloadPdf = useCallback(() => {
    if (utilities.length === 0) {
      toast.error("No utilities to download.");
      return;
    }
    const doc = generateUtilitiesPdf(utilities, {
      branchName,
      searchQuery: search || null,
      statusFilterLabel:
        activeFilter === "active"
          ? "Active only"
          : activeFilter === "inactive"
          ? "Inactive only"
          : "All",
      totalMonthlyAmount: summaryData?.monthlyTotalAmount,
    });
    doc.save(`recurring-utilities-${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [utilities, branchName, search, activeFilter, summaryData?.monthlyTotalAmount, toast]);

  useEffect(() => {
    if (downloadPdfRef) {
      downloadPdfRef.current = handleDownloadPdf;
    }
    return () => {
      if (downloadPdfRef) {
        downloadPdfRef.current = null;
      }
    };
  }, [downloadPdfRef, handleDownloadPdf]);

  return (
    <div className="space-y-4">
      {/* Filter and Control Bar */}
      <div className="mb-4 flex flex-col gap-1">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:gap-4">
          <TableSearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(0);
            }}
            placeholder="Search utilities…"
            className="w-full sm:flex-1 sm:max-w-xs lg:max-w-sm [&>input]:sm:max-w-none"
          />
          <div className="hidden xl:flex items-center gap-1.5 shrink-0">
            <label
              htmlFor="utility-status-filter"
              className="text-xs font-semibold text-slate-500 whitespace-nowrap dark:text-slate-400"
            >
              Status
            </label>
            <SearchableSelect
              id="utility-status-filter"
              options={[
                { value: "all", label: "All statuses" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
              value={activeFilter}
              onChange={(v) => {
                setActiveFilter(v as "all" | "active" | "inactive");
                setPage(0);
              }}
              optionsOrder="as_given"
              aria-label="Filter by status"
              placeholder="Search status…"
              compact
              className="w-44"
              controlClassName="border-slate-200 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 dark:border-slate-600 dark:focus:border-primary-400 dark:focus:ring-primary-400"
            />
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
          <p className="font-medium text-red-800 dark:text-red-200">
            {getApiErrorMessage(error)}
          </p>
        </div>
      ) : utilities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-16 text-center dark:border-slate-700 dark:bg-slate-800/30">
          <div className="rounded-full bg-primary-50 p-3 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400">
            <Building2 className="h-8 w-8" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
            No recurring utilities defined yet
          </h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            Define recurring overhead bills like Rent, Electricity, Internet/WiFi, Water, or TV
            subscriptions once to automatically recognize them in monthly net profit.
          </p>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            <span>Add first utility</span>
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="relative min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-full divide-y divide-slate-200 dark:divide-slate-600 xl:min-w-[1100px]">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <TableRowNumberHead className={`${tableRowNoHead} hidden xl:table-cell`} />
                  <th className="px-2 py-2 text-left text-xs font-semibold text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300">
                    Utility name
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300">
                    Amount
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300">
                    Effective from
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300">
                    Effective to
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300">
                    Status
                  </th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-slate-700 sm:text-sm xl:px-6 xl:py-3 xl:text-xl dark:text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                {utilities.map((u, idx) => (
                  <tr
                    key={u.id}
                    className={cn(
                      tableBodyRow,
                      !u.active && "opacity-60 bg-slate-50/50 dark:bg-slate-900/40"
                    )}
                  >
                    <TableRowNumberCell
                      className={`${tableRowNoCell} hidden xl:table-cell`}
                      page={page}
                      pageSize={pageSize}
                      indexInPage={idx}
                    />
                    <td className="px-2 py-1.5 text-xs font-bold text-slate-900 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-white">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary-500 shrink-0" />
                        <span>{u.name}</span>
                      </div>
                      {u.notes && (
                        <p className="mt-0.5 text-[11px] font-normal text-slate-400 dark:text-slate-500 truncate max-w-xs">
                          {u.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-left text-xs font-semibold tabular-nums text-slate-700 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-slate-300">
                      {formatAmount(Number(u.amount))}
                    </td>
                    <td className="px-2 py-1.5 text-left text-xs text-slate-700 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-slate-300">
                      {(() => {
                        const effectiveDate =
                          u.effectiveFrom ||
                          (u.createdAt ? u.createdAt.slice(0, 10) : undefined);
                        if (!effectiveDate) {
                          return <span className="text-slate-400 dark:text-slate-500">—</span>;
                        }
                        return (
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {formatDate(effectiveDate)}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-2 py-1.5 text-left text-xs text-slate-700 sm:text-sm xl:px-6 xl:py-2.5 xl:text-xl dark:text-slate-300">
                      {u.effectiveTo ? (
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {formatDate(u.effectiveTo)}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 sm:px-6 sm:py-2.5">
                      {(() => {
                        const status = getUtilityStatus(u);
                        return (
                          <span
                            className={cn(
                              "inline-flex justify-start rounded-full px-2.5 py-0.5 text-left text-[11px] font-medium sm:text-xs",
                              status.className
                            )}
                          >
                            {status.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-2 py-1.5 text-right sm:px-6 sm:py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="rounded p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                          title="Edit utility"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActiveMutation.mutate({ id: u.id, active: !u.active })}
                          disabled={toggleActiveMutation.isPending}
                          className={cn(
                            "rounded p-1 transition",
                            u.active
                              ? "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                              : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                          )}
                          title={u.active ? "Pause / Deactivate" : "Activate"}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingUtility(u)}
                          className="rounded p-1 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30"
                          title="Delete utility"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Summary Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <StatChip
                label="Total Monthly Active"
                value={`KSH ${formatAmount(summaryData?.monthlyTotalAmount ?? 0)}`}
              />
              <StatChip
                label="Active Bills"
                value={String(summaryData?.activeCount ?? 0)}
              />
            </div>

            {utilitiesData && utilitiesData.totalPages > 1 && (
              <Pagination
                page={page}
                size={pageSize}
                totalElements={utilitiesData.totalElements}
                onPageChange={setPage}
              />
            )}
          </div>
        </div>
      )}

      {/* CREATE SLIDEOVER */}
      <SlideOver
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add recurring utility"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {/* Row: Utility Name (50%) and Amount (50%) side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Utility name <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={utilityOptions}
                value={formName}
                onChange={(val) => setFormName(val)}
                placeholder="Select preset or type custom utility name..."
                allowCustomValue={true}
                optionsOrder="as_given"
                onAddOption={handleAddPreset}
                onDeleteOption={handleDeletePreset}
                addOptionPlaceholder="New utility name..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={formAmount}
                onChange={(e) => setFormAmount(formatAmountWithCommas(e.target.value))}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <div className="space-y-1.5">
              <label htmlFor="createEffectiveFrom" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Effective From <span className="text-red-500">*</span>
              </label>
              <input
                id="createEffectiveFrom"
                type="month"
                required
                value={formEffectiveFrom.slice(0, 7)}
                onChange={(e) => {
                  const newFrom = e.target.value;
                  setFormEffectiveFrom(newFrom ? `${newFrom}-01` : "");
                  if (newFrom && formEffectiveTo && formEffectiveTo.slice(0, 7) < newFrom) {
                    setFormEffectiveTo("");
                  }
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="createEffectiveTo" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Effective to
              </label>
              <input
                id="createEffectiveTo"
                type="month"
                min={formEffectiveFrom ? formEffectiveFrom.slice(0, 7) : undefined}
                value={formEffectiveTo ? formEffectiveTo.slice(0, 7) : ""}
                onChange={(e) => setFormEffectiveTo(e.target.value ? `${e.target.value}-01` : "")}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1",
                  isEffectiveToBeforeFrom
                    ? "border-rose-400 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-rose-500 dark:border-rose-500 dark:bg-rose-950/20 dark:text-rose-200"
                    : "border-slate-300 bg-white text-slate-900 focus:border-primary-500 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                )}
              />
              {isEffectiveToBeforeFrom && (
                <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  Effective to month cannot be earlier than Effective from month ({formatMonthYear(formEffectiveFrom)}). It must be {formatMonthYear(formEffectiveFrom)} or a future month.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Apply on <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition",
                  formApplyTiming === "BEGINNING_OF_MONTH"
                    ? "border-primary-500 bg-primary-50/70 dark:border-primary-400 dark:bg-primary-950/60 dark:ring-1 dark:ring-primary-400/40"
                    : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50 dark:border-slate-600 dark:bg-slate-700/60 dark:hover:border-slate-500 dark:hover:bg-slate-700"
                )}
              >
                <input
                  type="radio"
                  name="createApplyTiming"
                  value="BEGINNING_OF_MONTH"
                  checked={formApplyTiming === "BEGINNING_OF_MONTH"}
                  onChange={() => setFormApplyTiming("BEGINNING_OF_MONTH")}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Beginning of month (1st)
                </span>
              </label>

              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition",
                  formApplyTiming === "END_OF_MONTH"
                    ? "border-primary-500 bg-primary-50/70 dark:border-primary-400 dark:bg-primary-950/60 dark:ring-1 dark:ring-primary-400/40"
                    : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50 dark:border-slate-600 dark:bg-slate-700/60 dark:hover:border-slate-500 dark:hover:bg-slate-700"
                )}
              >
                <input
                  type="radio"
                  name="createApplyTiming"
                  value="END_OF_MONTH"
                  checked={formApplyTiming === "END_OF_MONTH"}
                  onChange={() => setFormApplyTiming("END_OF_MONTH")}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  End of month (last day)
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Notes
            </label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Optional notes or instructions..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-primary-500 dark:hover:bg-primary-600"
            >
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{createMutation.isPending ? "Saving…" : "Save"}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-200 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              Cancel
            </button>
          </div>
        </form>
      </SlideOver>

      {/* EDIT SLIDEOVER */}
      <SlideOver
        open={Boolean(editingUtility)}
        onClose={() => setEditingUtility(null)}
        title="Edit recurring utility"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {/* Row: Utility Name (50%) and Amount (50%) side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Utility name <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={utilityOptions}
                value={formName}
                onChange={(val) => setFormName(val)}
                placeholder="Select preset or type custom utility name..."
                allowCustomValue={true}
                optionsOrder="as_given"
                onAddOption={handleAddPreset}
                onDeleteOption={handleDeletePreset}
                addOptionPlaceholder="New utility name..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={formAmount}
                onChange={(e) => setFormAmount(formatAmountWithCommas(e.target.value))}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <div className="space-y-1.5">
              <label htmlFor="editEffectiveFrom" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Effective From <span className="text-red-500">*</span>
              </label>
              <input
                id="editEffectiveFrom"
                type="month"
                required
                value={formEffectiveFrom.slice(0, 7)}
                onChange={(e) => {
                  const newMonth = e.target.value;
                  setFormEffectiveFrom(newMonth ? `${newMonth}-01` : "");
                  if (newMonth && formEffectiveTo && formEffectiveTo.slice(0, 7) < newMonth) {
                    setFormEffectiveTo("");
                  }
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="editEffectiveTo" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Effective to
              </label>
              <input
                id="editEffectiveTo"
                type="month"
                min={formEffectiveFrom ? formEffectiveFrom.slice(0, 7) : undefined}
                value={formEffectiveTo ? formEffectiveTo.slice(0, 7) : ""}
                onChange={(e) => {
                  setFormEffectiveTo(e.target.value ? `${e.target.value}-01` : "");
                }}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1",
                  isEffectiveToBeforeFrom
                    ? "border-rose-400 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-rose-500 dark:border-rose-500 dark:bg-rose-950/20 dark:text-rose-200"
                    : "border-slate-300 bg-white text-slate-900 focus:border-primary-500 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                )}
              />
              {isEffectiveToBeforeFrom && (
                <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  Effective to month cannot be earlier than Effective from month ({formatMonthYear(formEffectiveFrom)}). It must be {formatMonthYear(formEffectiveFrom)} or a future month.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Apply on <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition",
                  formApplyTiming === "BEGINNING_OF_MONTH"
                    ? "border-primary-500 bg-primary-50/70 dark:border-primary-400 dark:bg-primary-950/60 dark:ring-1 dark:ring-primary-400/40"
                    : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50 dark:border-slate-600 dark:bg-slate-700/60 dark:hover:border-slate-500 dark:hover:bg-slate-700"
                )}
              >
                <input
                  type="radio"
                  name="editApplyTiming"
                  value="BEGINNING_OF_MONTH"
                  checked={formApplyTiming === "BEGINNING_OF_MONTH"}
                  onChange={() => setFormApplyTiming("BEGINNING_OF_MONTH")}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Beginning of month (1st)
                </span>
              </label>

              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition",
                  formApplyTiming === "END_OF_MONTH"
                    ? "border-primary-500 bg-primary-50/70 dark:border-primary-400 dark:bg-primary-950/60 dark:ring-1 dark:ring-primary-400/40"
                    : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50 dark:border-slate-600 dark:bg-slate-700/60 dark:hover:border-slate-500 dark:hover:bg-slate-700"
                )}
              >
                <input
                  type="radio"
                  name="editApplyTiming"
                  value="END_OF_MONTH"
                  checked={formApplyTiming === "END_OF_MONTH"}
                  onChange={() => setFormApplyTiming("END_OF_MONTH")}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  End of month (last day)
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Notes
            </label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="editUtilityActive"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="editUtilityActive" className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Active (deduct from monthly profit)
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-primary-500 dark:hover:bg-primary-600"
            >
              {updateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{updateMutation.isPending ? "Saving…" : "Save"}</span>
            </button>
            <button
              type="button"
              onClick={() => setEditingUtility(null)}
              className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-200 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              Cancel
            </button>
          </div>
        </form>
      </SlideOver>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        open={Boolean(deletingUtility)}
        title="Delete Recurring Utility"
        message={`Are you sure you want to delete "${deletingUtility?.name}"? It will no longer be deducted from monthly profits.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingUtility) {
            deleteMutation.mutate(deletingUtility.id);
          }
        }}
        onClose={() => setDeletingUtility(null)}
      />
    </div>
  );
}
