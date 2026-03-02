import { Link } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Settings } from "lucide-react";

export function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-slate-800 dark:text-white">Welcome to XPOS</h1>
      <p className="mb-8 text-slate-600 dark:text-slate-400">
        Multi-vertical POS for Kenya. Choose Admin to manage org, catalog and staff, or Operator to run the till.
      </p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/admin"
          className="flex items-center gap-4 rounded-xl border border-sky-200/70 bg-white/90 p-6 shadow-sm transition hover:border-primary-300 hover:shadow-md dark:border-slate-600 dark:bg-slate-800/90"
        >
          <div className="rounded-xl bg-primary-100/80 p-3 dark:bg-primary-900/30">
            <Settings className="h-8 w-8 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">Admin</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Orgs, branches, catalog, staff, ledger</p>
          </div>
        </Link>
        <Link
          to="/operator"
          className="flex items-center gap-4 rounded-xl border border-sky-200/70 bg-white/90 p-6 shadow-sm transition hover:border-primary-300 hover:shadow-md dark:border-slate-600 dark:bg-slate-800/90"
        >
          <div className="rounded-xl bg-primary-100/80 p-3 dark:bg-primary-900/30">
            <ShoppingCart className="h-8 w-8 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">Operator</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">POS, sales, tenders, shift</p>
          </div>
        </Link>
        <Link
          to="/operator/analytics"
          className="flex items-center gap-4 rounded-xl border border-sky-200/70 bg-white/90 p-6 shadow-sm transition hover:border-primary-300 hover:shadow-md dark:border-slate-600 dark:bg-slate-800/90"
        >
          <div className="rounded-xl bg-primary-100/80 p-3 dark:bg-primary-900/30">
            <LayoutDashboard className="h-8 w-8 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">Dashboard</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Reports and overview</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
