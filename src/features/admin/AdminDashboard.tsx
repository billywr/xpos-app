import { Link } from "react-router-dom";
import { Building2, MapPin, Package, Users } from "lucide-react";

export function AdminDashboard() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="shrink-0 pb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Admin</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Manage organizations, branches, terminals, catalog, and staff.
        </p>
      </header>
      {/* Grid grows with content; cards use space and blend with light bluish theme */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/admin/orgs"
          className="flex items-center gap-4 rounded-xl border border-sky-200/70 bg-white/90 p-6 shadow-sm transition hover:border-primary-300 hover:shadow-md dark:border-slate-600 dark:bg-slate-800/90"
        >
          <div className="rounded-xl bg-primary-100/80 p-3 dark:bg-primary-900/30">
            <Building2 className="h-8 w-8 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">Organizations</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">List and manage orgs</p>
          </div>
        </Link>
        <Link
          to="/admin/branches"
          className="flex items-center gap-4 rounded-xl border border-sky-200/70 bg-white/90 p-6 shadow-sm transition hover:border-primary-300 hover:shadow-md dark:border-slate-600 dark:bg-slate-800/90"
        >
          <div className="rounded-xl bg-surface-200/80 p-3 dark:bg-slate-700/50">
            <MapPin className="h-8 w-8 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">Branches</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Per-org branches</p>
          </div>
        </Link>
        <Link
          to="/admin/catalog"
          className="flex items-center gap-4 rounded-xl border border-sky-200/70 bg-white/90 p-6 shadow-sm transition hover:border-primary-300 hover:shadow-md dark:border-slate-600 dark:bg-slate-800/90"
        >
          <div className="rounded-xl bg-surface-200/80 p-3 dark:bg-slate-700/50">
            <Package className="h-8 w-8 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">Catalog</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Categories &amp; items</p>
          </div>
        </Link>
        <Link
          to="/admin/staff"
          className="flex items-center gap-4 rounded-xl border border-sky-200/70 bg-white/90 p-6 shadow-sm transition hover:border-primary-300 hover:shadow-md dark:border-slate-600 dark:bg-slate-800/90"
        >
          <div className="rounded-xl bg-surface-200/80 p-3 dark:bg-slate-700/50">
            <Users className="h-8 w-8 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">Staff</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Users &amp; assignments</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
