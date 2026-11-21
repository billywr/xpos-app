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
  tableStickyHeadCell,
  tableHeadCell,
  tableBodyCell,
  tableStickyFirstBody,
  tableEmptyCell,
} from "@/components/ui";
import { useQueryDisplay } from "@/hooks/useQueryDisplay";
import { useServerPaginatedTableSearch } from "@/hooks/useServerPaginatedTableSearch";
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

const BRANCH_SORT = {
  name: (row: Branch) => row.name,
  timezone: (row: Branch) => row.timezone,
  currency: (row: Branch) => row.currency,
  status: (row: Branch) => row.status,
};

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

  const isBranchFormValid = Boolean(formName.trim() && formBusinessId.trim());

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const branchesQuery = useQuery({
    queryKey: ["admin-branches", token, selectedOrgId, page, size],
    queryFn: () => fetchBranches(token, selectedOrgId, { page, size }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });
  const { data: branchesData, isError, error, refetch } = branchesQuery;
  const { isInitialLoad, isRefreshing } = useQueryDisplay(branchesQuery);

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
  const {
    searchQuery,
    setSearchQuery,
    filteredRows: filteredBranches,
    totalElements,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useServerPaginatedTableSearch({
    pageRows: branches,
    serverTotalElements: branchesData?.totalElements ?? 0,
    page,
    size,
    setPage,
    searchAllQueryKey: ["admin-branches", token, selectedOrgId],
    searchAllQueryFn: (fetchSize) =>
      fetchBranches(token, selectedOrgId, { page: 0, size: fetchSize }),
    searchAllEnabled: Boolean(token) && Boolean(selectedOrgId),
    sortAccessors: BRANCH_SORT,
  });
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

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        title="Branches"
        subtitle="Per-org branches. Select an organization to list and manage branches."
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          {orgs.length > 1 && (
            <div className="flex flex-col gap-1">
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
                className="w-full sm:w-56"
                controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
              />
            </div>
          )}
          {selectedOrgId && (
            <TableSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search branches…"
              className="w-full sm:w-64"
            />
          )}
        </div>
        {selectedOrgId && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add branch
          </Button>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view and manage branches.
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
          <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">← swipe table to see all columns →</p>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="relative min-h-0 flex-1 overflow-auto">
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "550px" }}>
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <TableRowNumberHead />
                    <SortableTableHead
                      columnKey="name"
                      label="Name"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={`${tableStickyHeadCell} ${tableHeadCell}`}
                    />
                    <SortableTableHead
                      columnKey="timezone"
                      label="TZ"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    <SortableTableHead
                      columnKey="currency"
                      label="Cur"
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
                  ) : filteredBranches.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className={tableEmptyCell}
                      >
                        {branches.length === 0 ? `No branches yet for ${selectedOrg?.name}. Add one to get started.` : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredBranches.map((branch: Branch, index) => (
                      <tr
                        key={branch.id}
                        className={tableBodyRow}
                      >
                    <TableRowNumberCell page={page} pageSize={size} indexInPage={index} />
                        <td className={tableStickyFirstBody}>
                          {branch.name}
                        </td>
                        <td className={tableBodyCell}>
                          {branch.timezone}
                        </td>
                        <td className={tableBodyCell}>
                          {branch.currency}
                        </td>
                        <td className={tableBodyCell}>
                          <Badge status={branch.status}>{branch.status}</Badge>
                        </td>
                        <td className={tableBodyCell}>
                          <div className="flex justify-start gap-2">
                            <IconButton
                              onClick={() => openEdit(branch)}
                              title={`Edit ${branch.name}`}
                              aria-label={`Edit ${branch.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                            {branch.status === "ACTIVE" && (
                              <IconButton
                                onClick={() => setConfirmDeactivate(branch)}
                                title={`Deactivate ${branch.name}`}
                                aria-label={`Deactivate ${branch.name}`}
                              >
                                <Ban className="h-4 w-4" />
                              </IconButton>
                            )}
                            {(branch.status === "ACTIVE" || branch.status === "INACTIVE") && (
                              <IconButton
                                variant="danger"
                                onClick={() => setConfirmDelete(branch)}
                                title={`Delete ${branch.name}`}
                                aria-label={`Delete ${branch.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </IconButton>
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
                onRefresh={() => void refetch()}
                isRefreshing={isRefreshing}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FormLabel htmlFor="branch-name" className="mb-1">
                    Name
                  </FormLabel>
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
                  <FormLabel htmlFor="branch-business" className="mb-1">
                    Business
                  </FormLabel>
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
                  <FormLabel htmlFor="branch-timezone" className="mb-1">
                    Timezone
                  </FormLabel>
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
                  <FormLabel htmlFor="branch-currency" className="mb-1">
                    Currency
                  </FormLabel>
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
                  <div className="col-span-1 sm:col-span-2">
                    <FormLabel htmlFor="branch-status" className="mb-1">
                      Status
                    </FormLabel>
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
              </div>
              <div className="grid grid-cols-2 gap-3 pt-4">
                <Button type="submit" size="md" className="w-full" disabled={submitLoading || !isBranchFormValid}>
                  {submitLoading ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="secondary" size="md" className="w-full" onClick={() => setSlideOpen(false)}>
                  Cancel
                </Button>
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
