import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import {
  fetchStockTakingSchedules,
  createStockTakingSchedule,
  updateStockTakingSchedule,
  deleteStockTakingSchedule,
  triggerStockTakingSchedule,
  type StockTakingScheduleResponse,
  type StockTakingScheduleCreateRequest,
  type StockTakingScheduleUpdateRequest,
} from "@/api/stockTaking";
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import { PageHeader } from "@/components/PageHeader";
import { SlideOver, Pagination, ConfirmDialog } from "@/components/ui";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import {
  CalendarClock,
  Plus,
  Play,
  Trash2,
  Pencil,
  Loader2,
} from "lucide-react";

const PAGE_SIZE = 20;
const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

function formatLastRun(lastRunAt: string | null): string {
  if (!lastRunAt) return "—";
  const d = new Date(lastRunAt);
  return d.toLocaleString("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatSchedule(s: StockTakingScheduleResponse): string {
  if (s.frequency === "DAILY") {
    return `Daily at ${String(s.scheduledHour).padStart(2, "0")}:${String(s.scheduledMinute).padStart(2, "0")}`;
  }
  const day = DAYS.find((d) => d.value === s.dayOfWeek)?.label ?? "?";
  return `Weekly (${day}) at ${String(s.scheduledHour).padStart(2, "0")}:${String(s.scheduledMinute).padStart(2, "0")}`;
}

export function StockTakingSchedulesPage() {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [page, setPage] = useState(0);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<StockTakingScheduleResponse | null>(null);
  const [deleteSchedule, setDeleteSchedule] =
    useState<StockTakingScheduleResponse | null>(null);
  const [branchId, setBranchId] = useState("");
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY">("DAILY");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [scheduledHour, setScheduledHour] = useState(6);
  const [scheduledMinute, setScheduledMinute] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: branchesData } = useQuery({
    queryKey: ["admin-branches", token, selectedOrgId],
    queryFn: () => fetchBranches(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const { data: schedulesData, isLoading, isError, error } = useQuery({
    queryKey: ["admin-stock-taking-schedules", token, selectedOrgId, page],
    queryFn: () =>
      fetchStockTakingSchedules(token, selectedOrgId, {
        page,
        size: PAGE_SIZE,
      }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const orgs = orgsData?.content ?? [];
  const branches = branchesData?.content ?? [];
  const filteredOrgs = filterActiveOrgs(orgs);
  const filteredBranches = filterNonDeletedBranches(branches);
  const schedules = schedulesData?.content ?? [];
  const totalElements = schedulesData?.totalElements ?? 0;
  const totalPages = schedulesData?.totalPages ?? 0;
  const branchMap = new Map(branches.map((b: Branch) => [b.id, b.name]));

  useEffect(() => {
    if (!selectedOrgId && filteredOrgs.length > 0) {
      setSelectedOrgId(filteredOrgs[0].id);
    }
  }, [filteredOrgs, selectedOrgId]);

  const createMutation = useMutation({
    mutationFn: (body: StockTakingScheduleCreateRequest) =>
      createStockTakingSchedule(token, selectedOrgId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-stock-taking-schedules"],
      });
      setSlideOpen(false);
      resetForm();
      toast.success("Schedule created.", { title: "Stock taking" });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      scheduleId,
      body,
    }: {
      scheduleId: string;
      body: StockTakingScheduleUpdateRequest;
    }) =>
      updateStockTakingSchedule(token, selectedOrgId, scheduleId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-stock-taking-schedules"],
      });
      setSlideOpen(false);
      setEditingSchedule(null);
      resetForm();
      toast.success("Schedule updated.", { title: "Stock taking" });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: (scheduleId: string) =>
      triggerStockTakingSchedule(token, selectedOrgId, scheduleId),
    onSuccess: () => {
      setTriggeringId(null);
      queryClient.invalidateQueries({
        queryKey: ["admin-stock-taking-schedules"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-stock-count-sessions"] });
      toast.success("Stock count session started.", { title: "Stock taking" });
    },
    onError: (err) => {
      setTriggeringId(null);
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  function resetForm() {
    setBranchId("");
    setFrequency("DAILY");
    setDayOfWeek(1);
    setScheduledHour(6);
    setScheduledMinute(0);
    setIsActive(true);
  }

  function openCreate() {
    resetForm();
    setEditingSchedule(null);
    setSlideOpen(true);
  }

  function openEdit(s: StockTakingScheduleResponse) {
    setEditingSchedule(s);
    setBranchId(s.branchId);
    setFrequency(s.frequency);
    setDayOfWeek(s.dayOfWeek ?? 1);
    setScheduledHour(s.scheduledHour);
    setScheduledMinute(s.scheduledMinute);
    setIsActive(s.isActive);
    setSlideOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingSchedule) {
      updateMutation.mutate({
        scheduleId: editingSchedule.id,
        body: {
          frequency,
          dayOfWeek: frequency === "WEEKLY" ? dayOfWeek : null,
          scheduledHour,
          scheduledMinute,
          isActive,
        },
      });
    } else {
      if (!branchId) {
        toast.error("Select a branch.", { title: "Validation" });
        return;
      }
      createMutation.mutate({
        branchId,
        frequency,
        dayOfWeek: frequency === "WEEKLY" ? dayOfWeek : null,
        scheduledHour,
        scheduledMinute,
      });
    }
  }

  async function handleDelete() {
    if (!deleteSchedule) return;
    setDeleteLoading(true);
    try {
      await deleteStockTakingSchedule(token, selectedOrgId, deleteSchedule.id);
      queryClient.invalidateQueries({
        queryKey: ["admin-stock-taking-schedules"],
      });
      setDeleteSchedule(null);
      toast.success("Schedule deleted.", { title: "Stock taking" });
    } catch (err) {
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    } finally {
      setDeleteLoading(false);
    }
  }

  if (!selectedOrgId && filteredOrgs.length > 0) {
    return null;
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Stock Taking Schedules"
          subtitle="Configure daily or weekly automatic stock counts per branch."
          icon={CalendarClock}
          fallbackTo="/admin"
          noMargin
        />
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Organization
          </label>
          <select
            value={selectedOrgId}
            onChange={(e) => {
              setSelectedOrgId(e.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            <option value="">Select organization…</option>
            {filteredOrgs.map((org: Org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={openCreate}
            disabled={!selectedOrgId || filteredBranches.length === 0}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add schedule
          </button>
        </div>
      </div>

      {!selectedOrgId && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Select an organization to view schedules.
        </div>
      )}

      {selectedOrgId && isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Loading…
        </div>
      )}

      {selectedOrgId && isError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{getApiErrorMessage(error)}</p>
        </div>
      )}

      {selectedOrgId && !isLoading && !isError && (
        <>
          {schedules.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              No stock taking schedules. Add a schedule to enable automatic stock
              counts.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-600">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Branch
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Schedule
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Last run
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                    {schedules.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                          {branchMap.get(s.branchId) ?? s.branchId}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                          {formatSchedule(s)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          {formatLastRun(s.lastRunAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex justify-start rounded-full px-2 py-1 text-left text-xs font-medium ${
                              s.isActive
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                            }`}
                          >
                            {s.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-left">
                          <div className="flex items-center justify-start gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setTriggeringId(s.id);
                                triggerMutation.mutate(s.id);
                              }}
                              disabled={
                                !s.isActive || triggeringId === s.id
                              }
                              title="Run now"
                              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-primary-600 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-primary-400"
                            >
                              {triggeringId === s.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(s)}
                              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-primary-600 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-primary-400"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteSchedule(s)}
                              className="rounded-lg p-2 text-slate-600 hover:bg-red-100 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination
                    page={page}
                    size={PAGE_SIZE}
                    totalElements={totalElements}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      <SlideOver
        open={slideOpen}
        onClose={() => {
          setSlideOpen(false);
          setEditingSchedule(null);
          resetForm();
        }}
        title={editingSchedule ? "Edit schedule" : "Add schedule"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!editingSchedule && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Branch *
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              >
                <option value="">Select branch…</option>
                {filteredBranches.map((b: Branch) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as "DAILY" | "WEEKLY")
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </div>
          {frequency === "WEEKLY" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Day of week
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              >
                {DAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Hour (0–23)
              </label>
              <input
                type="number"
                min={0}
                max={23}
                value={scheduledHour}
                onChange={(e) => setScheduledHour(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Minute (0–59)
              </label>
              <input
                type="number"
                min={0}
                max={59}
                value={scheduledMinute}
                onChange={(e) => setScheduledMinute(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
          </div>
          {editingSchedule && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-slate-300"
              />
              <label htmlFor="isActive" className="text-sm text-slate-700 dark:text-slate-300">
                Active
              </label>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setSlideOpen(false);
                setEditingSchedule(null);
                resetForm();
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {editingSchedule ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </SlideOver>

      <ConfirmDialog
        open={Boolean(deleteSchedule)}
        title="Delete schedule"
        message={
          deleteSchedule
            ? `Delete the ${formatSchedule(deleteSchedule)} schedule for ${branchMap.get(deleteSchedule.branchId) ?? deleteSchedule.branchId}?`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onClose={() => setDeleteSchedule(null)}
        loading={deleteLoading}
      />
    </div>
  );
}
