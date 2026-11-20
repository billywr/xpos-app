import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { useAdminContextSelection } from "@/hooks/useAdminContextSelection";
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
import type { TableArea, TableEntity } from "@/types/sales";
import { PageHeader } from "@/components/PageHeader";
import { TablesPage } from "@/features/operator/TablesPage";
import {
  Badge,
  Button,
  IconButton,
  SlideOver,
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
import { useDataTable } from "@/hooks/useDataTable";
import { getApiErrorMessage, getApiErrorRequestId } from "@/utils/apiError";
import { useToast } from "@/contexts/ToastContext";
import { Plus, Pencil } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const DEFAULT_PAGE_SIZE = 25;
const TABLE_AREA_SORT = {
  name: (row: TableArea) => row.name,
};
const TABLE_SORT = {
  name: (row: TableEntity) => row.name,
  area: (row: TableEntity) => row.tableAreaId ?? "",
  capacity: (row: TableEntity) => row.capacity ?? Number.NEGATIVE_INFINITY,
  status: (row: TableEntity) => row.status ?? "",
};

export function AdminTablesPage() {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const {
    selectedOrgId,
    setSelectedOrgId,
    selectedBranchId,
    setSelectedBranchId,
    orgs,
    branches,
    orgSelectOptions,
    branchSelectOptions,
  } = useAdminContextSelection();
  const page = 0;
  const size = DEFAULT_PAGE_SIZE;

  const [viewMode, setViewMode] = useState<"setup" | "floor">("setup");
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

  const { data: areasData, refetch: refetchAreas, isFetching: isAreasFetching } = useQuery({
    queryKey: ["admin-table-areas", token, selectedOrgId, selectedBranchId],
    queryFn: () =>
      fetchTableAreas(token, selectedOrgId, selectedBranchId, {
        page: 0,
        size: 100,
      }),
    enabled: Boolean(token) && Boolean(selectedOrgId) && Boolean(selectedBranchId),
  });

  const tablesQuery = useQuery({
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
  const { data: tablesData, isError, error, refetch: refetchTables } = tablesQuery;
  const { isInitialLoad, isRefreshing: isTablesRefreshing } = useQueryDisplay(tablesQuery);

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

  const areas = areasData?.content ?? [];
  const tables = tablesData?.content ?? [];
  const {
    searchQuery: areasSearchQuery,
    setSearchQuery: setAreasSearchQuery,
    filteredRows: filteredAreas,
    sortColumn: areaSortColumn,
    sortDirection: areaSortDirection,
    toggleSort: toggleAreaSort,
  } = useDataTable(areas, "areas", { sortAccessors: TABLE_AREA_SORT });
  const {
    searchQuery: tablesSearchQuery,
    setSearchQuery: setTablesSearchQuery,
    filteredRows: filteredTables,
    sortColumn: tableSortColumn,
    sortDirection: tableSortDirection,
    toggleSort: toggleTableSort,
  } = useDataTable(tables, "tables", { sortAccessors: TABLE_SORT });
  const totalElements = tablesData?.totalElements ?? 0;

  const showTableAreaCol = useMemo(
    () =>
      filteredTables.some((t: TableEntity) => {
        if (!t.tableAreaId) return false;
        const areaName = areas.find((a) => a.id === t.tableAreaId)?.name;
        return !!areaName && areaName.trim() !== "";
      }),
    [filteredTables, areas]
  );
  const showTableCapacityCol = useMemo(
    () => filteredTables.some((t: TableEntity) => t.capacity != null),
    [filteredTables]
  );



  const tableAreaOptions = useMemo(
    () => [
      { value: "", label: "None" },
      ...areas.map((a: TableArea) => ({ value: a.id, label: a.name })),
    ],
    [areas]
  );

  const tableStatusOptions = useMemo(
    () => [
      { value: "ACTIVE", label: "ACTIVE" },
      { value: "INACTIVE", label: "INACTIVE" },
      { value: "FREE", label: "FREE" },
      { value: "OCCUPIED", label: "OCCUPIED" },
    ],
    []
  );

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

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PageHeader
        title="Tables & areas"
        subtitle="Table areas and tables per branch. Used by operator for dine-in."
        fallbackTo="/admin"
      />

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setViewMode("setup")}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
            viewMode === "setup"
              ? "bg-primary-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
          }`}
        >
          Table & area setup
        </button>
        <button
          type="button"
          onClick={() => setViewMode("floor")}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
            viewMode === "floor"
              ? "bg-primary-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
          }`}
        >
          Active floor & orders
        </button>
      </div>

      {viewMode === "floor" ? (
        <TablesPage />
      ) : (
        <>

      {(orgs.length > 1 || branches.length > 1) && (
        <div className="mb-4 flex flex-wrap items-end gap-4">
          {orgs.length > 1 && (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="tables-org-select"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Organization
              </label>
              <SearchableSelect
                id="tables-org-select"
                options={orgSelectOptions}
                value={selectedOrgId}
                onChange={setSelectedOrgId}
                placeholder="Search organization…"
                className="w-full sm:w-56"
                controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
              />
            </div>
          )}
          {branches.length > 1 && (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="tables-branch-select"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Branch
              </label>
              <SearchableSelect
                id="tables-branch-select"
                options={branchSelectOptions}
                value={selectedBranchId}
                onChange={setSelectedBranchId}
                placeholder="Search branch…"
                className="w-full sm:w-56"
                controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
              />
            </div>
          )}
        </div>
      )}

      {selectedBranchId && (
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
          <section className="mb-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  Table Areas
                </h2>
                <TableSearchInput
                  value={areasSearchQuery}
                  onChange={setAreasSearchQuery}
                  placeholder="Search areas…"
                  className="w-full sm:w-64"
                  onRefresh={() => void refetchAreas()}
                  isRefreshing={isAreasFetching}
                />
              </div>
              <Button onClick={openAreaCreate}>
                <Plus className="h-4 w-4" />
                Add area
              </Button>
            </div>
            <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">← swipe table to see all columns →</p>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              {filteredAreas.length === 0 ? (
                <p className="p-8 text-center text-slate-500 dark:text-slate-400">
                  {areas.length === 0 ? "No table areas. Add one to group tables (e.g. Patio, Main Hall)." : "No results match your search."}
                </p>
              ) : (
                <div className="relative overflow-auto">
                  <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
                <table className="w-full divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "280px" }}>
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <TableRowNumberHead />
                      <SortableTableHead
                        columnKey="name"
                        label="Name"
                        sortColumn={areaSortColumn}
                        sortDirection={areaSortDirection}
                        onSort={toggleAreaSort}
                        className={`${tableStickyHeadCell} ${tableHeadCell}`}
                      />
                      <SortableTableHead
                        columnKey="actions"
                        label=""
                        sortColumn={areaSortColumn}
                        sortDirection={areaSortDirection}
                        onSort={toggleAreaSort}
                        sortable={false}
                        className="w-24 px-4 py-3 sm:px-6 sm:py-3"
                        title="Actions"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAreas.map((area: TableArea, index) => (
                      <tr
                        key={area.id}
                        className="border-t border-slate-200 dark:border-slate-700"
                      >
                        <TableRowNumberCell
                          page={0}
                          pageSize={filteredAreas.length || 1}
                          indexInPage={index}
                        />
                        <td className={tableStickyFirstBody}>
                          {area.name}
                        </td>
                        <td className={tableBodyCell}>
                          <IconButton
                            onClick={() => openAreaEdit(area)}
                            title={`Edit ${area.name}`}
                            aria-label={`Edit ${area.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  Tables
                </h2>
                <TableSearchInput
                  value={tablesSearchQuery}
                  onChange={setTablesSearchQuery}
                  placeholder="Search tables…"
                  className="w-full sm:w-64"
                  onRefresh={() => void refetchTables()}
                  isRefreshing={isTablesRefreshing}
                />
              </div>
              <Button onClick={openTableCreate}>
                <Plus className="h-4 w-4" />
                Add table
              </Button>
            </div>
            <p className="mb-1 text-center text-[11px] text-slate-400 sm:hidden dark:text-slate-500">← swipe table to see all columns →</p>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <div className="relative overflow-auto">
                <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-6 bg-gradient-to-l from-white/80 to-transparent sm:hidden dark:from-slate-800/80" />
                <table className="w-full divide-y divide-slate-200 dark:divide-slate-700" style={{ minWidth: "500px" }}>
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <TableRowNumberHead />
                      <SortableTableHead
                        columnKey="name"
                        label="Name"
                        sortColumn={tableSortColumn}
                        sortDirection={tableSortDirection}
                        onSort={toggleTableSort}
                        className={`${tableStickyHeadCell} ${tableHeadCell}`}
                      />
                      {showTableAreaCol && (
                        <SortableTableHead
                          columnKey="area"
                          label="Area"
                          sortColumn={tableSortColumn}
                          sortDirection={tableSortDirection}
                          onSort={toggleTableSort}
                          className={tableHeadCell}
                        />
                      )}
                      {showTableCapacityCol && (
                        <SortableTableHead
                          columnKey="capacity"
                          label="Capacity"
                          sortColumn={tableSortColumn}
                          sortDirection={tableSortDirection}
                          onSort={toggleTableSort}
                          className={tableHeadCell}
                        />
                      )}
                      <SortableTableHead
                        columnKey="status"
                        label="Status"
                        sortColumn={tableSortColumn}
                        sortDirection={tableSortDirection}
                        onSort={toggleTableSort}
                        className={tableHeadCell}
                      />
                      <SortableTableHead
                        columnKey="actions"
                        label=""
                        sortColumn={tableSortColumn}
                        sortDirection={tableSortDirection}
                        onSort={toggleTableSort}
                        sortable={false}
                        className="w-24 px-4 py-3 sm:px-6 sm:py-3"
                        title="Actions"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {isInitialLoad ? (
                      <TableSkeleton columns={6} />
                    ) : filteredTables.length === 0 ? (
                      <tr>
                        <td
                          colSpan={
                            4 +
                            (showTableAreaCol ? 1 : 0) +
                            (showTableCapacityCol ? 1 : 0)
                          }
                          className={tableEmptyCell}
                        >
                          {tables.length === 0
                            ? "No tables. Add tables for dine-in service."
                            : "No results match your search."}
                        </td>
                      </tr>
                    ) : (
                      filteredTables.map((table: TableEntity, index) => (
                      <tr
                        key={table.id}
                        className={`${tableBodyRow} border-t border-slate-200 dark:border-slate-700`}
                      >
                        <TableRowNumberCell page={page} pageSize={size} indexInPage={index} />
                        <td className={tableStickyFirstBody}>
                          {table.name}
                        </td>
                        {showTableAreaCol && (
                          <td className={tableBodyCell}>
                            {table.tableAreaId
                              ? areas.find((a) => a.id === table.tableAreaId)
                                  ?.name ?? "—"
                              : "—"}
                          </td>
                        )}
                        {showTableCapacityCol && (
                          <td className={tableBodyCell}>
                            {table.capacity ?? "—"}
                          </td>
                        )}
                        <td className={tableBodyCell}>
                          <Badge status={table.status}>{table.status}</Badge>
                        </td>
                        <td className={tableBodyCell}>
                          <IconButton
                            onClick={() => openTableEdit(table)}
                            title={`Edit ${table.name}`}
                            aria-label={`Edit ${table.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                        </td>
                      </tr>
                    ))
                    )}
                  </tbody>
                </table>
              </div>
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
            <FormLabel htmlFor="area-name">
              Name
            </FormLabel>
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
          <div className="grid grid-cols-2 gap-3 pt-4">
            <Button type="submit" size="md" className="w-full" disabled={areaSubmitLoading}>
              {areaSubmitLoading ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" size="md" className="w-full" onClick={() => setAreaSlideOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SlideOver>

      <SlideOver
        open={tableSlideOpen}
        onClose={() => setTableSlideOpen(false)}
        title={editingTable ? "Edit table" : "Add table"}
      >
        <form onSubmit={handleTableSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FormLabel htmlFor="table-name">
                Name
              </FormLabel>
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
              <FormLabel htmlFor="table-area">
                Area
              </FormLabel>
              <SearchableSelect
                id="table-area"
                options={tableAreaOptions}
                value={tableFormAreaId}
                onChange={setTableFormAreaId}
                placeholder="Search area…"
                className="mt-1 w-full"
                controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
              />
            </div>
            <div className={editingTable ? "" : "col-span-1 sm:col-span-2"}>
              <FormLabel htmlFor="table-capacity">
                Capacity
              </FormLabel>
              <input
                id="table-capacity"
                type="number"
                min="0"
                value={tableFormCapacity}
                onChange={(e) => setTableFormCapacity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                placeholder="e.g. 4"
              />
            </div>
            {editingTable && (
              <div>
                <FormLabel htmlFor="table-status">
                  Status
                </FormLabel>
                <SearchableSelect
                  id="table-status"
                  options={tableStatusOptions}
                  value={tableFormStatus}
                  onChange={setTableFormStatus}
                  placeholder="Search status…"
                  className="mt-1 w-full"
                  controlClassName="focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500"
                />
              </div>
            )}
          </div>
          {tableFormError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {tableFormError}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <Button type="submit" size="md" className="w-full" disabled={tableSubmitLoading}>
              {tableSubmitLoading ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" size="md" className="w-full" onClick={() => setTableSlideOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SlideOver>
      </>
      )}
    </div>
  );
}
