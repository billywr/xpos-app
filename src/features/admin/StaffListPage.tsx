import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import {
  fetchStaffUsers,
  createStaffUser,
  fetchStaffProfile,
  upsertStaffProfile,
  fetchStaffBranchAssignments,
  assignStaffBranch,
  updateStaffUserStatus,
  deleteStaffUser,
} from "@/api/staffUsers";
import type { Org } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import type { Branch } from "@/types/org";
import type { StaffUser } from "@/types/staff";
import type { StaffBranchAssignment } from "@/types/staff";
import { PageHeader } from "@/components/PageHeader";
import { SlideOver, ConfirmDialog, Pagination, TableSearchInput } from "@/components/ui";
import { useTableSearch } from "@/hooks/useTableSearch";
import {
  getApiErrorMessage,
  getApiErrorRequestId,
  isApiFetchError,
} from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Plus, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface StaffListPageProps {
  initialOrgId?: string;
}

export function StaffListPage({ initialOrgId }: StaffListPageProps = {}) {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId ?? "");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [registerSlideOpen, setRegisterSlideOpen] = useState(false);
  const [profileSlideOpen, setProfileSlideOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [confirmActivate, setConfirmActivate] = useState<StaffUser | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<StaffUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StaffUser | null>(null);
  const [formUsername, setFormUsername] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formEmployeeNo, setFormEmployeeNo] = useState("");
  const [formDefaultBranchId, setFormDefaultBranchId] = useState("");
  const [formStatus, setFormStatus] = useState("ACTIVE");
  const [addBranchId, setAddBranchId] = useState("");
  const [addPrimary, setAddPrimary] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [activateLoading, setActivateLoading] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: staffData, isLoading, isError, error } = useQuery({
    queryKey: ["admin-staff", token, selectedOrgId, page, size],
    queryFn: () => fetchStaffUsers(token, selectedOrgId, { page, size }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const { data: branchesData } = useQuery({
    queryKey: ["admin-branches", token, selectedOrgId],
    queryFn: () => fetchBranches(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && (registerSlideOpen || profileSlideOpen),
  });

  const {
    data: profileData,
    isLoading: profileLoading,
    isError: profileErrorFlag,
    error: profileError,
  } = useQuery({
    queryKey: ["admin-staff-profile", token, selectedOrgId, editingStaff?.id],
    queryFn: () =>
      fetchStaffProfile(token, selectedOrgId, editingStaff!.id),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(editingStaff) &&
      profileSlideOpen,
    retry: (_, error) =>
      !(isApiFetchError(error) && error.status === 404),
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ["admin-staff-assignments", token, selectedOrgId, editingStaff?.id],
    queryFn: () =>
      fetchStaffBranchAssignments(token, selectedOrgId, editingStaff!.id),
    enabled:
      Boolean(token) &&
      Boolean(selectedOrgId) &&
      Boolean(editingStaff) &&
      profileSlideOpen,
  });

  const createMutation = useMutation({
    mutationFn: (body: { iamUserId: string; username: string }) =>
      createStaffUser(token, selectedOrgId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-staff", token, selectedOrgId],
      });
      setRegisterSlideOpen(false);
      setFormUsername("");
      setFormError(null);
      toast.success("Staff user added.", {
        title: "Added",
      });
    },
    onError: (err) => {
      setSubmitLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const profileMutation = useMutation({
    mutationFn: () =>
      upsertStaffProfile(token, selectedOrgId, editingStaff!.id, {
        displayName: formDisplayName.trim() || null,
        phone: formPhone.trim() || null,
        email: formEmail.trim() || null,
        employeeNo: formEmployeeNo.trim() || null,
        defaultBranchId: formDefaultBranchId || null,
        status: formStatus,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-staff-profile", token, selectedOrgId, editingStaff?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-staff", token, selectedOrgId],
      });
      setSubmitLoading(false);
      toast.success("Profile saved.", { title: "Saved" });
    },
    onError: (err) => {
      setSubmitLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (branchId: string) =>
      assignStaffBranch(token, selectedOrgId, editingStaff!.id, branchId, addPrimary),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-staff-assignments", token, selectedOrgId, editingStaff?.id],
      });
      setAddBranchId("");
      setAddPrimary(false);
      setAssignLoading(false);
      toast.success("Branch assigned.", { title: "Assigned" });
    },
    onError: (err) => {
      setAssignLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (staffUserId: string) =>
      updateStaffUserStatus(token, selectedOrgId, staffUserId, "ACTIVE"),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-staff", token, selectedOrgId],
      });
      setConfirmActivate(null);
      setActivateLoading(false);
      toast.success("Staff activated.", { title: "Activated" });
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
    mutationFn: (staffUserId: string) =>
      updateStaffUserStatus(token, selectedOrgId, staffUserId, "INACTIVE"),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-staff", token, selectedOrgId],
      });
      setConfirmDeactivate(null);
      setDeactivateLoading(false);
      toast.success("Staff deactivated.", { title: "Deactivated" });
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
    mutationFn: (staffUserId: string) =>
      deleteStaffUser(token, selectedOrgId, staffUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-staff", token, selectedOrgId],
      });
      setConfirmDelete(null);
      setDeleteLoading(false);
      toast.success("Staff deleted.", { title: "Deleted" });
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
  const staffUsers = staffData?.content ?? [];
  const totalElements = staffData?.totalElements ?? 0;
  const { searchQuery, setSearchQuery, filteredRows: filteredStaff } = useTableSearch(staffUsers);
  const branches = filterNonDeletedBranches(branchesData?.content ?? []);
  const profile = profileData;
  const assignments = assignmentsData ?? [];
  const profileMissing =
    profileErrorFlag &&
    isApiFetchError(profileError) &&
    profileError.status === 404;
  const showProfileForm = Boolean(editingStaff) && (Boolean(profile) || profileMissing);
  const profileLoadFailed =
    Boolean(editingStaff) &&
    profileErrorFlag &&
    !profileMissing &&
    isApiFetchError(profileError);

  useEffect(() => {
    if (initialOrgId) {
      setSelectedOrgId(initialOrgId);
    } else if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [initialOrgId, orgs, selectedOrgId]);

  useEffect(() => {
    if (profile) {
      setFormDisplayName(profile.displayName ?? "");
      setFormPhone(profile.phone ?? "");
      setFormEmail(profile.email ?? "");
      setFormEmployeeNo(profile.employeeNo ?? "");
      setFormDefaultBranchId(profile.defaultBranchId ?? "");
      setFormStatus(profile.status);
    }
  }, [profile]);

  useEffect(() => {
    if (profileMissing) {
      setFormDisplayName("");
      setFormPhone("");
      setFormEmail("");
      setFormEmployeeNo("");
      setFormDefaultBranchId("");
      setFormStatus("ACTIVE");
    }
  }, [profileMissing]);

  const openRegister = () => {
    setFormUsername("");
    setFormError(null);
    setRegisterSlideOpen(true);
  };

  const openProfile = (staff: StaffUser) => {
    setEditingStaff(staff);
    setProfileSlideOpen(true);
  };

  const closeProfile = () => {
    setProfileSlideOpen(false);
    setEditingStaff(null);
    setFormError(null);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = formUsername.trim();
    if (!trimmed) {
      setFormError("Username is required.");
      return;
    }
    setSubmitLoading(true);
    createMutation.mutate(
      { iamUserId: trimmed, username: trimmed },
      { onSettled: () => setSubmitLoading(false) },
    );
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setFormError(null);
    setSubmitLoading(true);
    profileMutation.mutate();
  };

  const handleAddAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !addBranchId) return;
    setAssignLoading(true);
    assignMutation.mutate(addBranchId, { onSettled: () => setAssignLoading(false) });
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

  const branchName = (branchId: string) =>
    branches.find((b: Branch) => b.id === branchId)?.name ?? branchId;
  const assignedBranchIds = new Set(assignments.map((a) => a.branchId));
  const availableBranches = branches.filter(
    (b: Branch) => !assignedBranchIds.has(b.id)
  );

  const orgSelectOptions = useMemo(
    () => [
      { value: "", label: "Select organization…" },
      ...orgs.map((o: Org) => ({ value: o.id, label: o.name })),
    ],
    [orgs]
  );

  const profileDefaultBranchOptions = useMemo(
    () => [
      { value: "", label: "None" },
      ...branches.map((b: Branch) => ({ value: b.id, label: b.name })),
    ],
    [branches]
  );

  const profileStatusOptions = useMemo(
    () => [
      { value: "ACTIVE", label: "ACTIVE" },
      { value: "INACTIVE", label: "INACTIVE" },
    ],
    []
  );

  const addBranchOptions = useMemo(
    () => [
      { value: "", label: "Select branch…" },
      ...availableBranches.map((b: Branch) => ({ value: b.id, label: b.name })),
    ],
    [availableBranches]
  );

  if (isLoading && selectedOrgId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Staff"
          subtitle="Loading…"
          fallbackTo="/admin"
        />
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
        <PageHeader
          title="Staff"
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
        title="Staff"
        subtitle="Staff users and branch assignments. Add users or manage profile and status."
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="staff-org-select"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Organization
          </label>
          <SearchableSelect
            id="staff-org-select"
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
        {selectedOrgId && (
          <button
            type="button"
            onClick={openRegister}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-primary-500 dark:hover:bg-primary-600 dark:focus:ring-offset-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add Staff
          </button>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view and manage staff.
        </div>
      ) : (
        <>
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search staff…" className="mb-4" />

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Username
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
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        {staffUsers.length === 0 ? "No staff users yet. Add a staff user to get started." : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((s: StaffUser) => (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                          {s.username}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex justify-start rounded-full px-2 py-0.5 text-left text-xs font-medium ${
                              s.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-left">
                          <div className="flex justify-start gap-2">
                            <button
                              type="button"
                              onClick={() => openProfile(s)}
                              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                              title={`Edit profile ${s.username}`}
                              aria-label={`Edit profile ${s.username}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {s.status !== "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() => setConfirmActivate(s)}
                                className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                                title={`Activate ${s.username}`}
                                aria-label={`Activate ${s.username}`}
                              >
                                <Power className="h-4 w-4" />
                              </button>
                            )}
                            {s.status === "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeactivate(s)}
                                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-600"
                                title={`Deactivate ${s.username}`}
                                aria-label={`Deactivate ${s.username}`}
                              >
                                <PowerOff className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(s)}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                              title={`Delete ${s.username}`}
                              aria-label={`Delete ${s.username}`}
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
            open={registerSlideOpen}
            onClose={() => {
              setRegisterSlideOpen(false);
              setFormError(null);
            }}
            title="Add Staff User"
          >
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {formError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
                  {formError}
                </p>
              )}
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Enter the Keycloak username of the user you want to add as staff for this organization.
              </p>
              <div>
                <label
                  htmlFor="staff-username"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Keycloak Username
                </label>
                <input
                  id="staff-username"
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g. cashier1"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setRegisterSlideOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600"
                >
                  {submitLoading ? "Adding…" : "Add Staff"}
                </button>
              </div>
            </form>
          </SlideOver>

          <SlideOver
            open={profileSlideOpen}
            onClose={closeProfile}
            title={editingStaff ? `Profile: ${editingStaff.username}` : "Profile"}
            maxWidth="max-w-xl"
          >
            {editingStaff && profileLoading && (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Loading profile…
              </div>
            )}
            {profileLoadFailed && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
                {getApiErrorMessage(profileError)}
                {getApiErrorRequestId(profileError) && (
                  <span className="mt-2 block text-xs">
                    Reference: {getApiErrorRequestId(profileError)}
                  </span>
                )}
              </div>
            )}
            {editingStaff && showProfileForm && (
              <div className="space-y-6">
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="profile-display-name"
                      className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Display name
                    </label>
                    <input
                      id="profile-display-name"
                      type="text"
                      value={formDisplayName}
                      onChange={(e) => setFormDisplayName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-phone"
                      className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Phone
                    </label>
                    <input
                      id="profile-phone"
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-email"
                      className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Email
                    </label>
                    <input
                      id="profile-email"
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-employee-no"
                      className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Employee number
                    </label>
                    <input
                      id="profile-employee-no"
                      type="text"
                      value={formEmployeeNo}
                      onChange={(e) => setFormEmployeeNo(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-default-branch"
                      className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Default branch
                    </label>
                    <SearchableSelect
                      id="profile-default-branch"
                      options={profileDefaultBranchOptions}
                      value={formDefaultBranchId}
                      onChange={setFormDefaultBranchId}
                      placeholder="Search branch…"
                      className="w-full"
                      controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-status"
                      className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                    >
                      Status
                    </label>
                    <SearchableSelect
                      id="profile-status"
                      options={profileStatusOptions}
                      value={formStatus}
                      onChange={setFormStatus}
                      placeholder="Search status…"
                      className="w-full"
                      controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={submitLoading}
                      className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600"
                    >
                      {submitLoading ? "Saving…" : "Save profile"}
                    </button>
                  </div>
                </form>

                <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
                  <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-white">
                    Branch assignments
                  </h3>
                  {assignments.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No branches assigned yet.
                    </p>
                  ) : (
                    <ul className="mb-4 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                      {assignments.map((a: StaffBranchAssignment) => (
                        <li key={a.id}>
                          {branchName(a.branchId)}
                          {a.primary && (
                            <span className="ml-2 rounded bg-primary-100 px-1.5 py-0.5 text-xs text-primary-800 dark:bg-primary-900/40 dark:text-primary-300">
                              Primary
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {availableBranches.length > 0 && (
                    <form
                      onSubmit={handleAddAssignment}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <label
                          htmlFor="add-branch"
                          className="sr-only"
                        >
                          Add branch
                        </label>
                        <SearchableSelect
                          id="add-branch"
                          options={addBranchOptions}
                          value={addBranchId}
                          onChange={setAddBranchId}
                          placeholder="Search branch…"
                          compact
                          className="w-full"
                          controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <input
                          type="checkbox"
                          checked={addPrimary}
                          onChange={(e) => setAddPrimary(e.target.checked)}
                          className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                        />
                        Primary
                      </label>
                      <button
                        type="submit"
                        disabled={!addBranchId || assignLoading}
                        className="rounded-lg bg-slate-600 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-500 dark:hover:bg-slate-600"
                      >
                        {assignLoading ? "Adding…" : "Add"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </SlideOver>

          <ConfirmDialog
            open={Boolean(confirmActivate)}
            onClose={() => setConfirmActivate(null)}
            onConfirm={handleActivateConfirm}
            title="Activate staff?"
            message={
              confirmActivate ? (
                <>
                  <strong>{confirmActivate.username}</strong> will be set to ACTIVE.
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
            title="Deactivate staff?"
            message={
              confirmDeactivate ? (
                <>
                  <strong>{confirmDeactivate.username}</strong> will be set to INACTIVE and cannot operate the till until reactivated.
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
            title="Delete staff?"
            message={
              confirmDelete ? (
                <>
                  <strong>{confirmDelete.username}</strong> will be marked as deleted. They will disappear
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
