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
import {
  Badge,
  Button,
  IconButton,
  SlideOver,
  ConfirmDialog,
  Pagination,
  SortableTableHead,
  TableRowNumberHead,
  TableRowNumberCell,
  TableSearchInput,
  TableSkeleton,
  FormLabel,
  tableBodyRow,
  tableHeadCell,
  tableBodyCell,
  tableStickyFirstBody,
  tableEmptyCell,
} from "@/components/ui";
import { useQueryDisplay } from "@/hooks/useQueryDisplay";
import { useServerPaginatedTableSearch } from "@/hooks/useServerPaginatedTableSearch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Plus, Pencil, Smartphone, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface TerminalsListPageProps {
  initialOrgId?: string;
}

const TERMINAL_SORT = {
  code: (row: Terminal) => row.terminalCode,
  status: (row: Terminal) => row.status,
};

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

  const terminalsQuery = useQuery({
    queryKey: ["admin-terminals", token, selectedOrgId, selectedBranchId, page, size],
    queryFn: () =>
      fetchTerminals(token, selectedOrgId, selectedBranchId, { page, size }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedBranchId),
  });
  const { data: terminalsData, isError, error, refetch } = terminalsQuery;
  const { isInitialLoad, isRefreshing } = useQueryDisplay(terminalsQuery);

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
  const {
    searchQuery,
    setSearchQuery,
    filteredRows: filteredTerminals,
    totalElements,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useServerPaginatedTableSearch({
    pageRows: terminals,
    serverTotalElements: terminalsData?.totalElements ?? 0,
    page,
    size,
    setPage,
    searchAllQueryKey: ["admin-terminals", token, selectedOrgId, selectedBranchId],
    searchAllQueryFn: (fetchSize) =>
      fetchTerminals(token, selectedOrgId, selectedBranchId, { page: 0, size: fetchSize }),
    searchAllEnabled:
      Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedBranchId),
    sortAccessors: TERMINAL_SORT,
  });
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
            className="w-full sm:w-56"
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
            className="w-full sm:w-56"
            controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 disabled:opacity-50"
          />
        </div>
        {selectedOrgId && selectedBranchId && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add terminal
          </Button>
        )}
      </div>

      {!selectedOrgId || !selectedBranchId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization and branch to view and manage terminals.
        </div>
      ) : (
        <>
          {isError && (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
              role="alert"
            >
              <p>{getApiErrorMessage(error)}</p>
              {getApiErrorRequestId(error) && (
                <p className="mt-2 text-sm opacity-90">
                  Reference:{" "}
                  <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">
                    {getApiErrorRequestId(error)}
                  </code>
                </p>
              )}
            </div>
          )}
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search terminals…" className="mb-4" />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="min-h-0 flex-1 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <TableRowNumberHead />
                    <SortableTableHead
                      columnKey="code"
                      label="Code"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    <SortableTableHead
                      columnKey="status"
                      label="Status"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    <SortableTableHead
                      columnKey="actions"
                      label="Actions"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      sortable={false}
                      className={tableHeadCell}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {isInitialLoad ? (
                    <TableSkeleton columns={6} />
                  ) : filteredTerminals.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className={tableEmptyCell}
                      >
                        {terminals.length === 0 ? `No terminals yet for ${selectedBranch?.name}. Add one to get started.` : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredTerminals.map((terminal: Terminal, index) => (
                      <tr
                        key={terminal.id}
                        className={tableBodyRow}
                      >
                    <TableRowNumberCell page={page} pageSize={size} indexInPage={index} />
                        <td className={tableStickyFirstBody}>
                          {terminal.terminalCode}
                        </td>
                        <td className={tableBodyCell}>
                          <Badge status={terminal.status}>{terminal.status}</Badge>
                        </td>
                        <td className={tableBodyCell}>
                          <div className="flex justify-start gap-2">
                            <IconButton
                              onClick={() => openEdit(terminal)}
                              title={`Edit ${terminal.terminalCode}`}
                              aria-label={`Edit ${terminal.terminalCode}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              onClick={() => openBind(terminal)}
                              title={`Bind device to ${terminal.terminalCode}`}
                              aria-label={`Bind device to ${terminal.terminalCode}`}
                            >
                              <Smartphone className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              variant="danger"
                              onClick={() => setConfirmDelete(terminal)}
                              title={`Delete ${terminal.terminalCode}`}
                              aria-label={`Delete ${terminal.terminalCode}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
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
                onRefresh={() => void refetch()}
                isRefreshing={isRefreshing}
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
                <FormLabel htmlFor="terminal-code" className="mb-1">
                  Terminal code
                </FormLabel>
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
                <FormLabel htmlFor="terminal-printer" className="mb-1">
                  Printer profile ID (optional)
                </FormLabel>
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
                <Button type="button" variant="secondary" size="md" onClick={() => setSlideOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="md" disabled={submitLoading}>
                  {submitLoading
                    ? "Saving…"
                    : editingTerminal
                      ? "Save"
                      : "Create"}
                </Button>
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
                <FormLabel htmlFor="bind-device-select" className="mb-1">
                  Device
                </FormLabel>
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
                <Button type="button" variant="secondary" size="md" onClick={() => setBindSlideOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="md" disabled={bindLoading || !formDeviceId}>
                  {bindLoading ? "Binding…" : "Bind"}
                </Button>
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
