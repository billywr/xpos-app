import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/api/categories";
import type { Org } from "@/types/org";
import { filterActiveOrgs } from "@/types/org";
import type { Category } from "@/types/catalog";
import { PageHeader } from "@/components/PageHeader";
import { SlideOver, Pagination, ConfirmDialog, TableSearchInput } from "@/components/ui";
import { useTableSearch } from "@/hooks/useTableSearch";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const CATEGORY_TYPES = ["PRODUCT", "MENU", "SERVICE"] as const;

export interface CategoriesListPageProps {
  initialOrgId?: string;
  onOrgChange?: (orgId: string) => void;
}

export function CategoriesListPage({ initialOrgId, onOrgChange }: CategoriesListPageProps = {}) {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId ?? "");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formParentId, setFormParentId] = useState<string>("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<string>("PRODUCT");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: categoriesData, isLoading, isError, error } = useQuery({
    queryKey: ["admin-categories", token, selectedOrgId, page, size],
    queryFn: () => fetchCategories(token, selectedOrgId, { page, size }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const { data: allCategoriesData } = useQuery({
    queryKey: ["admin-categories", token, selectedOrgId],
    queryFn: () => fetchCategories(token, selectedOrgId, { size: 500 }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && slideOpen,
  });

  const createMutation = useMutation({
    mutationFn: (body: {
      parentId: string | null;
      name: string;
      type: string;
    }) => createCategory(token, selectedOrgId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-categories", token, selectedOrgId],
      });
      queryClient.invalidateQueries({
        queryKey: ["categories", selectedOrgId],
      });
      setSlideOpen(false);
      setEditingCategory(null);
      resetForm();
      toast.success("Category created.", { title: "Created" });
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
      categoryId: string;
      parentId: string | null;
      name: string;
      type: string;
    }) =>
      updateCategory(token, selectedOrgId, body.categoryId, {
        parentId: body.parentId,
        name: body.name,
        type: body.type,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-categories", token, selectedOrgId],
      });
      queryClient.invalidateQueries({
        queryKey: ["categories", selectedOrgId],
      });
      setSlideOpen(false);
      setEditingCategory(null);
      resetForm();
      toast.success("Category updated.", { title: "Saved" });
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
    mutationFn: (categoryId: string) =>
      deleteCategory(token, selectedOrgId, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-categories", token, selectedOrgId],
      });
      queryClient.invalidateQueries({
        queryKey: ["categories", selectedOrgId],
      });
      setConfirmDelete(null);
      setDeleteLoading(false);
      toast.success("Category deleted.", { title: "Deleted" });
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
  const categories = categoriesData?.content ?? [];
  const totalElements = categoriesData?.totalElements ?? 0;
  const { searchQuery, setSearchQuery, filteredRows: filteredCategories } = useTableSearch(categories);
  const allCategories = allCategoriesData?.content ?? [];
  const parentOptions = allCategories.filter(
    (c: Category) => !editingCategory || c.id !== editingCategory.id
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
      ...orgs.map((o: Org) => ({ value: o.id, label: o.name })),
    ],
    [orgs]
  );

  const parentSelectOptions = useMemo(
    () => [
      { value: "", label: "None (root)" },
      ...parentOptions.map((c: Category) => ({ value: c.id, label: c.name })),
    ],
    [parentOptions]
  );

  const categoryTypeOptions = useMemo(
    () => CATEGORY_TYPES.map((t) => ({ value: t, label: t })),
    []
  );

  function resetForm() {
    setFormParentId("");
    setFormName("");
    setFormType("PRODUCT");
    setFormError(null);
  }

  const openCreate = () => {
    setEditingCategory(null);
    resetForm();
    setSlideOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setFormParentId(category.parentId ?? "");
    setFormName(category.name);
    setFormType(category.type);
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
    const parentId = formParentId.trim() || null;
    setSubmitLoading(true);
    if (editingCategory) {
      updateMutation.mutate(
        {
          categoryId: editingCategory.id,
          parentId,
          name: trimmed,
          type: formType,
        },
        { onSettled: () => setSubmitLoading(false) }
      );
    } else {
      createMutation.mutate(
        { parentId, name: trimmed, type: formType },
        { onSettled: () => setSubmitLoading(false) }
      );
    }
  };

  const handleSizeChange = (newSize: number) => {
    setSize(Math.min(newSize, MAX_PAGE_SIZE));
    setPage(0);
  };

  const parentName = (category: Category) => {
    if (!category.parentId) return "—";
    const parent = allCategories.find((c: Category) => c.id === category.parentId);
    return parent?.name ?? category.parentId;
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
          title="Categories"
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
          title="Categories"
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
        title="Categories"
        subtitle="Catalog categories for organizing products and menu items."
        fallbackTo="/admin"
      />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label
          htmlFor="category-org-select"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Organization
        </label>
        <SearchableSelect
          id="category-org-select"
          options={orgSelectOptions}
          value={selectedOrgId}
          onChange={(next) => {
            setSelectedOrgId(next);
            setPage(0);
            onOrgChange?.(next);
          }}
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
            Add category
          </button>
        )}
      </div>

      {!selectedOrgId ? (
        <div className="rounded-xl border border-sky-200/70 bg-white/90 p-8 text-center text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
          Select an organization to view and manage categories.
        </div>
      ) : (
        <>
          <TableSearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search categories…" className="mb-4" />

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Parent
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredCategories.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                      >
                        {categories.length === 0 ? "No categories yet. Add one to organize your catalog." : "No results match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((cat: Category) => (
                      <tr
                        key={cat.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                          {cat.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {parentName(cat)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {cat.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-left">
                          <div className="flex justify-start gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(cat)}
                              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                              title={`Edit ${cat.name}`}
                              aria-label={`Edit ${cat.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(cat)}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                              title={`Delete ${cat.name}`}
                              aria-label={`Delete ${cat.name}`}
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
            title={editingCategory ? "Edit category" : "Add category"}
          >
            <form onSubmit={handleSlideSubmit} className="space-y-4">
              {formError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
                  {formError}
                </p>
              )}
              <div>
                <label
                  htmlFor="category-name"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Name
                </label>
                <input
                  id="category-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g. Beverages"
                  autoFocus
                />
              </div>
              <div>
                <label
                  htmlFor="category-parent"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Parent category
                </label>
                <SearchableSelect
                  id="category-parent"
                  options={parentSelectOptions}
                  value={formParentId}
                  onChange={setFormParentId}
                  placeholder="Search parent…"
                  className="w-full"
                  controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                />
              </div>
              <div>
                <label
                  htmlFor="category-type"
                  className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Type
                </label>
                <SearchableSelect
                  id="category-type"
                  options={categoryTypeOptions}
                  value={formType}
                  onChange={setFormType}
                  placeholder="Search type…"
                  className="w-full"
                  controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
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
                    : editingCategory
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
            title="Delete category?"
            message={
              confirmDelete ? (
                <>
                  <strong>{confirmDelete.name}</strong> will be permanently
                  removed. This fails if it has child categories or items.
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
