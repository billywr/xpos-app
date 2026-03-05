import { Outlet, Link, NavLink, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings,
  Store,
  Sun,
  Moon,
  UtensilsCrossed,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useTheme } from "@/contexts/ThemeContext";
import {
  selectOrgId,
  selectOrgName,
  selectBranchName,
  selectTerminalName,
} from "@/store/selectors/orgContextSelectors";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchMe } from "@/api/me";
import { clearCredentials } from "@/store/slices/authSlice";
import { clearContext } from "@/store/slices/orgContextSlice";
import { clearStoredAuth } from "@/utils/authStorage";
import { clearStoredContext } from "@/utils/contextStorage";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import { isOperatorNavItemVisible } from "@/hooks/useOperatorNavVisibility";
import { OPERATOR_NAV_ITEMS } from "@/config/operatorNavItems";
import { APP_NAME_KEY } from "@/config/headerNavItems";

const MANAGE_TABLE_SUB_ITEMS = [
  { to: "/operator/tables/booked", label: "Booked" },
  { to: "/operator/tables/active", label: "Active" },
  { to: "/operator/tables/running", label: "Running Order" },
];

function isVisible(
  path: string,
  canHide: boolean,
  visibilityState: Record<string, boolean> | null
): boolean {
  if (!visibilityState) return true;
  return isOperatorNavItemVisible(path, canHide, visibilityState);
}

const ME_QUERY_KEY = "me";

