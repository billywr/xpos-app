import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchUoms, createUom, updateUom, deleteUom } from "@/api/uoms";
import type { Org } from "@/types/org";
import { filterActiveOrgs } from "@/types/org";
import type { Uom } from "@/types/catalog";
import { PageHeader } from "@/components/PageHeader";
import { SlideOver, Pagination, ConfirmDialog, TableSearchInput } from "@/components/ui";
import { useTableSearch } from "@/hooks/useTableSearch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Plus, Pencil, Ruler, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface UomsListPageProps {
  initialOrgId?: string;
  onOrgChange?: (orgId: string) => void;
}

export function UomsListPage({ initialOrgId, onOrgChange }: UomsListPageProps = {}) {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId ?? "");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingUom, setEditingUom] = useState<Uom | null>(null);
  const [formName, setFormName] = useState("");
  const [formSymbol, setFormSymbol] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Uom | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: uomsData, isLoading, isError, error } = useQuery({
    queryKey: ["admin-uoms", token, selectedOrgId, page, size],
    queryFn: () => fetchUoms(token, selectedOrgId, { page, size }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; symbol: string | null }) =>
      createUom(token, selectedOrgId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-uoms", token, selectedOrgId],
      });
      setSlideOpen(false);
      setEditingUom(null);
      resetForm();
      toast.success("Unit created.", { title: "Created" });
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
    mutationFn: (body: { uomId: string; name: string; symbol: string | null }) =>
      updateUom(token, selectedOrgId, body.uomId, {
        name: body.name,
        symbol: body.symbol,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-uoms", token, selectedOrgId],
      });
      setSlideOpen(false);
      setEditingUom(null);
      resetForm();
      toast.success("Unit updated.", { title: "Saved" });
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
    mutationFn: (uomId: string) => deleteUom(token, selectedOrgId, uomId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-uoms", token, selectedOrgId],
      });
      setConfirmDelete(null);
      setDeleteLoading(false);
      toast.success("Unit deleted.", { title: "Deleted" });
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
  const uoms = uomsData?.content ?? [];
  const { searchQuery, setSearchQuery, filteredRows: filteredUoms } = useTableSearch(uoms);
  const totalElements = uomsData?.totalElements ?? 0;

  useEffect(() => {
    if (initialOrgId) {
      setSelectedOrgId(initialOrgId);
    } else if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [initialOrgId, orgs, selectedOrgId]);

  const orgSelectOptions = useMemo(
    () => [
      { value: "", label: "Select organization…" },
      ...orgs.map((org: Org) => ({ value: org.id, label: org.name })),
    ],
    [orgs]
  );

  function resetForm() {
    setFormName("");
    setFormSymbol("");
    setFormError(null);
  }

  const openCreate = () => {
    setEditingUom(null);
    resetForm();
    setSlideOpen(true);
  };

  const openEdit = (uom: Uom) => {
    setEditingUom(uom);
    setFormName(uom.name);
    setFormSymbol(uom.symbol ?? "");
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
    const symbol = formSymbol.trim() || null;
    setSubmitLoading(true);
    if (editingUom) {
      updateMutation.mutate(
        { uomId: editingUom.id, name: trimmed, symbol },
        { onSettled: () => setSubmitLoading(false) }
      );
    } else {
      createMutation.mutate(
        { name: trimmed, symbol },
        { onSettled: () => setSubmitLoading(false) }
      );
    }
  };

  const handleSizeChange = (newSize: number) => {
    setSize(Math.min(newSize, MAX_PAGE_SIZE));
    setPage(0);
  };

  const handleDeleteConfirm = () => {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    deleteMutation.mutate(confirmDelete.id);
  };

  if (isLoading && selectedOrgId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Units (UOM)"
          subtitle="Loading…"
          icon={Ruler}
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
          title="Units (UOM)"
          icon={Ruler}
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
        title="Units (UOM)"
        subtitle="Unit of measure (e.g. Piece, Kg, Litre). Used when adding items in Catalog → Items."
        icon={Ruler}
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="uom-org-select"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Organization
          </label>
          <SearchableSelect
            id="uom-org-select"
            options={orgSelectOptions}
            value={selectedOrgId}
            onChange={(next) => {
              setSelectedOrgId(next);
              setPage(0);
              onOrgChange?.(next);
            }}
            placeholder="Search organization…"
            className="w-full sm:w-56"
            controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
          />
        </div>
        {selectedOrgId && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-primary-500 dark:hover:bg-primary-600 dark:focus:ring-offset-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add unit
          </button>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view and manage units of measure.
        </div>
      ) : (
        <>
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search units…" className="mb-4" />
          <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">← swipe table to see all columns →</p>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="relative overflow-auto">
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "360px" }}>
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-50 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:bg-slate-700/80 dark:text-slate-300">
                      Name
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Symbol
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredUoms.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-2 py-8 text-center text-xs text-slate-500 sm:px-3 sm:text-sm dark:text-slate-400"
                      >
                        {uoms.length === 0 ? "No units yet. Add one to use in Catalog → Items." : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredUoms.map((uom: Uom) => (
                      <tr
                        key={uom.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 sm:px-3 sm:py-2 sm:text-sm dark:bg-slate-800 dark:text-white">
                          {uom.name}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-600 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-300">
                          {uom.symbol ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-left sm:px-3 sm:py-2">
                          <div className="flex justify-start gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(uom)}
                              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                              title={`Edit ${uom.name}`}
                              aria-label={`Edit ${uom.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(uom)}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                              title={`Delete ${uom.name}`}
                              aria-label={`Delete ${uom.name}`}
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
              setEditingUom(null);
              setFormError(null);
            }}
            title={editingUom ? "Edit unit" : "Add unit"}
            maxWidth="max-w-md"
          >
            <form onSubmit={handleSlideSubmit} className="space-y-4">
              {formError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
                  {formError}
                </p>
              )}
              <div>
                <label
                  htmlFor="uom-name"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Name
                </label>
                <input
                  id="uom-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g. Piece"
                  autoFocus
                />
              </div>
              <div>
                <label
                  htmlFor="uom-symbol"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Symbol (optional)
                </label>
                <input
                  id="uom-symbol"
                  type="text"
                  value={formSymbol}
                  onChange={(e) => setFormSymbol(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g. pcs, kg, L"
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setSlideOpen(false);
                    setEditingUom(null);
                  }}
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
                    : editingUom
                      ? "Save"
                      : "Create"}
                </button>
              </div>
            </form>
          </SlideOver>

          <ConfirmDialog
            open={Boolean(confirmDelete)}
            onClose={() => setConfirmDelete(null)}
            onConfirm={handleDeleteConfirm}
            title="Delete unit?"
            message={
              confirmDelete ? (
                <>
                  <strong>{confirmDelete.name}</strong> will be permanently
                  removed. This fails if it is used by any items.
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
