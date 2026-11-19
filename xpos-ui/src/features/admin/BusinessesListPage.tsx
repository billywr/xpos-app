import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import {
  fetchBusinesses,
  createBusiness,
  updateBusiness,
  deleteBusiness,
} from "@/api/businesses";
import type { Org } from "@/types/org";
import { filterActiveOrgs } from "@/types/org";
import type { Business } from "@/types/org";
import { PageHeader } from "@/components/PageHeader";
import {
  SlideOver,
  Button,
  IconButton,
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface BusinessesListPageProps {
  initialOrgId?: string;
}

const BUSINESS_SORT = {
  legalName: (row: Business) => row.legalName,
  kraPin: (row: Business) => row.kraPin ?? "",
};

export function BusinessesListPage({ initialOrgId }: BusinessesListPageProps = {}) {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId ?? "");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Business | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formLegalName, setFormLegalName] = useState("");
  const [formKraPin, setFormKraPin] = useState("");
  const [formLogoUrl, setFormLogoUrl] = useState("");
  const [formReceiptFooter, setFormReceiptFooter] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const businessesQuery = useQuery({
    queryKey: ["admin-businesses", token, selectedOrgId, page, size],
    queryFn: () => fetchBusinesses(token, selectedOrgId, { page, size }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });
  const { data: businessesData, isError, error, refetch } = businessesQuery;
  const { isInitialLoad, isRefreshing } = useQueryDisplay(businessesQuery);

  const createMutation = useMutation({
    mutationFn: (body: {
      legalName: string;
      kraPin: string | null;
      logoUrl: string | null;
      receiptFooter: string | null;
    }) => createBusiness(token, selectedOrgId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-businesses", token, selectedOrgId],
      });
      setSlideOpen(false);
      setEditingBusiness(null);
      resetForm();
      toast.success("Business created.", { title: "Created" });
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
      businessId: string;
      legalName: string;
      kraPin: string | null;
      logoUrl: string | null;
      receiptFooter: string | null;
    }) =>
      updateBusiness(token, selectedOrgId, body.businessId, {
        legalName: body.legalName,
        kraPin: body.kraPin,
        logoUrl: body.logoUrl,
        receiptFooter: body.receiptFooter,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-businesses", token, selectedOrgId],
      });
      setSlideOpen(false);
      setEditingBusiness(null);
      resetForm();
      toast.success("Business updated.", { title: "Saved" });
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
    mutationFn: (businessId: string) =>
      deleteBusiness(token, selectedOrgId, businessId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-businesses", token, selectedOrgId],
      });
      setConfirmDelete(null);
      setDeleteLoading(false);
      toast.success("Business deleted.", { title: "Deleted" });
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
  const businesses = businessesData?.content ?? [];
  const {
    searchQuery,
    setSearchQuery,
    filteredRows: filteredBusinesses,
    totalElements,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useServerPaginatedTableSearch({
    pageRows: businesses,
    serverTotalElements: businessesData?.totalElements ?? 0,
    page,
    size,
    setPage,
    searchAllQueryKey: ["admin-businesses", token, selectedOrgId],
    searchAllQueryFn: (fetchSize) =>
      fetchBusinesses(token, selectedOrgId, { page: 0, size: fetchSize }),
    searchAllEnabled: Boolean(token) && Boolean(selectedOrgId),
    sortAccessors: BUSINESS_SORT,
  });

  const showKraPinCol = useMemo(
    () => filteredBusinesses.some((b: Business) => !!b.kraPin && b.kraPin.trim() !== "" && b.kraPin !== "—"),
    [filteredBusinesses]
  );

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
    setFormLegalName("");
    setFormKraPin("");
    setFormLogoUrl("");
    setFormReceiptFooter("");
    setFormError(null);
  }

  const openCreate = () => {
    setEditingBusiness(null);
    resetForm();
    setSlideOpen(true);
  };

  const openEdit = (business: Business) => {
    setEditingBusiness(business);
    setFormLegalName(business.legalName);
    setFormKraPin(business.kraPin ?? "");
    setFormLogoUrl(business.logoUrl ?? "");
    setFormReceiptFooter(business.receiptFooter ?? "");
    setFormError(null);
    setSlideOpen(true);
  };

  const handleSlideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = formLegalName.trim();
    if (!trimmed) {
      setFormError("Legal name is required.");
      return;
    }
    const kraPin = formKraPin.trim() || null;
    const logoUrl = formLogoUrl.trim() || null;
    const receiptFooter = formReceiptFooter.trim() || null;
    setSubmitLoading(true);
    if (editingBusiness) {
      updateMutation.mutate(
        {
          businessId: editingBusiness.id,
          legalName: trimmed,
          kraPin,
          logoUrl,
          receiptFooter,
        },
        { onSettled: () => setSubmitLoading(false) }
      );
    } else {
      createMutation.mutate(
        { legalName: trimmed, kraPin, logoUrl, receiptFooter },
        { onSettled: () => setSubmitLoading(false) }
      );
    }
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
        title="Businesses"
        subtitle="Per-org businesses. Each branch is linked to a business (legal entity, receipt branding)."
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          {orgs.length > 1 && (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="business-org-select"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Organization
              </label>
              <SearchableSelect
                id="business-org-select"
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
              placeholder="Search businesses…"
              className="w-full sm:w-64"
            />
          )}
        </div>
        {selectedOrgId && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add business
          </Button>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view and manage businesses.
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
              <table className="w-full divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "360px" }}>
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <TableRowNumberHead />
                    <SortableTableHead
                      columnKey="legalName"
                      label="Legal name"
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={toggleSort}
                      className={`${tableStickyHeadCell} ${tableHeadCell}`}
                    />
                    {showKraPinCol && (
                      <SortableTableHead
                        columnKey="kraPin"
                        label="KRA PIN"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className={tableHeadCell}
                      />
                    )}
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
                  ) : filteredBusinesses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3+ (showKraPinCol ? 1 : 0)}
                        className={tableEmptyCell}
                      >
                        {businesses.length === 0 ? "No businesses yet. Add one to use when creating branches." : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredBusinesses.map((business: Business, index) => (
                      <tr
                        key={business.id}
                        className={tableBodyRow}
                      >
                    <TableRowNumberCell page={page} pageSize={size} indexInPage={index} />
                        <td className={tableStickyFirstBody}>
                          {business.legalName}
                        </td>
                        {showKraPinCol && (
                          <td className={tableBodyCell}>
                            {business.kraPin ?? "—"}
                          </td>
                        )}
                        <td className={tableBodyCell}>
                          <div className="flex justify-start gap-2">
                            <IconButton
                              onClick={() => openEdit(business)}
                              title={`Edit ${business.legalName}`}
                              aria-label={`Edit ${business.legalName}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              variant="danger"
                              onClick={() => setConfirmDelete(business)}
                              title={`Delete ${business.legalName}`}
                              aria-label={`Delete ${business.legalName}`}
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
            title={editingBusiness ? "Edit business" : "Add business"}
          >
            <form onSubmit={handleSlideSubmit} className="space-y-4">
              {formError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
                  {formError}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FormLabel htmlFor="business-legal-name" className="mb-1">
                    Legal name
                  </FormLabel>
                  <input
                    id="business-legal-name"
                    type="text"
                    value={formLegalName}
                    onChange={(e) => setFormLegalName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    placeholder="e.g. Acme Ltd"
                    autoFocus
                  />
                </div>
                <div>
                  <FormLabel htmlFor="business-kra-pin" className="mb-1">
                    KRA PIN
                  </FormLabel>
                  <input
                    id="business-kra-pin"
                    type="text"
                    value={formKraPin}
                    onChange={(e) => setFormKraPin(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    placeholder="Tax registration number"
                  />
                </div>
              </div>
              <div>
                <FormLabel htmlFor="business-logo-url" className="mb-1">
                  Logo URL
                </FormLabel>
                <input
                  id="business-logo-url"
                  type="url"
                  value={formLogoUrl}
                  onChange={(e) => setFormLogoUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="https://…"
                />
              </div>
              <div>
                <FormLabel htmlFor="business-receipt-footer" className="mb-1">
                  Receipt footer
                </FormLabel>
                <textarea
                  id="business-receipt-footer"
                  rows={3}
                  value={formReceiptFooter}
                  onChange={(e) => setFormReceiptFooter(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="Text shown at bottom of receipts"
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
            open={Boolean(confirmDelete)}
            onClose={() => setConfirmDelete(null)}
            onConfirm={handleDeleteConfirm}
            title="Delete business?"
            message={
              confirmDelete ? (
                <>
                  <strong>{confirmDelete.legalName}</strong> will be marked as deleted. It will
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