export function OperatorLayout() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, toggleSidebar] = useSidebarCollapsed();
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const orgName = useAppSelector(selectOrgName);
  const branchName = useAppSelector(selectBranchName);
  const terminalName = useAppSelector(selectTerminalName);
  const navVisibility = useNavVisibilityContextOrNull();

  const { data: meData } = useQuery({
    queryKey: [ME_QUERY_KEY, token, orgId],
    queryFn: () => fetchMe(token, orgId!),
    enabled: Boolean(token && orgId),
  });

  const displayName = meData?.profile?.displayName ?? meData?.username ?? "User";
  const displayInitial = displayName.charAt(0).toUpperCase() || "U";
  const [globalError, setGlobalError] = useState<{ message: string; requestId: string } | null>(null);
  const [manageOpen, setManageOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const visibilityState = navVisibility?.operatorVisibility ?? null;
  const getOperatorLabel = navVisibility?.getOperatorLabel ?? ((_, defaultLabel) => defaultLabel);
  const getHeaderLabel = navVisibility?.getHeaderLabel ?? ((_, l) => l);
  const getHeaderLogo = navVisibility?.getHeaderLogo ?? (() => null);
  const appName = navVisibility ? getHeaderLabel(APP_NAME_KEY, "XPOS") : "XPOS";
  const logoUrl = navVisibility ? getHeaderLogo() : null;

  const visibleMainNavItems = useMemo(
    () =>
      OPERATOR_NAV_ITEMS.filter(
        (item) =>
          item.group === "Main" &&
          !item.isGroup &&
          isVisible(item.to, item.canHide, visibilityState)
      ),
    [visibilityState]
  );

  const showManageTable = useMemo(
    () =>
      isVisible(
        "/operator/tables",
        true,
        visibilityState
      ),
    [visibilityState]
  );

  const visibleOtherManageItems = useMemo(
    () =>
      OPERATOR_NAV_ITEMS.filter(
        (item) =>
          item.group === "Manage" &&
          !item.isGroup &&
          isVisible(item.to, item.canHide, visibilityState)
      ),
    [visibilityState]
  );

  const handleLogout = () => {
    clearStoredAuth();
    clearStoredContext();
    dispatch(clearCredentials());
    dispatch(clearContext());
    navigate("/login", { replace: true });
  };

  const HEADER_HEIGHT = "3.5rem"; // h-14

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 dark:bg-darkBg dark:text-white">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-darkNav">
        <div className="flex items-center gap-3">
          <Link
            to="/operator"
            className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="h-8 w-8 rounded-lg object-contain"
                aria-hidden
              />
            ) : (
              <Store className="h-8 w-8 rounded-lg bg-primary-500 p-1.5 text-white" />
            )}
            <span className="hidden sm:inline">{appName} Cashier</span>
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
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-white/60" />
            <input
              type="search"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-white/20 dark:bg-darkSurface dark:text-white dark:placeholder-white/50"
            />
          </div>
          <span className="text-sm text-slate-500 dark:text-white/70">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 dark:bg-darkSurface">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-300 text-sm font-medium text-slate-600 dark:bg-white/20 dark:text-white">
              {displayInitial}
            </div>
            <span className="hidden text-sm text-slate-700 sm:inline dark:text-white">
              {displayName}
            </span>
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={`flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 dark:border-white/10 dark:bg-darkNav ${
            collapsed ? "w-[4.25rem]" : "w-56"
          }`}
          style={{ minHeight: `calc(100vh - ${HEADER_HEIGHT})` }}
        >
          <div className="flex items-center justify-end border-b border-slate-200 p-2 dark:border-white/10">
            <button
              type="button"
              onClick={toggleSidebar}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
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
            {visibleMainNavItems.map(({ to, label, icon: Icon, end }) => {
              const displayLabel = getOperatorLabel(to, label);
              return (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={displayLabel}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    collapsed ? "justify-center" : ""
                  } ${
                    isActive
                      ? "bg-indigo-600 text-white dark:bg-indigo-500"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                  }`
                }
              >
                {Icon && <Icon className="h-5 w-5 shrink-0" />}
                {!collapsed && <span>{displayLabel}</span>}
              </NavLink>
            );
            })}
            {!collapsed && (showManageTable || visibleOtherManageItems.length > 0) && (
              <>
                <div className="my-2 border-t border-slate-200 dark:border-white/10" />
                {showManageTable && (
                  <>
                    <button
                      type="button"
                      onClick={() => setManageOpen(!manageOpen)}
                      title={getOperatorLabel("/operator/tables", "Manage Table")}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      <span className="flex items-center gap-3">
                        <UtensilsCrossed className="h-5 w-5 shrink-0" />
                        {getOperatorLabel("/operator/tables", "Manage Table")}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition ${manageOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {manageOpen && (
                      <div className="ml-4 flex flex-col gap-1 border-l border-slate-200 pl-2 dark:border-white/10">
                        {MANAGE_TABLE_SUB_ITEMS.map(({ to, label }) => {
                          const displayLabel = getOperatorLabel(to, label);
                          return (
                          <NavLink
                            key={to}
                            to={to}
                            title={displayLabel}
                            className={({ isActive }) =>
                              `rounded-lg px-2 py-1.5 text-sm ${
                                isActive
                                  ? "bg-indigo-600 text-white dark:bg-indigo-500"
                                  : "text-slate-500 hover:text-slate-900 dark:text-white/80 dark:hover:text-white"
                              }`
                            }
                          >
                            {displayLabel}
                          </NavLink>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
                {visibleOtherManageItems.map(({ to, label, icon: Icon }) => {
                  const displayLabel = getOperatorLabel(to, label);
                  return (
                  <NavLink
                    key={to}
                    to={to}
                    title={displayLabel}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? "bg-indigo-600 text-white dark:bg-indigo-500"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                      }`
                    }
                  >
                    {Icon && <Icon className="h-5 w-5 shrink-0" />}
                    {displayLabel}
                  </NavLink>
                  );
                })}
              </>
            )}
            <div className="my-2 border-t border-slate-200 dark:border-white/10" />
            {!collapsed && (
              <Link
                to="/settings"
                title="Settings"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
              >
                <Settings className="h-5 w-5 shrink-0" />
                Settings
              </Link>
            )}
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white ${collapsed ? "justify-center" : ""}`}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Logout</span>}
            </button>
          </nav>
        </aside>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-darkBg">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
