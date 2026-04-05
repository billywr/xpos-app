import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBusinesses } from "@/api/businesses";
import {
  fetchBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} from "@/api/branches";
import type { Org } from "@/types/org";
import { filterActiveOrgs } from "@/types/org";
import type { Branch } from "@/types/org";
import { PageHeader } from "@/components/PageHeader";
import { SlideOver, ConfirmDialog, Pagination, TableSearchInput } from "@/components/ui";
import { useTableSearch } from "@/hooks/useTableSearch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Plus, Pencil, Ban, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const DEFAULT_TIMEZONE = "Africa/Nairobi";
const DEFAULT_CURRENCY = "KES";

export interface BranchesListPageProps {
  initialOrgId?: string;
}

export function BranchesListPage({ initialOrgId }: BranchesListPageProps = {}) {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId ?? "");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Branch | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Branch | null>(null);
  const [formName, setFormName] = useState("");
  const [formBusinessId, setFormBusinessId] = useState("");
  const [formTimezone, setFormTimezone] = useState(DEFAULT_TIMEZONE);
  const [formCurrency, setFormCurrency] = useState(DEFAULT_CURRENCY);
  const [formStatus, setFormStatus] = useState("ACTIVE");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: branchesData, isLoading, isError, error } = useQuery({
    queryKey: ["admin-branches", token, selectedOrgId, page, size],
    queryFn: () => fetchBranches(token, selectedOrgId, { page, size }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const { data: businessesData } = useQuery({
    queryKey: ["admin-businesses", token, selectedOrgId],
    queryFn: () => fetchBusinesses(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && slideOpen,
  });

  const createMutation = useMutation({
    mutationFn: (body: {
      businessId: string;
      name: string;
      timezone: string;
      currency: string;
    }) => createBranch(token, selectedOrgId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-branches", token, selectedOrgId],
      });
      setSlideOpen(false);
      setEditingBranch(null);
      resetForm();
      toast.success("Branch created.", { title: "Created" });
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
      branchId: string;
      name: string;
      businessId: string;
      timezone: string;
      currency: string;
      status: string;
    }) =>
      updateBranch(token, selectedOrgId, body.branchId, {
        name: body.name,
        businessId: body.businessId,
        timezone: body.timezone,
        currency: body.currency,
        status: body.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-branches", token, selectedOrgId],
      });
      setSlideOpen(false);
      setEditingBranch(null);
      resetForm();
      toast.success("Branch updated.", { title: "Saved" });
    },
    onError: (err) => {
      setSubmitLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (branchId: string) =>
      updateBranch(token, selectedOrgId, branchId, { status: "INACTIVE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-branches", token, selectedOrgId],
      });
      setConfirmDeactivate(null);
      setDeactivateLoading(false);
      toast.success("Branch deactivated.", { title: "Deactivated" });
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
    mutationFn: (branchId: string) =>
      deleteBranch(token, selectedOrgId, branchId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-branches", token, selectedOrgId],
      });
      setConfirmDelete(null);
      setDeleteLoading(false);
      toast.success("Branch deleted.", { title: "Deleted" });
    },
    onError: (err) => {
      setDeleteLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  function resetForm() {
    setFormName("");
    setFormBusinessId("");
    setFormTimezone(DEFAULT_TIMEZONE);
    setFormCurrency(DEFAULT_CURRENCY);
    setFormStatus("ACTIVE");
    setFormError(null);
  }

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const branches = branchesData?.content ?? [];
  const totalElements = branchesData?.totalElements ?? 0;
  const { searchQuery, setSearchQuery, filteredRows: filteredBranches } = useTableSearch(branches);
  const businesses = businessesData?.content ?? [];

  const openCreate = () => {
    setEditingBranch(null);
    setFormName("");
    setFormBusinessId(businesses[0]?.id ?? "");
    setFormTimezone(DEFAULT_TIMEZONE);
    setFormCurrency(DEFAULT_CURRENCY);
    setFormStatus("ACTIVE");
    setFormError(null);
    setSlideOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormName(branch.name);
    setFormBusinessId(branch.businessId);
    setFormTimezone(branch.timezone);
    setFormCurrency(branch.currency);
    setFormStatus(branch.status);
    setFormError(null);
    setSlideOpen(true);
  };

  const handleSlideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = formName.trim();
    if (!trimmed) {
      setFormError("Name is required.");
      return;
    }
    if (!formBusinessId) {
      setFormError("Business is required.");
      return;
    }
    setSubmitLoading(true);
    if (editingBranch) {
      updateMutation.mutate(
        {
          branchId: editingBranch.id,
          name: trimmed,
          businessId: formBusinessId,
          timezone: formTimezone.trim() || DEFAULT_TIMEZONE,
          currency: formCurrency.trim() || DEFAULT_CURRENCY,
          status: formStatus,
        },
        { onSettled: () => setSubmitLoading(false) }
      );
    } else {
      createMutation.mutate(
        {
          businessId: formBusinessId,
          name: trimmed,
          timezone: formTimezone.trim() || DEFAULT_TIMEZONE,
          currency: formCurrency.trim() || DEFAULT_CURRENCY,
        },
        { onSettled: () => setSubmitLoading(false) }
      );
    }
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

  const selectedOrg = orgs.find((o: Org) => o.id === selectedOrgId);

  useEffect(() => {
    if (initialOrgId) {
      setSelectedOrgId(initialOrgId);
    } else if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [initialOrgId, orgs, selectedOrgId]);

  useEffect(() => {
    if (slideOpen && !editingBranch && businesses.length > 0 && !formBusinessId) {
      setFormBusinessId(businesses[0].id);
    }
  }, [slideOpen, editingBranch, businesses, formBusinessId]);

  const orgSelectOptions = useMemo(
    () => [
      { value: "", label: "Select organization…" },
      ...orgs.map((org: Org) => ({ value: org.id, label: org.name })),
    ],
    [orgs]
  );

  const businessSelectOptions = useMemo(
    () => [
      { value: "", label: "Select business…" },
      ...businesses.map((b) => ({ value: b.id, label: b.legalName })),
    ],
    [businesses]
  );

  const branchStatusOptions = useMemo(
    () => [
      { value: "ACTIVE", label: "ACTIVE" },
      { value: "INACTIVE", label: "INACTIVE" },
    ],
    []
  );

  if (isLoading && selectedOrgId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Branches"
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
          title="Branches"
          fallbackTo="/admin"
        />
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <p>{message}</p>
          {requestId && (
            <p className="mt-2 text-sm opacity-90">
              Reference: <code className="rounded bg-red-100 px-1 dark:bg-red-900/50">{requestId}</code>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        title="Branches"
        subtitle="Per-org branches. Select an organization to list and manage branches."
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label
          htmlFor="branch-org-select"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Organization
        </label>
        <SearchableSelect
          id="branch-org-select"
          options={orgSelectOptions}
          value={selectedOrgId}
          onChange={(next) => {
            setSelectedOrgId(next);
            setPage(0);
          }}
          placeholder="Search organization…"
          className="min-w-[12rem]"
          controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
        />
        {selectedOrgId && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-primary-500 dark:hover:bg-primary-600 dark:focus:ring-offset-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add branch
          </button>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view and manage branches.
        </div>
      ) : (
        <>
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search branches…" className="mb-4" />

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Timezone
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Currency
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
                  {filteredBranches.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        {branches.length === 0 ? `No branches yet for ${selectedOrg?.name}. Add one to get started.` : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredBranches.map((branch: Branch) => (
                      <tr
                        key={branch.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                          {branch.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {branch.timezone}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {branch.currency}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex justify-start rounded-full px-2 py-0.5 text-left text-xs font-medium ${
                              branch.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {branch.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-left">
                          <div className="flex justify-start gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(branch)}
                              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                              title={`Edit ${branch.name}`}
                              aria-label={`Edit ${branch.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {branch.status === "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeactivate(branch)}
                                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                                title={`Deactivate ${branch.name}`}
                                aria-label={`Deactivate ${branch.name}`}
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            )}
                            {(branch.status === "ACTIVE" || branch.status === "INACTIVE") && (
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(branch)}
                                className="rounded-lg p-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                                title={`Delete ${branch.name}`}
                                aria-label={`Delete ${branch.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
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
              setEditingBranch(null);
              setFormError(null);
            }}
            title={editingBranch ? "Edit branch" : "Add branch"}
          >
            <form onSubmit={handleSlideSubmit} className="space-y-4">
              {formError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
                  {formError}
                </p>
              )}
              <div>
                <label
                  htmlFor="branch-name"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Name
                </label>
                <input
                  id="branch-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g. Main"
                  autoFocus
                />
              </div>
              <div>
                <label
                  htmlFor="branch-business"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Business
                </label>
                <SearchableSelect
                  id="branch-business"
                  options={businessSelectOptions}
                  value={formBusinessId}
                  onChange={setFormBusinessId}
                  placeholder="Search business…"
                  className="w-full"
                  controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                />
                {businesses.length === 0 && !editingBranch && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    No businesses yet.{" "}
                    <Link
                      to="/admin/businesses"
                      className="font-medium underline hover:no-underline"
                    >
                      Add one in Businesses
                    </Link>{" "}
                    first.
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="branch-timezone"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Timezone
                </label>
                <input
                  id="branch-timezone"
                  type="text"
                  value={formTimezone}
                  onChange={(e) => setFormTimezone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="Africa/Nairobi"
                />
              </div>
              <div>
                <label
                  htmlFor="branch-currency"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Currency
                </label>
                <input
                  id="branch-currency"
                  type="text"
                  value={formCurrency}
                  onChange={(e) => setFormCurrency(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="KES"
                />
              </div>
              {editingBranch && (
                <div>
                  <label
                    htmlFor="branch-status"
                    className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Status
                  </label>
                  <SearchableSelect
                    id="branch-status"
                    options={branchStatusOptions}
                    value={formStatus}
                    onChange={setFormStatus}
                    placeholder="Search status…"
                    className="w-full"
                    controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                  />
                </div>
              )}
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
                    : editingBranch
                      ? "Save"
                      : "Create"}
                </button>
              </div>
            </form>
          </SlideOver>

          <ConfirmDialog
            open={Boolean(confirmDeactivate)}
            onClose={() => setConfirmDeactivate(null)}
            onConfirm={handleDeactivateConfirm}
            title="Deactivate branch?"
            message={
              confirmDeactivate ? (
                <>
                  <strong>{confirmDeactivate.name}</strong> will be set to
                  INACTIVE. You can edit it later to set it back to ACTIVE.
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
            title="Delete branch?"
            message={
              confirmDelete ? (
                <>
                  <strong>{confirmDelete.name}</strong> will be marked as deleted. It will disappear
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
