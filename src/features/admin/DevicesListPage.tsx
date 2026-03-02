import { useState, useEffect } from "react";
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
import { SlideOver, ConfirmDialog, Pagination } from "@/components/ui";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Plus, Power, PowerOff, Trash2 } from "lucide-react";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export function DevicesListPage() {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
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

  const { data: devicesData, isLoading, isError, error } = useQuery({
    queryKey: ["admin-devices", token, selectedOrgId, page, size],
    queryFn: () => fetchDevices(token, selectedOrgId, { page, size }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

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
  const totalElements = devicesData?.totalElements ?? 0;

  useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  useEffect(() => {
    if (slideOpen && branches.length > 0 && !formBranchId) {
      setFormBranchId(branches[0].id);
    }
  }, [slideOpen, branches, formBranchId]);

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

  if (isLoading && selectedOrgId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 dark:text-white">
          Devices
        </h1>
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Loading…
        </div>
      </div>
    );
  }

  if (isError && selectedOrgId) {
    const message = getApiErrorMessage(error);
    const requestId = getApiErrorRequestId(error);
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 dark:text-white">
          Devices
        </h1>
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Devices
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Register and manage devices per organization. Bind devices to terminals from Terminals.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label
          htmlFor="device-org-select"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Organization
        </label>
        <select
          id="device-org-select"
          value={selectedOrgId}
          onChange={(e) => {
            setSelectedOrgId(e.target.value);
            setPage(0);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        >
          <option value="">Select organization…</option>
          {orgs.map((org: Org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        {selectedOrgId && (
          <button
            type="button"
            onClick={openRegister}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-primary-500 dark:hover:bg-primary-600 dark:focus:ring-offset-slate-800"
          >
            <Plus className="h-4 w-4" />
            Register device
          </button>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view and manage devices.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Device ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {devices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        No devices registered yet. Register a device to get started.
                      </td>
                    </tr>
                  ) : (
                    devices.map((device: DeviceRegistration) => (
                      <tr
                        key={device.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                          {device.deviceId}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              device.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {device.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {device.status !== "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() => setConfirmActivate(device)}
                                className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                                aria-label={`Activate ${device.deviceId}`}
                              >
                                <Power className="h-4 w-4" />
                              </button>
                            )}
                            {device.status === "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeactivate(device)}
                                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                                aria-label={`Deactivate ${device.deviceId}`}
                              >
                                <PowerOff className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(device)}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                              aria-label={`Delete ${device.deviceId}`}
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
              <div>
                <label
                  htmlFor="register-branch"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Branch
                </label>
                <select
                  id="register-branch"
                  value={formBranchId}
                  onChange={(e) => setFormBranchId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                >
                  <option value="">Select branch…</option>
                  {branches.map((b: Branch) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {branches.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Create a branch for this org first.
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="register-device-id"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Device ID
                </label>
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
              <div>
                <label
                  htmlFor="register-fingerprint"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Device fingerprint (optional)
                </label>
                <input
                  id="register-fingerprint"
                  type="text"
                  value={formFingerprint}
                  onChange={(e) => setFormFingerprint(e.target.value)}
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
                  {submitLoading ? "Registering…" : "Register"}
                </button>
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
