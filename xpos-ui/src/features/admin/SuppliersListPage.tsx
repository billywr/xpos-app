import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
} from "@/api/suppliers";
import type { Org } from "@/types/org";
import type { Supplier } from "@/api/suppliers";
import { filterActiveOrgs } from "@/types/org";
import { PageHeader } from "@/components/PageHeader";
import {
  Badge,
  Button,
  IconButton,
  SlideOver,
  Pagination,
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
  tableStickyFirstBody,
  tableEmptyCell,
  tableCard,
  tableRowNoCol,
} from "@/components/ui";
import { useQueryDisplay } from "@/hooks/useQueryDisplay";
import { useServerPaginatedTableSearch } from "@/hooks/useServerPaginatedTableSearch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { useFormCustomization } from "@/contexts/FormCustomizationContext";
import { Plus, Truck, Pencil, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface SuppliersListPageProps {
  initialOrgId?: string;
  onOrgChange?: (orgId: string) => void;
}

const SUPPLIER_SORT = {
  name: (row: Supplier) => row.name,
  phone: (row: Supplier) => row.phone ?? "",
  email: (row: Supplier) => row.email ?? "",
  status: (row: Supplier) => (row.active ? "ACTIVE" : "INACTIVE"),
};

export function SuppliersListPage({
  initialOrgId,
  onOrgChange,
}: SuppliersListPageProps = {}) {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const supplierCustom = useFormCustomization("supplier");
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId ?? "");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const isSupplierFormValid = useMemo(() => {
    if (supplierCustom.isFieldVisible("name") && supplierCustom.isFieldRequired("name", true) && !formName.trim()) return false;
    if (supplierCustom.isFieldVisible("phone") && supplierCustom.isFieldRequired("phone", false) && !formPhone.trim()) return false;
    if (supplierCustom.isFieldVisible("email") && supplierCustom.isFieldRequired("email", false) && !formEmail.trim()) return false;
    return true;
  }, [formName, formPhone, formEmail, supplierCustom]);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Supplier | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const suppliersQuery = useQuery({
    queryKey: [
      "admin-suppliers",
      token,
      selectedOrgId,
      page,
      size,
      includeInactive,
    ],
    queryFn: () =>
      fetchSuppliers(token, selectedOrgId, {
        page,
        size,
        includeInactive,
      }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });
  const { data: suppliersData, isError, error, refetch } = suppliersQuery;
  const { isInitialLoad, isRefreshing } = useQueryDisplay(suppliersQuery);

  const createMutation = useMutation({
    mutationFn: (body: { name: string; phone?: string; email?: string }) =>
      createSupplier(token, selectedOrgId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-suppliers", token, selectedOrgId],
      });
      setSlideOpen(false);
      setEditingSupplier(null);
      resetForm();
      toast.success("Supplier created.", { title: "Created" });
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
      supplierId: string;
      name: string;
      phone?: string;
      email?: string;
      active?: boolean;
    }) =>
      updateSupplier(token, selectedOrgId, body.supplierId, {
        name: body.name,
        phone: body.phone,
        email: body.email,
        active: body.active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-suppliers", token, selectedOrgId],
      });
      setSlideOpen(false);
      setEditingSupplier(null);
      setConfirmDeactivate(null);
      setDeactivateLoading(false);
      resetForm();
      toast.success("Supplier updated.", { title: "Saved" });
    },
    onError: (err) => {
      setSubmitLoading(false);
      setDeactivateLoading(false);
      const requestId = getApiErrorRequestId(err);
      toast.error(getApiErrorMessage(err), {
        detail: requestId ? `Reference: ${requestId}` : undefined,
      });
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormError(null);
    setSubmitLoading(false);
  };

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const suppliers = suppliersData?.content ?? [];
  const {
    searchQuery,
    setSearchQuery,
    filteredRows: filteredSuppliers,
    totalElements,
    sortColumn,
    sortDirection,
    toggleSort,
  } = useServerPaginatedTableSearch({
    pageRows: suppliers,
    serverTotalElements: suppliersData?.totalElements ?? 0,
    page,
    size,
    setPage,
    searchAllQueryKey: ["admin-suppliers", token, selectedOrgId, includeInactive],
    searchAllQueryFn: (fetchSize) =>
      fetchSuppliers(token, selectedOrgId, {
        page: 0,
        size: fetchSize,
        includeInactive,
      }),
    searchAllEnabled: Boolean(token) && Boolean(selectedOrgId),
    sortAccessors: SUPPLIER_SORT,
  });

  const showPhoneCol = useMemo(
    () =>
      filteredSuppliers.some(
        (s: Supplier) => !!s.phone && s.phone.trim() !== "" && s.phone !== "—"
      ),
    [filteredSuppliers]
  );
  const showEmailCol = useMemo(
    () =>
      filteredSuppliers.some(
        (s: Supplier) => !!s.email && s.email.trim() !== "" && s.email !== "—"
      ),
    [filteredSuppliers]
  );
  const visibleSuppliersColCount =
    4 + (showPhoneCol ? 1 : 0) + (showEmailCol ? 1 : 0);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const name = formName.trim();
    if (!name) {
      setFormError("Name is required");
      return;
    }
    setSubmitLoading(true);
    if (editingSupplier) {
      updateMutation.mutate({
        supplierId: editingSupplier.id,
        name,
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
      });
    } else {
      createMutation.mutate({
        name,
        phone: formPhone.trim() || undefined,
        email: formEmail.trim() || undefined,
      });
    }
  };

  const handleEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setFormName(s.name);
    setFormPhone(s.phone ?? "");
    setFormEmail(s.email ?? "");
    setFormError(null);
    setSlideOpen(true);
  };

  const handleDeactivate = () => {
    if (!confirmDeactivate) return;
    setDeactivateLoading(true);
    updateMutation.mutate({
      supplierId: confirmDeactivate.id,
      name: confirmDeactivate.name,
      phone: confirmDeactivate.phone ?? undefined,
      email: confirmDeactivate.email ?? undefined,
      active: false,
    });
  };

  const handleReactivate = (s: Supplier) => {
    updateMutation.mutate({
      supplierId: s.id,
      name: s.name,
      phone: s.phone ?? undefined,
      email: s.email ?? undefined,
      active: true,
    });
  };

  const handleSizeChange = (newSize: number) => {
    setSize(Math.min(newSize, MAX_PAGE_SIZE));
    setPage(0);
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        title="Suppliers"
        subtitle="Manage suppliers for receiving stock. Add a supplier before recording stock receipts."
        icon={Truck}
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {orgs.length > 1 && (
            <div className="flex min-w-0 items-center gap-2">
              <label
                htmlFor="suppliers-org-select"
                className="shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Organization
              </label>
              <SearchableSelect
                id="suppliers-org-select"
                options={orgSelectOptions}
                value={selectedOrgId}
                onChange={(next) => {
                  setSelectedOrgId(next);
                  setPage(0);
                  onOrgChange?.(next);
                }}
                placeholder="Search organization…"
                compact
                className="w-44 min-w-[10rem] max-w-[min(100%,16rem)]"
                controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
              />
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => {
                setIncludeInactive(e.target.checked);
                setPage(0);
              }}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Include inactive
            </span>
          </label>
          {selectedOrgId && (
            <TableSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search suppliers…"
              className="w-full sm:w-64"
            />
          )}
        </div>
        {selectedOrgId && (
          <Button
            onClick={() => {
              setEditingSupplier(null);
              resetForm();
              setSlideOpen(true);
            }}
          >
            <Plus className="h-5 w-5" />
            Add supplier
          </Button>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view suppliers.
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
          <div className={tableCard}>
            <div className="relative min-h-0 flex-1 overflow-auto">
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full table-fixed divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "720px" }}>
                <colgroup>
                  <col className={tableRowNoCol} />
                  <col className="w-[26%]" />
                  {showPhoneCol && <col className="w-[15%]" />}
                  {showEmailCol && <col className="w-[22%]" />}
                  <col className="w-[13%]" />
                  <col className="w-[16%]" />
                </colgroup>
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
                    {showPhoneCol && (
                      <SortableTableHead
                        columnKey="phone"
                        label="Phone"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className={tableHeadCell}
                      />
                    )}
                    {showEmailCol && (
                      <SortableTableHead
                        columnKey="email"
                        label="Email"
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={toggleSort}
                        className={tableHeadCell}
                      />
                    )}
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
                    <TableSkeleton columns={5} />
                  ) : filteredSuppliers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleSuppliersColCount}
                        className={tableEmptyCell}
                      >
                        {suppliers.length === 0
                          ? (includeInactive
                              ? "No suppliers (active or inactive)."
                              : "No suppliers. Add a supplier to use when receiving goods.")
                          : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((s: Supplier, index) => (
                      <tr
                        key={s.id}
                        className={`${tableBodyRow} ${
                          !s.active ? "opacity-60" : ""
                        }`}
                      >
                        <TableRowNumberCell page={page} pageSize={size} indexInPage={index} />
                        <td className={tableStickyFirstBody}>
                          {s.name}
                        </td>
                        {showPhoneCol && (
                          <td className={tableBodyCell}>
                            {s.phone ?? "—"}
                          </td>
                        )}
                        {showEmailCol && (
                          <td className={tableBodyCell}>
                            {s.email ?? "—"}
                          </td>
                        )}
                        <td className={tableBodyCell}>
                          <Badge status={s.active ? "ACTIVE" : "INACTIVE"}>
                            {s.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className={tableBodyCell}>
                          <div className="flex justify-start gap-1">
                            {s.active ? (
                              <>
                                <IconButton
                                  onClick={() => handleEdit(s)}
                                  title={`Edit ${s.name}`}
                                  aria-label={`Edit ${s.name}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </IconButton>
                                <IconButton
                                  variant="danger"
                                  onClick={() => setConfirmDeactivate(s)}
                                  title={`Deactivate ${s.name}`}
                                  aria-label={`Deactivate ${s.name}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </IconButton>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReactivate(s)}
                                className="rounded px-2 py-1 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                              >
                                Reactivate
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
                onRefresh={() => void refetch()}
                isRefreshing={isRefreshing}
              />
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDeactivate != null}
        onClose={() => setConfirmDeactivate(null)}
        onConfirm={handleDeactivate}
        title="Deactivate supplier"
        message={`Deactivate "${confirmDeactivate?.name}"? They will be hidden from add stock. You can reactivate later.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={deactivateLoading}
      />
      <SlideOver
        open={slideOpen}
        onClose={() => {
          setSlideOpen(false);
          setEditingSupplier(null);
          resetForm();
        }}
        title={editingSupplier ? "Edit supplier" : "Add supplier"}
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {formError && (
            <div
              className="col-span-1 sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
              role="alert"
            >
              {formError}
            </div>
          )}
          {supplierCustom.isFieldVisible("name") && (
            <div style={{ order: supplierCustom.getFieldOrder("name") }} className={supplierCustom.getFieldColSpan("name")}>
              <FormLabel
                htmlFor="supplier-name"
                className="mb-1"
                required={supplierCustom.isFieldRequired("name", true)}
              >
                {supplierCustom.getFieldLabel("name")}
              </FormLabel>
              <input
                id="supplier-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={supplierCustom.getFieldPlaceholder("name")}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                required={supplierCustom.isFieldRequired("name", true)}
                maxLength={200}
              />
            </div>
          )}
          {supplierCustom.isFieldVisible("phone") && (
            <div style={{ order: supplierCustom.getFieldOrder("phone") }} className={supplierCustom.getFieldColSpan("phone")}>
              <FormLabel
                htmlFor="supplier-phone"
                className="mb-1"
                required={supplierCustom.isFieldRequired("phone", false)}
              >
                {supplierCustom.getFieldLabel("phone")}
              </FormLabel>
              <input
                id="supplier-phone"
                type="text"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder={supplierCustom.getFieldPlaceholder("phone")}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                required={supplierCustom.isFieldRequired("phone", false)}
                maxLength={50}
              />
            </div>
          )}
          {supplierCustom.isFieldVisible("email") && (
            <div style={{ order: supplierCustom.getFieldOrder("email") }} className={supplierCustom.getFieldColSpan("email")}>
              <FormLabel
                htmlFor="supplier-email"
                className="mb-1"
                required={supplierCustom.isFieldRequired("email", false)}
              >
                {supplierCustom.getFieldLabel("email")}
              </FormLabel>
              <input
                id="supplier-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder={supplierCustom.getFieldPlaceholder("email")}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                required={supplierCustom.isFieldRequired("email", false)}
                maxLength={200}
              />
            </div>
          )}
          <div style={{ order: 999 }} className="col-span-1 sm:col-span-2 grid grid-cols-2 gap-3 pt-4">
            <Button type="submit" size="md" className="w-full" disabled={submitLoading || !isSupplierFormValid}>
              {submitLoading ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full"
              onClick={() => {
                setSlideOpen(false);
                setEditingSupplier(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
