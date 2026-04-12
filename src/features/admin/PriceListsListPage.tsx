import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import {
  fetchPriceLists,
  createPriceList,
  deletePriceList,
} from "@/api/priceLists";
import type { Org, Branch } from "@/types/org";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import type { PriceList } from "@/types/sales";
import { PageHeader } from "@/components/PageHeader";
import { SlideOver, Pagination, ConfirmDialog, TableSearchInput } from "@/components/ui";
import { useTableSearch } from "@/hooks/useTableSearch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface PriceListsListPageProps {
  initialOrgId?: string;
  onOrgChange?: (orgId: string) => void;
}

export function PriceListsListPage({ initialOrgId, onOrgChange }: PriceListsListPageProps = {}) {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const itemIdFromUrl = searchParams.get("itemId") ?? "";
  const orgIdFromUrl = searchParams.get("orgId") ?? "";
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId ?? "");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [slideOpen, setSlideOpen] = useState(false);
  const [formBranchId, setFormBranchId] = useState("");
  const [formChannel, setFormChannel] = useState("");
  const [formName, setFormName] = useState("");
  const [formPriority, setFormPriority] = useState(0);
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PriceList | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: priceListsData, isLoading, isError, error } = useQuery({
    queryKey: ["admin-price-lists", token, selectedOrgId, page, size],
    queryFn: () => fetchPriceLists(token, selectedOrgId, { page, size }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const { data: branchesData } = useQuery({
    queryKey: ["admin-branches", token, selectedOrgId],
    queryFn: () => fetchBranches(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && slideOpen,
  });

  const createMutation = useMutation({
    mutationFn: (body: {
      branchId: string | null;
      channel: string | null;
      name: string;
      priority: number;
      active: boolean;
    }) => createPriceList(token, selectedOrgId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-price-lists", token, selectedOrgId],
      });
      queryClient.invalidateQueries({
        queryKey: ["priceLists", selectedOrgId],
      });
      setSlideOpen(false);
      resetForm();
      toast.success("Price list created.", { title: "Created" });
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
    mutationFn: (priceListId: string) =>
      deletePriceList(token, selectedOrgId, priceListId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-price-lists", token, selectedOrgId],
      });
      queryClient.invalidateQueries({
        queryKey: ["priceLists", selectedOrgId],
      });
      setConfirmDelete(null);
      setDeleteLoading(false);
      toast.success("Price list deleted.", { title: "Deleted" });
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
  const priceLists = priceListsData?.content ?? [];
  const { searchQuery, setSearchQuery, filteredRows: filteredPriceLists } = useTableSearch(priceLists);
  const totalElements = priceListsData?.totalElements ?? 0;
  const branches = filterNonDeletedBranches(branchesData?.content ?? []);

  useEffect(() => {
    if (orgIdFromUrl && orgs.some((o) => o.id === orgIdFromUrl)) {
      setSelectedOrgId(orgIdFromUrl);
    } else if (initialOrgId) {
      setSelectedOrgId(initialOrgId);
    } else if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [initialOrgId, orgs, selectedOrgId, orgIdFromUrl]);

  const orgSelectOptions = useMemo(
    () => [
      { value: "", label: "Select organization…" },
      ...orgs.map((o: Org) => ({ value: o.id, label: o.name })),
    ],
    [orgs]
  );

  const priceListBranchOptions = useMemo(
    () => [
      { value: "", label: "None" },
      ...branches.map((b: Branch) => ({ value: b.id, label: b.name })),
    ],
    [branches]
  );

  const editHref = (listId: string) =>
    itemIdFromUrl
      ? `/admin/price-lists/${listId}?orgId=${selectedOrgId}&itemId=${itemIdFromUrl}`
      : `/admin/price-lists/${listId}?orgId=${selectedOrgId}`;

  function resetForm() {
    setFormBranchId("");
    setFormChannel("");
    setFormName("");
    setFormPriority(0);
    setFormActive(true);
    setFormError(null);
  }

  const openCreate = () => {
    resetForm();
    setSlideOpen(true);
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setFormError(null);
  };

  const handleListSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = formName.trim();
    if (!trimmed) {
      setFormError("Name is required.");
      return;
    }
    const payload = {
      branchId: formBranchId || null,
      channel: formChannel.trim() || null,
      name: trimmed,
      priority: formPriority,
      active: formActive,
    };
    setSubmitLoading(true);
    createMutation.mutate(payload, { onSettled: () => setSubmitLoading(false) });
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

  const branchName = (branchId: string | null) =>
    branchId
      ? branches.find((b: Branch) => b.id === branchId)?.name ?? branchId
      : "—";

  if (isLoading && selectedOrgId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Price lists"
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
          title="Price lists"
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
        title="Price lists"
        subtitle="Pricing by branch/channel. Add items and set prices per list."
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="price-list-org-select"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Organization
          </label>
          <SearchableSelect
            id="price-list-org-select"
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
            Add price list
          </button>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view and manage price lists.
        </div>
      ) : (
        <>
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search price lists…" className="mb-4" />
          {totalElements > 0 && (
            <Pagination
              position="top"
              page={page}
              size={size}
              totalElements={totalElements}
              onPageChange={setPage}
              onSizeChange={handleSizeChange}
              sizeOptions={[10, 25, 50, 100]}
            />
          )}
          <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">← swipe table to see all columns →</p>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="relative overflow-auto">
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "600px" }}>
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-50 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:bg-slate-700/80 dark:text-slate-300">
                      Name
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Branch
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Pri
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Active
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredPriceLists.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-2 py-8 text-center text-xs text-slate-500 sm:px-3 sm:text-sm dark:text-slate-400"
                      >
                        {priceLists.length === 0 ? "No price lists yet. Add one to set prices by branch/channel." : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredPriceLists.map((list: PriceList) => (
                      <tr
                        key={list.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 sm:px-3 sm:py-2 sm:text-sm dark:bg-slate-800 dark:text-white">
                          {list.name}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-600 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-300">
                          {branchName(list.branchId)}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-600 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-300">
                          {list.priority}
                        </td>
                        <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                          {list.active ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Yes
                            </span>
                          ) : (
                            <span className="text-slate-500">No</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-left sm:px-3 sm:py-2">
                          <div className="flex justify-start gap-2">
                            <Link
                              to={editHref(list.id)}
                              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                              title={`Edit ${list.name}`}
                              aria-label={`Edit ${list.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(list)}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                              title={`Delete ${list.name}`}
                              aria-label={`Delete ${list.name}`}
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
          </div>

          <SlideOver
            open={slideOpen}
            onClose={closeSlide}
            title="Add price list"
            maxWidth="max-w-xl"
          >
            <form onSubmit={handleListSubmit} className="space-y-4">
              {formError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
                  {formError}
                </p>
              )}
              <div>
                <label
                  htmlFor="price-list-name"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Name
                </label>
                <input
                  id="price-list-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g. Default"
                  autoFocus
                />
              </div>
              <div>
                <label
                  htmlFor="price-list-branch"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Branch
                </label>
                <SearchableSelect
                  id="price-list-branch"
                  options={priceListBranchOptions}
                  value={formBranchId}
                  onChange={setFormBranchId}
                  placeholder="Search branch…"
                  className="w-full"
                  controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                />
              </div>
              <div>
                <label
                  htmlFor="price-list-channel"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Channel (optional)
                </label>
                <input
                  id="price-list-channel"
                  type="text"
                  value={formChannel}
                  onChange={(e) => setFormChannel(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g. RETAIL"
                />
              </div>
              <div>
                <label
                  htmlFor="price-list-priority"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Priority
                </label>
                <input
                  id="price-list-priority"
                  type="number"
                  min={0}
                  value={formPriority}
                  onChange={(e) =>
                    setFormPriority(Number.parseInt(e.target.value, 10) || 0)
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
                />
                Active
              </label>

              <p className="border-t border-slate-200 pt-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Save this price list, then click <strong>Edit</strong> (pencil) on
                it to add menu items and set their prices.
              </p>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={closeSlide}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600"
                >
                  {submitLoading ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </SlideOver>

          <ConfirmDialog
            open={Boolean(confirmDelete)}
            onClose={() => setConfirmDelete(null)}
            onConfirm={handleDeleteConfirm}
            title="Delete price list?"
            message={
              confirmDelete ? (
                <>
                  <strong>{confirmDelete.name}</strong> will be deactivated. It
                  will no longer be used for pricing.
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
