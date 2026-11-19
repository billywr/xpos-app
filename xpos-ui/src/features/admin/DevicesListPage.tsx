import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import {
  fetchDevices,
  registerDevice,
  activateDevice,
  deactivateDevice,
  deleteDevice,
} from "@/api/devices";
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import type { DeviceRegistration } from "@/types/org";
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
import { Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface DevicesListPageProps {
  initialOrgId?: string;
}

const DEVICE_SORT = {
  deviceId: (row: DeviceRegistration) => row.deviceId,
  status: (row: DeviceRegistration) => row.status,
};

export function DevicesListPage({ initialOrgId }: DevicesListPageProps = {}) {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId ?? "");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [slideOpen, setSlideOpen] = useState(false);
  const [confirmActivate, setConfirmActivate] = useState<DeviceRegistration | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<DeviceRegistration | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DeviceRegistration | null>(null);
  const [formBranchId, setFormBranchId] = useState("");
  const [formDeviceId, setFormDeviceId] = useState("");
  const [formFingerprint, setFormFingerprint] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [activateLoading, setActivateLoading] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: branchesData } = useQuery({
    queryKey: ["admin-branches", token, selectedOrgId],
    queryFn: () => fetchBranches(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && slideOpen,
  });

  const devicesQuery = useQuery({
    queryKey: ["admin-devices", token, selectedOrgId, page, size],
    queryFn: () => fetchDevices(token, selectedOrgId, { page, size }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });
  const { data: devicesData, isError, error, refetch } = devicesQuery;
  const { isInitialLoad, isRefreshing } = useQueryDisplay(devicesQuery);

  const registerMutation = useMutation({
    mutationFn: (body: { branchId: string; deviceId: string; deviceFingerprint?: string | null }) =>
      registerDevice(token, selectedOrgId, body.branchId, {
        deviceId: body.deviceId,
        deviceFingerprint: body.deviceFingerprint || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-devices", token, selectedOrgId],
      });
      setSlideOpen(false);
      setFormBranchId("");
      setFormDeviceId("");
      setFormFingerprint("");
      setFormError(null);
      toast.success("Device registered.", { title: "Registered" });
    },
    onError: (err) => {
      setSubmitLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (deviceRegistrationId: string) =>
      activateDevice(token, selectedOrgId, deviceRegistrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-devices", token, selectedOrgId],
      });
      setConfirmActivate(null);
      setActivateLoading(false);
      toast.success("Device activated.", { title: "Activated" });
    },
    onError: (err) => {
      setActivateLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (deviceRegistrationId: string) =>
      deactivateDevice(token, selectedOrgId, deviceRegistrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-devices", token, selectedOrgId],
      });
      setConfirmDeactivate(null);
      setDeactivateLoading(false);
      toast.success("Device deactivated.", { title: "Deactivated" });
    },
    onError: (err) => {
      setDeactivateLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (deviceRegistrationId: string) =>
      deleteDevice(token, selectedOrgId, deviceRegistrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-devices", token, selectedOrgId],
      });
      setConfirmDelete(null);
      setDeleteLoading(false);
      toast.success("Device deleted.", { title: "Deleted" });
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
  const devices = devicesData?.content ?? [];
  const {
    searchQuery,
    setSearchQuery,
    filteredRows: filteredDevices,
    totalElements,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useServerPaginatedTableSearch({
    pageRows: devices,
    serverTotalElements: devicesData?.totalElements ?? 0,
    page,
    size,
    setPage,
    searchAllQueryKey: ["admin-devices", token, selectedOrgId],
    searchAllQueryFn: (fetchSize) =>
      fetchDevices(token, selectedOrgId, { page: 0, size: fetchSize }),
    searchAllEnabled: Boolean(token) && Boolean(selectedOrgId),
    sortAccessors: DEVICE_SORT,
  });

  useEffect(() => {
    if (initialOrgId) {
      setSelectedOrgId(initialOrgId);
    } else if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [initialOrgId, orgs, selectedOrgId]);

  useEffect(() => {
    if (slideOpen && branches.length > 0 && !formBranchId) {
      setFormBranchId(branches[0].id);
    }
  }, [slideOpen, branches, formBranchId]);

  const orgSelectOptions = useMemo(
    () => [
      { value: "", label: "Select organization…" },
      ...orgs.map((org: Org) => ({ value: org.id, label: org.name })),
    ],
    [orgs]
  );

  const branchRegisterOptions = useMemo(
    () => [
      { value: "", label: "Select branch…" },
      ...branches.map((b: Branch) => ({ value: b.id, label: b.name })),
    ],
    [branches]
  );

  const openRegister = () => {
    setFormBranchId(branches[0]?.id ?? "");
    setFormDeviceId("");
    setFormFingerprint("");
    setFormError(null);
    setSlideOpen(true);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = formDeviceId.trim();
    if (!trimmed) {
      setFormError("Device ID is required.");
      return;
    }
    if (!formBranchId) {
      setFormError("Branch is required.");
      return;
    }
    setSubmitLoading(true);
    registerMutation.mutate(
      {
        branchId: formBranchId,
        deviceId: trimmed,
        deviceFingerprint: formFingerprint.trim() || null,
      },
      { onSettled: () => setSubmitLoading(false) }
    );
  };

  const handleActivateConfirm = () => {
    if (!confirmActivate) return;
    setActivateLoading(true);
    activateMutation.mutate(confirmActivate.id);
  };

  const handleDeactivateConfirm = () => {
    if (!confirmDeactivate) return;
    setDeactivateLoading(true);
    deactivateMutation.mutate(confirmDeactivate.id);
  };

  const handleDeleteConfirm = () => {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    deleteMutation.mutate(confirmDelete.id);
  };

  const handleSizeChange = (newSize: number) => {
    setSize(Math.min(newSize, MAX_PAGE_SIZE));
    setPage(0);
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        title="Devices"
        subtitle="Register and manage devices per organization. Bind devices to terminals from Terminals."
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          {orgs.length > 1 && (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="device-org-select"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Organization
              </label>
              <SearchableSelect
                id="device-org-select"
                options={orgSelectOptions}
                value={selectedOrgId}
                onChange={(next) => {
                  setSelectedOrgId(next);
                  setPage(0);
                }}
                placeholder="Search organization…"
                className="w-full sm:w-56"
                controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
              />
            </div>
          )}
          {selectedOrgId && (
            <TableSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search devices…"
              className="w-full sm:w-64"
            />
          )}
        </div>
        {selectedOrgId && (
          <Button onClick={openRegister}>
            <Plus className="h-4 w-4" />
            Register device
          </Button>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view and manage devices.
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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="min-h-0 flex-1 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <TableRowNumberHead />
                    <SortableTableHead
                      columnKey="deviceId"
                      label="Device ID"
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
                  ) : filteredDevices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className={tableEmptyCell}
                      >
                        {devices.length === 0 ? "No devices registered yet. Register a device to get started." : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredDevices.map((device: DeviceRegistration, index) => (
                      <tr
                        key={device.id}
                        className={tableBodyRow}
                      >
                    <TableRowNumberCell page={page} pageSize={size} indexInPage={index} />
                        <td className={tableStickyFirstBody}>
                          {device.deviceId}
                        </td>
                        <td className={tableBodyCell}>
                          <Badge status={device.status}>{device.status}</Badge>
                        </td>
                        <td className={tableBodyCell}>
                          <div className="flex justify-start gap-2">
                            {device.status !== "ACTIVE" && (
                              <IconButton
                                onClick={() => setConfirmActivate(device)}
                                title={`Activate ${device.deviceId}`}
                                aria-label={`Activate ${device.deviceId}`}
                              >
                                <Power className="h-4 w-4" />
                              </IconButton>
                            )}
                            {device.status === "ACTIVE" && (
                              <IconButton
                                onClick={() => setConfirmDeactivate(device)}
                                title={`Deactivate ${device.deviceId}`}
                                aria-label={`Deactivate ${device.deviceId}`}
                              >
                                <PowerOff className="h-4 w-4" />
                              </IconButton>
                            )}
                            <IconButton
                              variant="danger"
                              onClick={() => setConfirmDelete(device)}
                              title={`Delete ${device.deviceId}`}
                              aria-label={`Delete ${device.deviceId}`}
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
              setFormError(null);
            }}
            title="Register device"
          >
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {formError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
                  {formError}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FormLabel htmlFor="register-branch" className="mb-1">
                    Branch
                  </FormLabel>
                  <SearchableSelect
                    id="register-branch"
                    options={branchRegisterOptions}
                    value={formBranchId}
                    onChange={setFormBranchId}
                    placeholder="Search branch…"
                    className="w-full"
                    controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                  />
                  {branches.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Create a branch for this org first.
                    </p>
                  )}
                </div>
                <div>
                  <FormLabel htmlFor="register-device-id" className="mb-1">
                    Device ID
                  </FormLabel>
                  <input
                    id="register-device-id"
                    type="text"
                    value={formDeviceId}
                    onChange={(e) => setFormDeviceId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    placeholder="e.g. device-001"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <FormLabel htmlFor="register-fingerprint" className="mb-1">
                  Device fingerprint
                </FormLabel>
                <input
                  id="register-fingerprint"
                  type="text"
                  value={formFingerprint}
                  onChange={(e) => setFormFingerprint(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="Leave empty if not used"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-4">
                <Button type="button" variant="secondary" size="md" className="w-full" onClick={() => setSlideOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="md" className="w-full" disabled={submitLoading}>
                  {submitLoading ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </SlideOver>

          <ConfirmDialog
            open={Boolean(confirmActivate)}
            onClose={() => setConfirmActivate(null)}
            onConfirm={handleActivateConfirm}
            title="Activate device?"
            message={
              confirmActivate ? (
                <>
                  <strong>{confirmActivate.deviceId}</strong> will be activated and can be bound to a terminal.
                </>
              ) : (
                ""
              )
            }
            confirmLabel="Activate"
            variant="primary"
            loading={activateLoading}
          />

          <ConfirmDialog
            open={Boolean(confirmDeactivate)}
            onClose={() => setConfirmDeactivate(null)}
            onConfirm={handleDeactivateConfirm}
            title="Deactivate device?"
            message={
              confirmDeactivate ? (
                <>
                  <strong>{confirmDeactivate.deviceId}</strong> will be deactivated. Unbind from terminal first if needed.
                </>
              ) : (
                ""
              )
            }
            confirmLabel="Deactivate"
            variant="danger"
            loading={deactivateLoading}
          />

          <ConfirmDialog
            open={Boolean(confirmDelete)}
            onClose={() => setConfirmDelete(null)}
            onConfirm={handleDeleteConfirm}
            title="Delete device?"
            message={
              confirmDelete ? (
                <>
                  <strong>{confirmDelete.deviceId}</strong> will be marked as deleted. It will disappear
                  from lists but remain in the system for audit purposes.
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
