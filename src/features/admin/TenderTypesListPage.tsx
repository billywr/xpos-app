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
import { SlideOver, ConfirmDialog, TableSearchInput } from "@/components/ui";
import { useTableSearch } from "@/hooks/useTableSearch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

export function TenderTypesListPage() {
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

  const { data: tenderTypesData, isLoading, isError, error } = useQuery({
    queryKey: ["admin-tender-types", token, selectedOrgId],
    queryFn: () =>
      fetchTenderTypes(token, selectedOrgId, { includeInactive: true }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

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
  const { searchQuery, setSearchQuery, filteredRows: filteredTenderTypes } = useTableSearch(tenderTypes);

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

  if (isLoading && selectedOrgId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <PageHeader
          title="Tender types"
          subtitle="Loading…"
          icon={CreditCard}
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
          title="Tender types"
          icon={CreditCard}
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
        title="Tender types"
        subtitle="Payment methods (Cash, M-Pesa, Card, etc.) for completing sales."
        icon={CreditCard}
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-center gap-4">
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
            Add tender type
          </button>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view and manage tender types.
        </div>
      ) : (
        <>
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search tender types…" className="mb-4" />

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Active
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredTenderTypes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        {tenderTypes.length === 0 ? "No tender types yet. Add one (e.g. Cash, M-Pesa) for payment options." : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredTenderTypes.map((tt: TenderType) => (
                      <tr
                        key={tt.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 font-mono text-sm font-medium text-slate-800 dark:text-white">
                          {tt.code}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {tt.name}
                        </td>
                        <td className="px-4 py-3">
                          {tt.active ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Yes
                            </span>
                          ) : (
                            <span className="text-slate-500">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-left">
                          <div className="flex justify-start gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(tt)}
                              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                              title={`Edit ${tt.name}`}
                              aria-label={`Edit ${tt.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(tt)}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                              title={`Delete ${tt.name}`}
                              aria-label={`Delete ${tt.name}`}
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
                <label
                  htmlFor="tender-type-code"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Code
                </label>
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
                <label
                  htmlFor="tender-type-name"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Name
                </label>
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
                  <label
                    htmlFor="tender-type-active"
                    className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Active
                  </label>
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
                    : editingTenderType
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
