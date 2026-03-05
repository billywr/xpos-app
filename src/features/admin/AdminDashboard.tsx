import { Link } from "react-router-dom";
import { Building2, MapPin, Package, Users } from "lucide-react";
import { FLOATING_MENU_CARD } from "@/utils/floatingCardClasses";
import { PageHeader } from "@/components/PageHeader";

export function AdminDashboard() {
  return (
    <div>
      <PageHeader
        title="Admin"
        subtitle="Manage organizations, branches, terminals, catalog, and staff."
        fallbackTo="/"
      />
      <div
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
        role="region"
        aria-label="Admin menu"
      >
        <Link
          to="/admin/orgs"
          className={FLOATING_MENU_CARD}
        >
            <div className="rounded-lg bg-primary-100/80 p-3 dark:bg-primary-900/30">
              <Building2 className="h-8 w-8 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-white">Organizations</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">List and manage orgs</p>
            </div>
        </Link>
        <Link
          to="/admin/branches"
          className={FLOATING_MENU_CARD}
        >
            <div className="rounded-lg bg-surface-200/80 p-3 dark:bg-slate-600/50">
              <MapPin className="h-8 w-8 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-white">Branches</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Per-org branches</p>
            </div>
        </Link>
        <Link
          to="/admin/catalog"
          className={FLOATING_MENU_CARD}
        >
            <div className="rounded-lg bg-surface-200/80 p-3 dark:bg-slate-600/50">
              <Package className="h-8 w-8 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-white">Catalog</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Categories &amp; items</p>
            </div>
        </Link>
        <Link
          to="/admin/staff"
          className={FLOATING_MENU_CARD}
        >
            <div className="rounded-lg bg-surface-200/80 p-3 dark:bg-slate-600/50">
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
