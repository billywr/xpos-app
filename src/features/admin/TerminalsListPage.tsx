import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { fetchDevices } from "@/api/devices";
import {
  fetchTerminals,
  createTerminal,
  updateTerminal,
  deleteTerminal,
  bindDeviceToTerminal,
} from "@/api/terminals";
import type { Org, Branch, Terminal } from "@/types/org";
import {
  filterActiveOrgs,
  filterNonDeletedBranches,
  filterNonDeletedDevices,
} from "@/types/org";
import { PageHeader } from "@/components/PageHeader";
import { SlideOver, ConfirmDialog, Pagination, TableSearchInput } from "@/components/ui";
import { useTableSearch } from "@/hooks/useTableSearch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Plus, Pencil, Smartphone, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface TerminalsListPageProps {
  initialOrgId?: string;
}

export function TerminalsListPage({ initialOrgId }: TerminalsListPageProps = {}) {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId ?? "");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<Terminal | null>(null);
  const [bindSlideOpen, setBindSlideOpen] = useState(false);
  const [terminalToBind, setTerminalToBind] = useState<Terminal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Terminal | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formCode, setFormCode] = useState("");
  const [formPrinterProfileId, setFormPrinterProfileId] = useState("");
  const [formDeviceId, setFormDeviceId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [bindLoading, setBindLoading] = useState(false);

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

  const { data: terminalsData, isLoading, isError, error } = useQuery({
    queryKey: ["admin-terminals", token, selectedOrgId, selectedBranchId, page, size],
    queryFn: () =>
      fetchTerminals(token, selectedOrgId, selectedBranchId, { page, size }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedBranchId),
  });

  const { data: devicesData } = useQuery({
    queryKey: ["admin-devices", token, selectedOrgId],
    queryFn: () => fetchDevices(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && bindSlideOpen,
  });

  const createMutation = useMutation({
    mutationFn: (body: { terminalCode: string; printerProfileId?: string | null }) =>
      createTerminal(token, selectedOrgId, selectedBranchId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-terminals", token, selectedOrgId, selectedBranchId],
      });
      setSlideOpen(false);
      setEditingTerminal(null);
      setFormCode("");
      setFormPrinterProfileId("");
      setFormError(null);
      toast.success("Terminal created.", { title: "Created" });
    },
    onError: (err) => {
      setSubmitLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (body: {
      terminalId: string;
      terminalCode: string;
      printerProfileId?: string | null;
    }) =>
      updateTerminal(token, selectedOrgId, selectedBranchId, body.terminalId, {
        terminalCode: body.terminalCode,
        printerProfileId: body.printerProfileId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-terminals", token, selectedOrgId, selectedBranchId],
      });
      setSlideOpen(false);
      setEditingTerminal(null);
      setFormCode("");
      setFormPrinterProfileId("");
      setFormError(null);
      toast.success("Terminal updated.", { title: "Saved" });
    },
    onError: (err) => {
      setSubmitLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const bindMutation = useMutation({
    mutationFn: (deviceRegistrationId: string) =>
      bindDeviceToTerminal(
        token,
        selectedOrgId,
        selectedBranchId,
        terminalToBind!.id,
        deviceRegistrationId
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-terminals", token, selectedOrgId, selectedBranchId],
      });
      setBindSlideOpen(false);
      setTerminalToBind(null);
      setFormDeviceId("");
      setFormError(null);
      setBindLoading(false);
      toast.success("Device bound to terminal.", { title: "Bound" });
    },
    onError: (err) => {
      setBindLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (terminalId: string) =>
      deleteTerminal(token, selectedOrgId, selectedBranchId, terminalId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-terminals", token, selectedOrgId, selectedBranchId],
      });
      setConfirmDelete(null);
      setDeleteLoading(false);
      toast.success("Terminal deleted.", { title: "Deleted" });
    },
    onError: (err) => {
      setDeleteLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const branches = filterNonDeletedBranches(branchesData?.content ?? []);
  const terminals = terminalsData?.content ?? [];
  const { searchQuery, setSearchQuery, filteredRows: filteredTerminals } = useTableSearch(terminals);
  const totalElements = terminalsData?.totalElements ?? 0;
  const devices = filterNonDeletedDevices(devicesData?.content ?? []);

  const selectedBranch = branches.find((b: Branch) => b.id === selectedBranchId);

  useEffect(() => {
    if (initialOrgId) {
      setSelectedOrgId(initialOrgId);
    } else if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [initialOrgId, orgs, selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId) {
      setSelectedBranchId("");
    }
  }, [selectedOrgId]);

  useEffect(() => {
    if (!selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  const orgSelectOptions = useMemo(
    () => [
      { value: "", label: "Select organization…" },
      ...orgs.map((org: Org) => ({ value: org.id, label: org.name })),
    ],
    [orgs]
  );

  const branchSelectOptions = useMemo(
    () => [
      { value: "", label: "Select branch…" },
      ...branches.map((branch: Branch) => ({
        value: branch.id,
        label: branch.name,
      })),
    ],
    [branches]
  );

  const bindDeviceOptions = useMemo(
    () => [
      { value: "", label: "Select device…" },
      ...devices.map((d) => ({
        value: d.id,
        label: `${d.deviceId} (${d.status})`,
      })),
    ],
    [devices]
  );

  const openCreate = () => {
    setEditingTerminal(null);
    setFormCode("");
    setFormPrinterProfileId("");
    setFormError(null);
    setSlideOpen(true);
  };

  const openEdit = (terminal: Terminal) => {
    setEditingTerminal(terminal);
    setFormCode(terminal.terminalCode);
    setFormPrinterProfileId(terminal.printerProfileId ?? "");
    setFormError(null);
    setSlideOpen(true);
  };

  const openBind = (terminal: Terminal) => {
    setTerminalToBind(terminal);
    setFormDeviceId("");
    setFormError(null);
    setBindSlideOpen(true);
  };

  const handleSlideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = formCode.trim();
    if (!trimmed) {
      setFormError("Terminal code is required.");
      return;
    }
    setSubmitLoading(true);
    const printerId = formPrinterProfileId.trim() || null;
    if (editingTerminal) {
      updateMutation.mutate(
        { terminalId: editingTerminal.id, terminalCode: trimmed, printerProfileId: printerId },
        { onSettled: () => setSubmitLoading(false) }
      );
    } else {
      createMutation.mutate(
        { terminalCode: trimmed, printerProfileId: printerId },
        { onSettled: () => setSubmitLoading(false) }
      );
    }
  };

  const handleDeleteConfirm = () => {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    deleteMutation.mutate(confirmDelete.id);
  };

  const handleBindSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formDeviceId) {
      setFormError("Select a device.");
      return;
    }
    if (!terminalToBind) return;
    setBindLoading(true);
    bindMutation.mutate(formDeviceId, { onSettled: () => setBindLoading(false) });
  };

  const handleSizeChange = (newSize: number) => {
    setSize(Math.min(newSize, MAX_PAGE_SIZE));
    setPage(0);
  };

  if (isLoading && selectedOrgId && selectedBranchId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Terminals"
          subtitle="Loading…"
          fallbackTo="/admin"
        />
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Loading…
        </div>
      </div>
    );
  }

  if (isError && selectedOrgId && selectedBranchId) {
    const message = getApiErrorMessage(error);
    const requestId = getApiErrorRequestId(error);
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Terminals"
          fallbackTo="/admin"
        />
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{message}</p>
          {requestId && (
            <p className="mt-2 text-sm opacity-90">
              Reference:{" "}
              <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">
                {requestId}
              </code>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        title="Terminals"
        subtitle="Per-branch terminals. Select org and branch to list and manage."
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="terminal-org-select"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Organization
          </label>
          <SearchableSelect
            id="terminal-org-select"
            options={orgSelectOptions}
            value={selectedOrgId}
            onChange={setSelectedOrgId}
            placeholder="Search organization…"
            className="w-56"
            controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="terminal-branch-select"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Branch
          </label>
          <SearchableSelect
            id="terminal-branch-select"
            options={branchSelectOptions}
            value={selectedBranchId}
            onChange={(next) => {
              setSelectedBranchId(next);
              setPage(0);
            }}
            disabled={!selectedOrgId}
            placeholder="Search branch…"
            className="w-56"
            controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 disabled:opacity-50"
          />
        </div>
        {selectedOrgId && selectedBranchId && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-primary-500 dark:hover:bg-primary-600 dark:focus:ring-offset-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add terminal
          </button>
        )}
      </div>

      {!selectedOrgId || !selectedBranchId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization and branch to view and manage terminals.
        </div>
      ) : (
        <>
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search terminals…" className="mb-4" />
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredTerminals.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        {terminals.length === 0 ? `No terminals yet for ${selectedBranch?.name}. Add one to get started.` : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredTerminals.map((terminal: Terminal) => (
                      <tr
                        key={terminal.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                          {terminal.terminalCode}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex justify-start rounded-full px-2 py-0.5 text-left text-xs font-medium ${
                              terminal.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {terminal.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-left">
                          <div className="flex justify-start gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(terminal)}
                              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                              title={`Edit ${terminal.terminalCode}`}
                              aria-label={`Edit ${terminal.terminalCode}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openBind(terminal)}
                              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                              title={`Bind device to ${terminal.terminalCode}`}
                              aria-label={`Bind device to ${terminal.terminalCode}`}
                            >
                              <Smartphone className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(terminal)}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                              title={`Delete ${terminal.terminalCode}`}
                              aria-label={`Delete ${terminal.terminalCode}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalElements > 0 && (
              <Pagination
                page={page}
                size={size}
                totalElements={totalElements}
                onPageChange={setPage}
                onSizeChange={handleSizeChange}
                sizeOptions={[10, 25, 50, 100]}
              />
            )}
          </div>

          <SlideOver
            open={slideOpen}
            onClose={() => {
              setSlideOpen(false);
              setEditingTerminal(null);
              setFormError(null);
            }}
            title={editingTerminal ? "Edit terminal" : "Add terminal"}
          >
            <form onSubmit={handleSlideSubmit} className="space-y-4">
              {formError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
                  {formError}
                </p>
              )}
              <div>
                <label
                  htmlFor="terminal-code"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Terminal code
                </label>
                <input
                  id="terminal-code"
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g. T1"
                  autoFocus
                />
              </div>
              <div>
                <label
                  htmlFor="terminal-printer"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Printer profile ID (optional)
                </label>
                <input
                  id="terminal-printer"
                  type="text"
                  value={formPrinterProfileId}
                  onChange={(e) => setFormPrinterProfileId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="Leave empty if not used"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setSlideOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600"
                >
                  {submitLoading
                    ? "Saving…"
                    : editingTerminal
                      ? "Save"
                      : "Create"}
                </button>
              </div>
            </form>
          </SlideOver>

          <SlideOver
            open={bindSlideOpen}
            onClose={() => {
              setBindSlideOpen(false);
              setTerminalToBind(null);
              setFormError(null);
            }}
            title={terminalToBind ? `Bind device to ${terminalToBind.terminalCode}` : "Bind device"}
          >
            <form onSubmit={handleBindSubmit} className="space-y-4">
              {formError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
                  {formError}
                </p>
              )}
              <div>
                <label
                  htmlFor="bind-device-select"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Device
                </label>
                <SearchableSelect
                  id="bind-device-select"
                  options={bindDeviceOptions}
                  value={formDeviceId}
                  onChange={setFormDeviceId}
                  placeholder="Search device…"
                  matchOptionValue
                  className="w-full"
                  controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                />
                {devices.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Register devices for this org first (Devices page).
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setBindSlideOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bindLoading || !formDeviceId}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600"
                >
                  {bindLoading ? "Binding…" : "Bind"}
                </button>
              </div>
            </form>
          </SlideOver>

          <ConfirmDialog
            open={Boolean(confirmDelete)}
            onClose={() => setConfirmDelete(null)}
            onConfirm={handleDeleteConfirm}
            title="Delete terminal?"
            message={
              confirmDelete ? (
                <>
                  <strong>{confirmDelete.terminalCode}</strong> will be marked as deleted. It will
                  disappear from lists but remain in the system for audit purposes.
                </>
              ) : (
                ""
              )
            }
            confirmLabel="Delete"
            variant="danger"
            loading={deleteLoading}
          />
        </>
      )}
    </div>
  );
}
