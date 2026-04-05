import { Link, Navigate } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Settings } from "lucide-react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectIsAdmin, selectIsOperator } from "@/store/selectors/authSelectors";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import { APP_NAME_KEY } from "@/config/headerNavItems";
import { FLOATING_MENU_CARD } from "@/utils/floatingCardClasses";
import { PageHeader } from "@/components/PageHeader";

export function HomePage() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const isOperator = useAppSelector(selectIsOperator);
  const navVisibility = useNavVisibilityContextOrNull();
  const getHeaderLabel = navVisibility?.getHeaderLabel ?? ((_, l) => l);
  const appName = navVisibility ? getHeaderLabel(APP_NAME_KEY, "XPOS") : "XPOS";

  // Auto-redirect if user has only one role
  if (isAdmin && !isOperator) return <Navigate to="/admin" replace />;
  if (isOperator && !isAdmin) return <Navigate to="/operator" replace />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title={`Welcome to ${appName}`}
        subtitle="Multi-vertical POS for Kenya. Choose Admin to manage org, catalog and staff, or Operator to run the till."
        fallbackTo="/"
      />
      <div className="mt-2 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/admin"
          className={`${FLOATING_MENU_CARD} p-6`}
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
          className={`${FLOATING_MENU_CARD} p-6`}
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
          className={`${FLOATING_MENU_CARD} p-6`}
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
