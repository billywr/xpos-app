import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import {
  fetchTenderTypes,
  createTenderType,
  updateTenderType,
  deleteTenderType,
} from "@/api/tenderTypes";
import type { Org } from "@/types/org";
import { filterActiveOrgs } from "@/types/org";
import type { TenderType } from "@/types/sales";
import { PageHeader } from "@/components/PageHeader";
import {
  Badge,
  Button,
  IconButton,
  SlideOver,
  ConfirmDialog,
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
  tableEmptyCell,
  tableStickyFirstBody,
} from "@/components/ui";
import { useQueryDisplay } from "@/hooks/useQueryDisplay";
import { useDataTable } from "@/hooks/useDataTable";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

export function TenderTypesListPage() {
  const TENDER_TYPE_SORT = {
    code: (row: TenderType) => row.code,
    name: (row: TenderType) => row.name,
    active: (row: TenderType) => (row.active ? 1 : 0),
  };
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingTenderType, setEditingTenderType] = useState<TenderType | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TenderType | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const tenderTypesQuery = useQuery({
    queryKey: ["admin-tender-types", token, selectedOrgId],
    queryFn: () =>
      fetchTenderTypes(token, selectedOrgId, { includeInactive: true }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });
  const { data: tenderTypesData, isError, error, refetch } = tenderTypesQuery;
  const { isInitialLoad, isRefreshing } = useQueryDisplay(tenderTypesQuery);

  const createMutation = useMutation({
    mutationFn: (body: { code: string; name: string }) =>
      createTenderType(token, selectedOrgId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-tender-types", token, selectedOrgId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tenderTypes", selectedOrgId],
      });
      setSlideOpen(false);
      setEditingTenderType(null);
      resetForm();
      toast.success("Tender type created.", { title: "Created" });
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
      tenderTypeId: string;
      code: string;
      name: string;
      active: boolean;
    }) =>
      updateTenderType(token, selectedOrgId, body.tenderTypeId, {
        code: body.code,
        name: body.name,
        active: body.active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-tender-types", token, selectedOrgId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tenderTypes", selectedOrgId],
      });
      setSlideOpen(false);
      setEditingTenderType(null);
      resetForm();
      toast.success("Tender type updated.", { title: "Saved" });
    },
    onError: (err) => {
      setSubmitLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tenderTypeId: string) =>
      deleteTenderType(token, selectedOrgId, tenderTypeId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-tender-types", token, selectedOrgId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tenderTypes", selectedOrgId],
      });
      setConfirmDelete(null);
      setDeleteLoading(false);
      toast.success("Tender type deleted.", { title: "Deleted" });
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
  const tenderTypes = tenderTypesData ?? [];
  const {
    searchQuery,
    setSearchQuery,
    filteredRows: filteredTenderTypes,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useDataTable(tenderTypes, undefined, {
    sortAccessors: TENDER_TYPE_SORT,
  });

  useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  const orgSelectOptions = useMemo(
    () => [
      { value: "", label: "Select organization…" },
      ...orgs.map((o: Org) => ({ value: o.id, label: o.name })),
    ],
    [orgs]
  );

  const tenderActiveOptions = useMemo(
    () => [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
    []
  );

  function resetForm() {
    setFormCode("");
    setFormName("");
    setFormActive(true);
    setFormError(null);
  }

  const openCreate = () => {
    setEditingTenderType(null);
    resetForm();
    setSlideOpen(true);
  };

  const openEdit = (tt: TenderType) => {
    setEditingTenderType(tt);
    setFormCode(tt.code);
    setFormName(tt.name);
    setFormActive(tt.active);
    setFormError(null);
    setSlideOpen(true);
  };

  const handleSlideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const codeTrimmed = formCode.trim();
    const nameTrimmed = formName.trim();
    if (!codeTrimmed) {
      setFormError("Code is required.");
      return;
    }
    if (!nameTrimmed) {
      setFormError("Name is required.");
      return;
    }
    setSubmitLoading(true);
    if (editingTenderType) {
      updateMutation.mutate(
        {
          tenderTypeId: editingTenderType.id,
          code: codeTrimmed,
          name: nameTrimmed,
          active: formActive,
        },
        { onSettled: () => setSubmitLoading(false) }
      );
    } else {
      createMutation.mutate(
        { code: codeTrimmed, name: nameTrimmed },
        { onSettled: () => setSubmitLoading(false) }
      );
    }
  };

  const handleDeleteConfirm = () => {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    deleteMutation.mutate(confirmDelete.id);
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        title="Tender types"
        subtitle="Payment methods (Cash, M-Pesa, Card, etc.) for completing sales."
        icon={CreditCard}
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="tender-type-org-select"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Organization
          </label>
          <SearchableSelect
            id="tender-type-org-select"
            options={orgSelectOptions}
            value={selectedOrgId}
            onChange={setSelectedOrgId}
            placeholder="Search organization…"
            className="w-full sm:w-56"
            controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
          />
        </div>
        {selectedOrgId && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add tender type
          </Button>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view and manage tender types.
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
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search tender types…" className="mb-4" onRefresh={() => void refetch()} isRefreshing={isRefreshing} />

          <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">← swipe table to see all columns →</p>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="relative min-h-0 flex-1 overflow-auto">
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "480px" }}>
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <TableRowNumberHead />
                    <SortableTableHead
                      columnKey="code"
                      label="Code"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={`${tableStickyHeadCell} ${tableHeadCell}`}
                    />
                    <SortableTableHead
                      columnKey="name"
                      label="Name"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={tableHeadCell}
                    />
                    <SortableTableHead
                      columnKey="active"
                      label="Active"
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
                    <TableSkeleton columns={5} />
                  ) : filteredTenderTypes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className={tableEmptyCell}
                      >
                        {tenderTypes.length === 0 ? "No tender types yet. Add one (e.g. Cash, M-Pesa) for payment options." : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredTenderTypes.map((tt: TenderType, index) => (
                      <tr
                        key={tt.id}
                        className={tableBodyRow}
                      >
                    <TableRowNumberCell page={0} pageSize={filteredTenderTypes.length || 1} indexInPage={index} />
                        <td className={`${tableStickyFirstBody} font-mono`}>
                          {tt.code}
                        </td>
                        <td className={tableBodyCell}>
                          {tt.name}
                        </td>
                        <td className={tableBodyCell}>
                          <Badge variant={tt.active ? "success" : "neutral"}>
                            {tt.active ? "Yes" : "No"}
                          </Badge>
                        </td>
                        <td className={tableBodyCell}>
                          <div className="flex justify-start gap-2">
                            <IconButton
                              onClick={() => openEdit(tt)}
                              title={`Edit ${tt.name}`}
                              aria-label={`Edit ${tt.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              variant="danger"
                              onClick={() => setConfirmDelete(tt)}
                              title={`Delete ${tt.name}`}
                              aria-label={`Delete ${tt.name}`}
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
          </div>

          <SlideOver
            open={slideOpen}
            onClose={() => {
              setSlideOpen(false);
              setEditingTenderType(null);
              setFormError(null);
            }}
            title={editingTenderType ? "Edit tender type" : "Add tender type"}
            maxWidth="max-w-md"
          >
            <form onSubmit={handleSlideSubmit} className="space-y-4">
              {formError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
                  {formError}
                </p>
              )}
              <div>
                <FormLabel htmlFor="tender-type-code" className="mb-1">
                  Code
                </FormLabel>
                <input
                  id="tender-type-code"
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g. CASH, MPESA"
                  autoFocus
                />
              </div>
              <div>
                <FormLabel htmlFor="tender-type-name" className="mb-1">
                  Name
                </FormLabel>
                <input
                  id="tender-type-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g. Cash"
                />
              </div>
              {editingTenderType && (
                <div>
                  <FormLabel htmlFor="tender-type-active" className="mb-1">
                    Active
                  </FormLabel>
                  <SearchableSelect
                    id="tender-type-active"
                    options={tenderActiveOptions}
                    value={formActive ? "true" : "false"}
                    onChange={(v) => setFormActive(v === "true")}
                    placeholder="Search…"
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
                  {submitLoading
                    ? "Saving…"
                    : editingTenderType
                      ? "Save"
                      : "Create"}
                </Button>
              </div>
            </form>
          </SlideOver>

          <ConfirmDialog
            open={Boolean(confirmDelete)}
            onClose={() => setConfirmDelete(null)}
            onConfirm={handleDeleteConfirm}
            title="Delete tender type?"
            message={
              confirmDelete ? (
                <>
                  <strong>{confirmDelete.name}</strong> will be deactivated. It
                  will no longer appear as a payment option.
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
