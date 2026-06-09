import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs, createOrg, updateOrg, deleteOrg } from "@/api/orgs";
import type { Org } from "@/types/org";
import {
  Badge,
  Button,
  IconButton,
  SlideOver,
  ConfirmDialog,
  Pagination,
  PageLoadingShell,
  SortableTableHead,
  TableSearchInput,
  FormLabel,
} from "@/components/ui";
import { useQueryDisplay } from "@/hooks/useQueryDisplay";
import { useServerPaginatedTableSearch } from "@/hooks/useServerPaginatedTableSearch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Plus, Pencil, Ban, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const ORG_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "INACTIVE", label: "INACTIVE" },
];

const ORG_SORT = {
  name: (row: Org) => row.name,
  status: (row: Org) => row.status,
};

export function OrgsListPage() {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Org | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Org | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Org | null>(null);
  const [formName, setFormName] = useState("");
  const [formStatus, setFormStatus] = useState("ACTIVE");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const orgsQuery = useQuery({
    queryKey: ["admin-orgs", token, page, size],
    queryFn: () => fetchOrgs(token, { page, size }),
    enabled: Boolean(token),
  });
  const { data, isError, error, refetch } = orgsQuery;
  const { isInitialLoad, isRefreshing } = useQueryDisplay(orgsQuery);

  const createMutation = useMutation({
    mutationFn: (name: string) => createOrg(token, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      queryClient.invalidateQueries({ queryKey: ["orgs-header"] });
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
      queryClient.invalidateQueries({ queryKey: ["orgs-analytics-filter"] });
      setSlideOpen(false);
      setEditingOrg(null);
      setFormName("");
      setFormError(null);
      toast.success("Organization created.", { title: "Created" });
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
    mutationFn: ({ orgId, name, status }: { orgId: string; name: string; status: string }) =>
      updateOrg(token, orgId, { name, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      queryClient.invalidateQueries({ queryKey: ["orgs-header"] });
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
      queryClient.invalidateQueries({ queryKey: ["orgs-analytics-filter"] });
      setSlideOpen(false);
      setEditingOrg(null);
      setFormName("");
      setFormError(null);
      toast.success("Organization updated.", { title: "Saved" });
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
    mutationFn: (org: Org) =>
      updateOrg(token, org.id, { name: org.name, status: "INACTIVE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      queryClient.invalidateQueries({ queryKey: ["orgs-header"] });
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
      queryClient.invalidateQueries({ queryKey: ["orgs-analytics-filter"] });
      setConfirmDeactivate(null);
      setDeactivateLoading(false);
      toast.success("Organization deactivated.", { title: "Deactivated" });
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
    mutationFn: (orgId: string) => deleteOrg(token, orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      queryClient.invalidateQueries({ queryKey: ["orgs-header"] });
      queryClient.invalidateQueries({ queryKey: ["orgs"] });
      queryClient.invalidateQueries({ queryKey: ["orgs-analytics-filter"] });
      setConfirmDelete(null);
      setDeleteLoading(false);
      toast.success("Organization deleted.", { title: "Deleted" });
    },
    onError: (err) => {
      setDeleteLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const orgs = data?.content ?? [];
  const {
    searchQuery,
    setSearchQuery,
    filteredRows: filteredOrgs,
    totalElements,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useServerPaginatedTableSearch({
    pageRows: orgs,
    serverTotalElements: data?.totalElements ?? 0,
    page,
    size,
    setPage,
    searchAllQueryKey: ["admin-orgs", token],
    searchAllQueryFn: (fetchSize) => fetchOrgs(token, { page: 0, size: fetchSize }),
    searchAllEnabled: Boolean(token),
    sortAccessors: ORG_SORT,
  });

  const openCreate = () => {
    setEditingOrg(null);
    setFormName("");
    setFormStatus("ACTIVE");
    setFormError(null);
    setSlideOpen(true);
  };

  const openEdit = (org: Org) => {
    setEditingOrg(org);
    setFormName(org.name);
    setFormStatus(org.status);
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
    setSubmitLoading(true);
    if (editingOrg) {
      updateMutation.mutate(
        { orgId: editingOrg.id, name: trimmed, status: formStatus },
        { onSettled: () => setSubmitLoading(false) }
      );
    } else {
      createMutation.mutate(trimmed, { onSettled: () => setSubmitLoading(false) });
    }
  };

  const handleDeactivateConfirm = () => {
    if (!confirmDeactivate) return;
    setDeactivateLoading(true);
    deactivateMutation.mutate(confirmDeactivate);
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

  const orgTableHead = (
    <tr>
      <SortableTableHead
        columnKey="name"
        label="Name"
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={toggleSort}
        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
      />
      <SortableTableHead
        columnKey="status"
        label="Status"
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={toggleSort}
        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
      />
      <SortableTableHead
        columnKey="actions"
        label="Actions"
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={toggleSort}
        sortable={false}
        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
      />
    </tr>
  );

  return (
    <>
      <PageLoadingShell
        title="Organizations"
        subtitle={
          isInitialLoad
            ? undefined
            : `${totalElements} organization(s). Select an org to manage branches and catalog.`
        }
        fallbackTo="/admin"
        loading={isInitialLoad}
        error={isError ? error : undefined}
        columns={3}
        tableHead={orgTableHead}
        headerActions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add organization
          </Button>
        }
        toolbar={
          <>
            <TableSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search organizations…"
              className="mb-4"
            />
            {totalElements > 0 && (
              <Pagination
                position="top"
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
          </>
        }
      >
        {!isInitialLoad && (
          <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="min-h-0 flex-1 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-700">{orgTableHead}</thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredOrgs.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    {orgs.length === 0 ? "No organizations yet. Add one to get started." : "No results match your search."}
                  </td>
                </tr>
              ) : (
                filteredOrgs.map((org: Org) => (
                  <tr
                    key={org.id}
                    className="group hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                      {org.name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={org.status}>{org.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <div className="flex justify-start gap-2">
                        <IconButton
                          onClick={() => openEdit(org)}
                          title={`Edit ${org.name}`}
                          aria-label={`Edit ${org.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        {org.status === "ACTIVE" && (
                          <IconButton
                            onClick={() => setConfirmDeactivate(org)}
                            title={`Deactivate ${org.name}`}
                            aria-label={`Deactivate ${org.name}`}
                          >
                            <Ban className="h-4 w-4" />
                          </IconButton>
                        )}
                        {(org.status === "ACTIVE" || org.status === "INACTIVE") && (
                          <IconButton
                            variant="danger"
                            onClick={() => setConfirmDelete(org)}
                            title={`Delete ${org.name}`}
                            aria-label={`Delete ${org.name}`}
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
      </div>
          </>
        )}
      </PageLoadingShell>

      <SlideOver
        open={slideOpen}
        onClose={() => {
          setSlideOpen(false);
          setEditingOrg(null);
          setFormError(null);
        }}
        title={editingOrg ? "Edit organization" : "Add organization"}
      >
        <form onSubmit={handleSlideSubmit} className="space-y-4">
          {formError && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
              {formError}
            </p>
          )}
          <div>
            <FormLabel htmlFor="org-name" className="mb-1">
              Name
            </FormLabel>
            <input
              id="org-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              placeholder="Organization name"
              autoFocus
            />
          </div>
          {editingOrg && (
            <div>
              <FormLabel htmlFor="org-status" className="mb-1">
                Status
              </FormLabel>
              <SearchableSelect
                id="org-status"
                options={ORG_STATUS_OPTIONS}
                value={formStatus}
                onChange={setFormStatus}
                placeholder="Search status…"
                className="w-full"
                controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" size="md" onClick={() => setSlideOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="md" disabled={submitLoading}>
              {submitLoading ? "Saving…" : editingOrg ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </SlideOver>

      <ConfirmDialog
        open={Boolean(confirmDeactivate)}
        onClose={() => setConfirmDeactivate(null)}
        onConfirm={handleDeactivateConfirm}
        title="Deactivate organization?"
        message={
          confirmDeactivate ? (
            <>
              <strong>{confirmDeactivate.name}</strong> will be set to INACTIVE. You can edit it
              later to set it back to ACTIVE.
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
        title="Delete organization?"
        message={
          confirmDelete ? (
            <>
              <strong>{confirmDelete.name}</strong> will be marked as deleted. It will disappear from
              lists but remain in the system for audit purposes.
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
  );
}
