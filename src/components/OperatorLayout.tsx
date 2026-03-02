import { Outlet, Link, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  BarChart3,
  Wallet,
  UtensilsCrossed,
  ChefHat,
  CreditCard,
  Receipt,
  Settings,
  LogOut,
  Store,
  ChevronDown,
  RefreshCw,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  HandCoins,
  ReceiptText,
} from "lucide-react";
import { useState } from "react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useTheme } from "@/contexts/ThemeContext";
import {
  selectOrgName,
  selectBranchName,
  selectTerminalName,
} from "@/store/selectors/orgContextSelectors";
import { clearCredentials } from "@/store/slices/authSlice";
import { clearContext } from "@/store/slices/orgContextSlice";
import { clearStoredAuth } from "@/utils/authStorage";
import { clearStoredContext } from "@/utils/contextStorage";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";

const navItems = [
  { to: "/operator", label: "Dashboard", icon: LayoutDashboard },
  { to: "/operator/menu-order", label: "Menu Order", icon: ShoppingCart },
  { to: "/operator/receipts", label: "Receipts", icon: Receipt },
  { to: "/operator/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/operator/debts", label: "Customer Debts", icon: HandCoins },
  { to: "/operator/misc-expenses", label: "Misc Expenses", icon: ReceiptText },
  { to: "/operator/withdrawal", label: "Withdrawal", icon: Wallet },
];

const manageItems = [
  { to: "/operator/tables/booked", label: "Booked", parent: "Manage Table" },
  { to: "/operator/tables/active", label: "Active", parent: "Manage Table" },
  { to: "/operator/tables/running", label: "Running Order", parent: "Manage Table" },
  { to: "/operator/dishes", label: "Manage Dish", icon: ChefHat },
  { to: "/operator/payments", label: "Manage Payment", icon: CreditCard },
];

export function OperatorLayout() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, toggleSidebar] = useSidebarCollapsed();
  const orgName = useAppSelector(selectOrgName);
  const branchName = useAppSelector(selectBranchName);
  const terminalName = useAppSelector(selectTerminalName);
  const [globalError, setGlobalError] = useState<{ message: string; requestId: string } | null>(null);
  const [manageOpen, setManageOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const handleLogout = () => {
    clearStoredAuth();
    clearStoredContext();
    dispatch(clearCredentials());
    dispatch(clearContext());
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-white">
      <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <Link
            to="/operator"
            className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"
          >
            <Store className="h-8 w-8 rounded-lg bg-primary-500 p-1.5 text-white" />
            <span className="hidden sm:inline">XPOS Cashier</span>
          </Link>
          <div className="hidden h-6 w-px bg-slate-300 dark:bg-slate-600 md:block" />
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-200 px-2 py-1 text-sm font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {orgName ?? "—"}
            </span>
            <span className="text-slate-500 dark:text-slate-400">/</span>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {branchName ?? "—"} · {terminalName ?? "—"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              Open
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
            aria-label="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="search"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
            />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-500">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-300 text-sm font-medium text-slate-600 dark:bg-slate-600 dark:text-slate-300">
              U
            </div>
            <span className="hidden text-sm text-slate-700 sm:inline dark:text-slate-300">User</span>
          </div>
        </div>
      </header>

      {globalError && (
        <div className="px-4 py-2">
          <ErrorBanner
            error={{
              timestamp: new Date().toISOString(),
              status: 0,
              error: "",
              code: "ERROR",
              message: globalError.message,
              path: "",
              requestId: globalError.requestId,
            }}
            onDismiss={() => setGlobalError(null)}
          />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 dark:border-slate-700 dark:bg-slate-800/50 ${
            collapsed ? "w-[4.25rem]" : "w-56"
          }`}
        >
          <div className="flex items-center justify-end border-b border-slate-200 p-2 dark:border-slate-700">
            <button
              type="button"
              onClick={toggleSidebar}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    collapsed ? "justify-center" : ""
                  } ${
                    isActive
                      ? "bg-primary-600 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
            {!collapsed && (
              <>
                <div className="my-2 border-t border-slate-200 dark:border-slate-600" />
                <button
                  type="button"
                  onClick={() => setManageOpen(!manageOpen)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                >
                  <span className="flex items-center gap-3">
                    <UtensilsCrossed className="h-5 w-5 shrink-0" />
                    Manage Table
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition ${manageOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {manageOpen && (
                  <div className="ml-4 flex flex-col gap-1 border-l border-slate-200 pl-2 dark:border-slate-600">
                    {manageItems
                      .filter((i) => i.parent === "Manage Table")
                      .map(({ to, label }) => (
                        <NavLink
                          key={to}
                          to={to}
                          className={({ isActive }) =>
                            `rounded-lg px-2 py-1.5 text-sm ${
                              isActive
                                ? "text-primary-600 dark:text-primary-400"
                                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                            }`
                          }
                        >
                          {label}
                        </NavLink>
                      ))}
                  </div>
                )}
                {manageItems
                  .filter((i) => !i.parent)
                  .map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                          isActive
                            ? "bg-primary-600 text-white"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                        }`
                      }
                    >
                      {Icon && <Icon className="h-5 w-5 shrink-0" />}
                      {label}
                    </NavLink>
                  ))}
              </>
            )}
            <div className="my-2 border-t border-slate-200 dark:border-slate-600" />
            {!collapsed && (
              <Link
                to="/settings"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <Settings className="h-5 w-5 shrink-0" />
                Settings
              </Link>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white ${collapsed ? "justify-center" : ""}`}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Logout</span>}
            </button>
          </nav>
        </aside>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
