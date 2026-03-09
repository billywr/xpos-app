import { useState, useEffect } from "react";
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
import { SlideOver, ConfirmDialog, Pagination } from "@/components/ui";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Plus, Pencil, Trash2 } from "lucide-react";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export interface BusinessesListPageProps {
  initialOrgId?: string;
}

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

  const { data: businessesData, isLoading, isError, error } = useQuery({
    queryKey: ["admin-businesses", token, selectedOrgId, page, size],
    queryFn: () => fetchBusinesses(token, selectedOrgId, { page, size }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

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
  const totalElements = businessesData?.totalElements ?? 0;

  useEffect(() => {
    if (initialOrgId) {
      setSelectedOrgId(initialOrgId);
    } else if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [initialOrgId, orgs, selectedOrgId]);

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

  if (isLoading && selectedOrgId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Businesses"
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
          title="Businesses"
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
        title="Businesses"
        subtitle="Per-org businesses. Each branch is linked to a business (legal entity, receipt branding)."
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label
          htmlFor="business-org-select"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Organization
        </label>
        <select
          id="business-org-select"
          value={selectedOrgId}
          onChange={(e) => {
            setSelectedOrgId(e.target.value);
            setPage(0);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        >
          <option value="">Select organization…</option>
          {orgs.map((org: Org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        {selectedOrgId && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-primary-500 dark:hover:bg-primary-600 dark:focus:ring-offset-slate-800"
          >
            <Plus className="h-4 w-4" />
            Add business
          </button>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view and manage businesses.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Legal name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      KRA PIN
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {businesses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        No businesses yet. Add one to use when creating branches.
                      </td>
                    </tr>
                  ) : (
                    businesses.map((business: Business) => (
                      <tr
                        key={business.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                          {business.legalName}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {business.kraPin ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-left">
                          <div className="flex justify-start gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(business)}
                              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                              title={`Edit ${business.legalName}`}
                              aria-label={`Edit ${business.legalName}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(business)}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                              title={`Delete ${business.legalName}`}
                              aria-label={`Delete ${business.legalName}`}
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
              <div>
                <label
                  htmlFor="business-legal-name"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Legal name
                </label>
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
                <label
                  htmlFor="business-kra-pin"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  KRA PIN (optional)
                </label>
                <input
                  id="business-kra-pin"
                  type="text"
                  value={formKraPin}
                  onChange={(e) => setFormKraPin(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="Tax registration number"
                />
              </div>
              <div>
                <label
                  htmlFor="business-logo-url"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Logo URL (optional)
                </label>
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
                <label
                  htmlFor="business-receipt-footer"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Receipt footer (optional)
                </label>
                <textarea
                  id="business-receipt-footer"
                  rows={3}
                  value={formReceiptFooter}
                  onChange={(e) => setFormReceiptFooter(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="Text shown at bottom of receipts"
                />
              </div>
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
                    : editingBusiness
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
