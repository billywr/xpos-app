import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { fetchOperatorTables } from "@/api/tables";
import { selectToken } from "@/store/selectors/authSelectors";
import {
  selectOrgId,
  selectBranchId,
} from "@/store/selectors/orgContextSelectors";
import { setTableId } from "@/store/slices/cartSlice";
import type { TableEntityList } from "@/types/sales";
import { UtensilsCrossed } from "lucide-react";

const TABS = [
  { path: "booked", label: "Booked" },
  { path: "active", label: "Active" },
  { path: "running", label: "Running Order" },
];

function statusMatches(status: string, tabPath: string): boolean {
  const s = (status ?? "").toUpperCase();
  const t = (tabPath ?? "").toUpperCase();
  if (t === "BOOKED") return s === "BOOKED";
  if (t === "ACTIVE") return s === "ACTIVE" || s === "FREE" || s === "AVAILABLE";
  if (t === "RUNNING") return s === "RUNNING" || s === "OCCUPIED" || s === "IN_USE";
  return true;
}

export function TablesPage() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab =
    TABS.find((t) => location.pathname.endsWith(`/tables/${t.path}`))?.path ??
    "active";

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["operatorTables", orgId, branchId],
    queryFn: () => fetchOperatorTables(token, orgId!, branchId!),
    enabled: Boolean(orgId && branchId && token),
  });

  const filteredTables = useMemo(() => {
    return tables.filter((t: TableEntityList) =>
      statusMatches(t.status, currentTab)
    );
  }, [tables, currentTab]);

  const handleSelectTable = (tableId: string) => {
    dispatch(setTableId(tableId));
    navigate("/operator/menu-order");
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Tables
        </h2>
      </div>
      <div className="mb-4 flex shrink-0 gap-2">
        {TABS.map(({ path, label }) => (
          <Link
            key={path}
            to={`/operator/tables/${path}`}
            className={`min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              currentTab === path
                ? "bg-primary-600 text-white"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700"
              />
            ))}
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-600 dark:bg-slate-800/50">
            <UtensilsCrossed className="mb-2 h-12 w-12 text-slate-400 dark:text-slate-500" />
            <p className="text-slate-600 dark:text-slate-400">
              No tables in this category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {filteredTables.map((table: TableEntityList) => (
              <button
                key={table.id}
                type="button"
                onClick={() => handleSelectTable(table.id)}
                className="flex flex-col items-stretch rounded-2xl border-2 border-slate-200 bg-white p-4 text-left shadow transition hover:border-primary-400 hover:shadow-md dark:border-slate-600 dark:bg-slate-800 dark:hover:border-primary-500"
              >
                <span className="font-semibold text-slate-900 dark:text-white">
                  {table.name}
                </span>
                {table.capacity != null && (
                  <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Capacity: {table.capacity}
                  </span>
                )}
                <span
                  className={`mt-2 inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
                    table.status === "FREE" || table.status === "AVAILABLE"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400"
                      : "bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-300"
                  }`}
                >
                  {table.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
