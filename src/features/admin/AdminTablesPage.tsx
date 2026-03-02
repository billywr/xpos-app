import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import {
  fetchTableAreas,
  createTableArea,
  updateTableArea,
} from "@/api/tableAreas";
import {
  fetchAdminTables,
  createAdminTable,
  updateAdminTable,
  type CreateTableBody,
  type UpdateTableBody,
} from "@/api/tables";
import type { Org, Branch } from "@/types/org";
import type { TableArea, TableEntity } from "@/types/sales";
import {
  filterActiveOrgs,
  filterNonDeletedBranches,
} from "@/types/org";
import { SlideOver } from "@/components/ui";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Plus, Pencil } from "lucide-react";

const DEFAULT_PAGE_SIZE = 25;

export function AdminTablesPage() {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const page = 0;
  const size = DEFAULT_PAGE_SIZE;

  const [areaSlideOpen, setAreaSlideOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<TableArea | null>(null);
  const [areaFormName, setAreaFormName] = useState("");
  const [areaFormError, setAreaFormError] = useState<string | null>(null);
  const [areaSubmitLoading, setAreaSubmitLoading] = useState(false);

  const [tableSlideOpen, setTableSlideOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableEntity | null>(null);
  const [tableFormName, setTableFormName] = useState("");
  const [tableFormCapacity, setTableFormCapacity] = useState<string>("");
  const [tableFormAreaId, setTableFormAreaId] = useState<string>("");
  const [tableFormStatus, setTableFormStatus] = useState("ACTIVE");
  const [tableFormError, setTableFormError] = useState<string | null>(null);
  const [tableSubmitLoading, setTableSubmitLoading] = useState(false);

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: branchesData } = useQuery({
    queryKey: ["admin-branches", token, selectedOrgId],
    queryFn: () => fetchBranches(token, selectedOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(selectedOrgId),
  });

  const { data: areasData } = useQuery({
    queryKey: ["admin-table-areas", token, selectedOrgId, selectedBranchId],
    queryFn: () =>
      fetchTableAreas(token, selectedOrgId, selectedBranchId, {
        page: 0,
        size: 100,
      }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedBranchId),
  });

  const { data: tablesData, isLoading, isError, error } = useQuery({
    queryKey: [
      "admin-tables",
      token,
      selectedOrgId,
      selectedBranchId,
      page,
      size,
    ],
    queryFn: () =>
      fetchAdminTables(token, selectedOrgId, selectedBranchId, { page, size }),
    enabled:
      Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedBranchId),
  });

  const areaCreateMutation = useMutation({
    mutationFn: (name: string) =>
      createTableArea(token, selectedOrgId, selectedBranchId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-table-areas", token, selectedOrgId, selectedBranchId],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-tables", token, selectedOrgId, selectedBranchId],
      });
      queryClient.invalidateQueries({ queryKey: ["operatorTables"] });
      setAreaSlideOpen(false);
      setEditingArea(null);
      setAreaFormName("");
      setAreaFormError(null);
      toast.success("Table area created.", { title: "Created" });
    },
    onError: (err) => {
      setAreaSubmitLoading(false);
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  const areaUpdateMutation = useMutation({
    mutationFn: ({ tableAreaId, name }: { tableAreaId: string; name: string }) =>
      updateTableArea(token, selectedOrgId, selectedBranchId, tableAreaId, {
        name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-table-areas", token, selectedOrgId, selectedBranchId],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-tables", token, selectedOrgId, selectedBranchId],
      });
      queryClient.invalidateQueries({ queryKey: ["operatorTables"] });
      setAreaSlideOpen(false);
      setEditingArea(null);
      setAreaFormName("");
      setAreaFormError(null);
      toast.success("Table area updated.", { title: "Saved" });
    },
    onError: (err) => {
      setAreaSubmitLoading(false);
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  const tableCreateMutation = useMutation({
    mutationFn: (body: CreateTableBody) =>
      createAdminTable(token, selectedOrgId, selectedBranchId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-tables", token, selectedOrgId, selectedBranchId],
      });
      queryClient.invalidateQueries({ queryKey: ["operatorTables"] });
      setTableSlideOpen(false);
      setEditingTable(null);
      resetTableForm();
      toast.success("Table created.", { title: "Created" });
    },
    onError: (err) => {
      setTableSubmitLoading(false);
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  const tableUpdateMutation = useMutation({
    mutationFn: ({
      tableId,
      body,
    }: { tableId: string; body: UpdateTableBody }) =>
      updateAdminTable(
        token,
        selectedOrgId,
        selectedBranchId,
        tableId,
        body
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-tables", token, selectedOrgId, selectedBranchId],
      });
      queryClient.invalidateQueries({ queryKey: ["operatorTables"] });
      setTableSlideOpen(false);
      setEditingTable(null);
      resetTableForm();
      toast.success("Table updated.", { title: "Saved" });
    },
    onError: (err) => {
      setTableSubmitLoading(false);
      toast.error(getApiErrorMessage(err), {
        detail: getApiErrorRequestId(err)
          ? `Reference: ${getApiErrorRequestId(err)}`
          : undefined,
      });
    },
  });

  const resetTableForm = () => {
    setTableFormName("");
    setTableFormCapacity("");
    setTableFormAreaId("");
    setTableFormStatus("ACTIVE");
    setTableFormError(null);
  };

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const branches = filterNonDeletedBranches(branchesData?.content ?? []);
  const areas = areasData?.content ?? [];
  const tables = tablesData?.content ?? [];
  const totalElements = tablesData?.totalElements ?? 0;

  useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [orgs, selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId) {
      setSelectedBranchId("");
    }
  }, [selectedOrgId]);

  useEffect(() => {
    if (!selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  const openAreaCreate = () => {
    setEditingArea(null);
    setAreaFormName("");
    setAreaFormError(null);
    setAreaSlideOpen(true);
  };

  const openAreaEdit = (area: TableArea) => {
    setEditingArea(area);
    setAreaFormName(area.name);
    setAreaFormError(null);
    setAreaSlideOpen(true);
  };

  const openTableCreate = () => {
    setEditingTable(null);
    resetTableForm();
    setTableSlideOpen(true);
  };

  const openTableEdit = (table: TableEntity) => {
    setEditingTable(table);
    setTableFormName(table.name);
    setTableFormCapacity(table.capacity != null ? String(table.capacity) : "");
    setTableFormAreaId(table.tableAreaId ?? "");
    setTableFormStatus(table.status ?? "ACTIVE");
    setTableFormError(null);
    setTableSlideOpen(true);
  };

  const handleAreaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAreaFormError(null);
    const trimmed = areaFormName.trim();
    if (!trimmed) {
      setAreaFormError("Name is required.");
      return;
    }
    setAreaSubmitLoading(true);
    if (editingArea) {
      areaUpdateMutation.mutate(
        { tableAreaId: editingArea.id, name: trimmed },
        { onSettled: () => setAreaSubmitLoading(false) }
      );
    } else {
      areaCreateMutation.mutate(trimmed, {
        onSettled: () => setAreaSubmitLoading(false),
      });
    }
  };

  const handleTableSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTableFormError(null);
    const trimmed = tableFormName.trim();
    if (!trimmed) {
      setTableFormError("Name is required.");
      return;
    }
    const capStr = tableFormCapacity.trim();
    let cap: number | null = null;
    if (capStr !== "") {
      const parsed = parseInt(capStr, 10);
      if (Number.isNaN(parsed) || parsed < 0) {
        setTableFormError("Capacity must be a non-negative number.");
        return;
      }
      cap = parsed;
    }
    setTableSubmitLoading(true);
    const body: CreateTableBody & UpdateTableBody = {
      tableAreaId: tableFormAreaId.trim() || null,
      name: trimmed,
      capacity: cap,
      status: tableFormStatus,
    };
    if (editingTable) {
      tableUpdateMutation.mutate(
        { tableId: editingTable.id, body },
        { onSettled: () => setTableSubmitLoading(false) }
      );
    } else {
      tableCreateMutation.mutate(body, {
        onSettled: () => setTableSubmitLoading(false),
      });
    }
  };

  if (isLoading && selectedOrgId && selectedBranchId) {
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 dark:text-white">
          Tables &amp; Areas
        </h1>
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Loading…
        </div>
      </div>
    );
  }

  if (isError && selectedOrgId && selectedBranchId) {
    const message = getApiErrorMessage(error);
    const requestId = getApiErrorRequestId(error);
    return (
      <div className="min-h-0 flex-1 overflow-auto">
        <h1 className="mb-6 text-2xl font-bold text-slate-800 dark:text-white">
          Tables &amp; Areas
        </h1>
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Tables &amp; Areas
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Table areas and tables per branch. Used by operator for dine-in.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label
          htmlFor="tables-org-select"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Organization
        </label>
        <select
          id="tables-org-select"
          value={selectedOrgId}
          onChange={(e) => setSelectedOrgId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        >
          <option value="">Select organization…</option>
          {orgs.map((org: Org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
        <label
          htmlFor="tables-branch-select"
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Branch
        </label>
        <select
          id="tables-branch-select"
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        >
          <option value="">Select branch…</option>
          {branches.map((branch: Branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {selectedBranchId && (
        <>
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                Table Areas
              </h2>
              <button
                type="button"
                onClick={openAreaCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
              >
                <Plus className="h-4 w-4" />
                Add area
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              {areas.length === 0 ? (
                <p className="p-8 text-center text-slate-500 dark:text-slate-400">
                  No table areas. Add one to group tables (e.g. Patio, Main Hall).
                </p>
              ) : (
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Name
                      </th>
                      <th className="w-24 px-4 py-3" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {areas.map((area: TableArea) => (
                      <tr
                        key={area.id}
                        className="border-t border-slate-200 dark:border-slate-700"
                      >
                        <td className="px-4 py-3 text-slate-900 dark:text-white">
                          {area.name}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openAreaEdit(area)}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-slate-300"
                            aria-label={`Edit ${area.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                Tables
              </h2>
              <button
                type="button"
                onClick={openTableCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
              >
                <Plus className="h-4 w-4" />
                Add table
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              {tables.length === 0 ? (
                <p className="p-8 text-center text-slate-500 dark:text-slate-400">
                  No tables. Add tables for dine-in service.
                </p>
              ) : (
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Area
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Capacity
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Status
                      </th>
                      <th className="w-24 px-4 py-3" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {tables.map((table: TableEntity) => (
                      <tr
                        key={table.id}
                        className="border-t border-slate-200 dark:border-slate-700"
                      >
                        <td className="px-4 py-3 text-slate-900 dark:text-white">
                          {table.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {table.tableAreaId
                            ? areas.find((a) => a.id === table.tableAreaId)
                                ?.name ?? "—"
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {table.capacity ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              table.status === "ACTIVE" ||
                              table.status === "FREE" ||
                              table.status === "AVAILABLE"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400"
                                : "bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {table.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openTableEdit(table)}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-slate-300"
                            aria-label={`Edit ${table.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {totalElements > size && (
                <div className="border-t border-slate-200 px-4 py-2 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Showing {tables.length} of {totalElements} tables.
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <SlideOver
        open={areaSlideOpen}
        onClose={() => setAreaSlideOpen(false)}
        title={editingArea ? "Edit table area" : "Add table area"}
      >
        <form onSubmit={handleAreaSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="area-name"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Name
            </label>
            <input
              id="area-name"
              type="text"
              value={areaFormName}
              onChange={(e) => setAreaFormName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              placeholder="e.g. Patio, Main Hall"
            />
            {areaFormError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {areaFormError}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAreaSlideOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={areaSubmitLoading}
              className="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-500 disabled:opacity-50"
            >
              {areaSubmitLoading ? "Saving…" : editingArea ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </SlideOver>

      <SlideOver
        open={tableSlideOpen}
        onClose={() => setTableSlideOpen(false)}
        title={editingTable ? "Edit table" : "Add table"}
      >
        <form onSubmit={handleTableSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="table-name"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Name
            </label>
            <input
              id="table-name"
              type="text"
              value={tableFormName}
              onChange={(e) => setTableFormName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              placeholder="e.g. T1, A-1"
            />
          </div>
          <div>
            <label
              htmlFor="table-area"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Area
            </label>
            <select
              id="table-area"
              value={tableFormAreaId}
              onChange={(e) => setTableFormAreaId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <option value="">None</option>
              {areas.map((a: TableArea) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="table-capacity"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Capacity
            </label>
            <input
              id="table-capacity"
              type="number"
              min="0"
              value={tableFormCapacity}
              onChange={(e) => setTableFormCapacity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              placeholder="Optional"
            />
          </div>
          {editingTable && (
            <div>
              <label
                htmlFor="table-status"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Status
              </label>
              <select
                id="table-status"
                value={tableFormStatus}
                onChange={(e) => setTableFormStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="FREE">FREE</option>
                <option value="OCCUPIED">OCCUPIED</option>
              </select>
            </div>
          )}
          {tableFormError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {tableFormError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setTableSlideOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={tableSubmitLoading}
              className="rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-500 disabled:opacity-50"
            >
              {tableSubmitLoading ? "Saving…" : editingTable ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
