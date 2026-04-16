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
import { SlideOver, Pagination, ConfirmDialog, TableSearchInput } from "@/components/ui";
import { useTableSearch } from "@/hooks/useTableSearch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Plus, Truck, Pencil, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface SuppliersListPageProps {
  initialOrgId?: string;
  onOrgChange?: (orgId: string) => void;
}

export function SuppliersListPage({
  initialOrgId,
  onOrgChange,
}: SuppliersListPageProps = {}) {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
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
  const [confirmDeactivate, setConfirmDeactivate] = useState<Supplier | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: suppliersData, isLoading, isError, error } = useQuery({
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
  const totalElements = suppliersData?.totalElements ?? 0;
  const { searchQuery, setSearchQuery, filteredRows: filteredSuppliers } = useTableSearch(suppliers);

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

  if (isLoading && selectedOrgId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Suppliers"
          subtitle="Loading…"
          icon={Truck}
          fallbackTo="/admin"
        />
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Loading…
        </div>
      </div>
    );
  }

  if (isError && selectedOrgId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Suppliers"
          icon={Truck}
          fallbackTo="/admin"
        />
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
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
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Suppliers"
          subtitle="Manage suppliers for receiving stock. Add a supplier before recording stock receipts."
          icon={Truck}
          fallbackTo="/admin"
          noMargin
        />
        <button
          type="button"
          onClick={() => {
            setEditingSupplier(null);
            resetForm();
            setSlideOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          <Plus className="h-5 w-5" />
          Add supplier
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
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
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view suppliers.
        </div>
      ) : (
        <>
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search suppliers…" className="mb-4" />

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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="relative min-h-0 flex-1 overflow-auto">
              <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
              <table className="w-full divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "600px" }}>
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-50 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:bg-slate-700 dark:text-slate-300">
                      Name
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Phone
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Email
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Status
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-3 sm:py-3 sm:text-sm dark:text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-2 py-8 text-center text-xs text-slate-500 sm:px-3 sm:text-sm dark:text-slate-400"
                      >
                        {suppliers.length === 0
                          ? (includeInactive
                              ? "No suppliers (active or inactive)."
                              : "No suppliers. Add a supplier to use when receiving goods.")
                          : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((s: Supplier) => (
                      <tr
                        key={s.id}
                        className={`group hover:bg-slate-100 dark:hover:bg-slate-700 ${
                          !s.active ? "opacity-60" : ""
                        }`}
                      >
                        <td className="sticky left-0 z-10 bg-white group-hover:!bg-slate-100 dark:bg-slate-800 dark:group-hover:!bg-slate-700 px-2 py-1.5 text-xs font-medium text-slate-800 sm:px-3 sm:py-2 sm:text-sm  dark:text-white">
                          {s.name}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-600 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-300">
                          {s.phone ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-slate-600 sm:px-3 sm:py-2 sm:text-sm dark:text-slate-300">
                          {s.email ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 sm:px-3 sm:py-2">
                          <span
                            className={`inline-flex justify-start rounded-full px-2 py-0.5 text-left text-xs font-medium ${
                              s.active
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                            }`}
                          >
                            {s.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-left sm:px-3 sm:py-2">
                          <div className="flex justify-start gap-1">
                            {s.active ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(s)}
                                  className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-white"
                                  title={`Edit ${s.name}`}
                                  aria-label={`Edit ${s.name}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeactivate(s)}
                                  className="rounded p-2 text-slate-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-slate-600 dark:hover:text-red-300"
                                  title={`Deactivate ${s.name}`}
                                  aria-label={`Deactivate ${s.name}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
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
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDeactivate != null}
        onClose={() => setConfirmDeactivate(null)}
        onConfirm={handleDeactivate}
        title="Deactivate supplier"
        message={`Deactivate "${confirmDeactivate?.name}"? They will be hidden from receive stock. You can reactivate later.`}
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
              role="alert"
            >
              {formError}
            </div>
          )}
          <div>
            <label
              htmlFor="supplier-name"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Name *
            </label>
            <input
              id="supplier-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              required
              maxLength={200}
            />
          </div>
          <div>
            <label
              htmlFor="supplier-phone"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Phone
            </label>
            <input
              id="supplier-phone"
              type="text"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              maxLength={50}
            />
          </div>
          <div>
            <label
              htmlFor="supplier-email"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Email
            </label>
            <input
              id="supplier-email"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              maxLength={200}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setSlideOpen(false);
                setEditingSupplier(null);
                resetForm();
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitLoading}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-400"
            >
              {submitLoading
                ? editingSupplier
                  ? "Saving…"
                  : "Creating…"
                : editingSupplier
                  ? "Save"
                  : "Create"}
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
