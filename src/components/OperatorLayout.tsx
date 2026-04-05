import { Outlet, Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  ChevronDown,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings,
  Store,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import {
  selectOrgId,
  selectOrgName,
  selectBranchName,
  selectTerminalName,
} from "@/store/selectors/orgContextSelectors";
import { selectToken, selectUsername } from "@/store/selectors/authSelectors";
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
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [collapsed, toggleSidebar] = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);
  const token = useAppSelector(selectToken);
  const keycloakUsername = useAppSelector(selectUsername);
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

  const displayName = keycloakUsername ?? meData?.username ?? "User";
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

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    clearStoredAuth();
    clearStoredContext();
    dispatch(clearCredentials());
    dispatch(clearContext());
    navigate("/login", { replace: true });
  };

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const HEADER_HEIGHT = "3.5rem"; // h-14

  const sidebarNav = (isMobile: boolean) => {
    const showLabels = isMobile || !collapsed;
    return (
      <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
        {visibleMainNavItems.map(({ to, label, icon: Icon, end }) => {
          const displayLabel = getOperatorLabel(to, label);
          return (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={displayLabel}
            onClick={isMobile ? closeMobile : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                !showLabels ? "justify-center" : ""
              } ${
                isActive
                  ? "bg-indigo-600 text-white dark:bg-indigo-500"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
              }`
            }
          >
            {Icon && <Icon className="h-5 w-5 shrink-0" />}
            {showLabels && <span>{displayLabel}</span>}
          </NavLink>
        );
        })}
        {showLabels && (showManageTable || visibleOtherManageItems.length > 0) && (
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
                        onClick={isMobile ? closeMobile : undefined}
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
                onClick={isMobile ? closeMobile : undefined}
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
        {showLabels && (
          <Link
            to="/settings"
            title="Settings"
            onClick={isMobile ? closeMobile : undefined}
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
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white ${!showLabels ? "justify-center" : ""}`}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {showLabels && <span>Logout</span>}
        </button>
      </nav>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 dark:bg-darkBg dark:text-white">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-3 shadow-sm sm:gap-4 sm:px-4 dark:border-white/10 dark:bg-darkNav">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 md:hidden dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
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
              <Store className="h-8 w-8 shrink-0 rounded-lg bg-primary-500 p-1.5 text-white" />
            )}
            <span className="hidden sm:inline">{appName} Cashier</span>
          </Link>
          <div className="hidden h-6 w-px bg-slate-300 md:block dark:bg-slate-600" />
          <div className="hidden items-center gap-2 sm:flex">
            <span className="max-w-[120px] truncate rounded-md bg-slate-200 px-2 py-1 text-sm font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {orgName ?? "—"}
            </span>
            <span className="text-slate-500 dark:text-slate-400">/</span>
            <span className="max-w-[200px] truncate text-sm text-slate-600 dark:text-slate-300">
              {branchName ?? "—"} · {terminalName ?? "—"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              Open
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-white/60" />
            <input
              type="search"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-white/20 dark:bg-darkSurface dark:text-white dark:placeholder-white/50"
            />
          </div>
          <span className="hidden text-sm text-slate-500 md:inline dark:text-white/70">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-2 py-1.5 sm:px-3 sm:py-2 dark:bg-darkSurface">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-300 text-xs font-medium text-slate-600 sm:h-8 sm:w-8 sm:text-sm dark:bg-white/20 dark:text-white">
              {displayInitial}
            </div>
            <span className="hidden text-sm text-slate-700 sm:inline dark:text-white">
              {displayName}
            </span>
          </div>
        </div>
      </header>

      {globalError && (
        <div className="px-3 py-2 sm:px-4">
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

      {/* Mobile context bar (org/branch/terminal) */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-1.5 text-xs sm:hidden dark:border-white/10 dark:bg-darkNav">
        <span className="truncate font-medium text-slate-700 dark:text-slate-200">
          {orgName ?? "—"}
        </span>
        <span className="text-slate-400">/</span>
        <span className="truncate text-slate-600 dark:text-slate-300">
          {branchName ?? "—"} · {terminalName ?? "—"}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400">
          <span className="h-1 w-1 rounded-full bg-emerald-600 dark:bg-emerald-400" />
          Open
        </span>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Mobile drawer overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={closeMobile}
              aria-hidden="true"
            />
            <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-darkNav">
              <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-white/10">
                <span className="font-semibold text-slate-800 dark:text-white">Menu</span>
                <button
                  type="button"
                  onClick={closeMobile}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {sidebarNav(true)}
            </aside>
          </div>
        )}

        {/* Desktop sidebar */}
        <aside
          className={`hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 md:flex dark:border-white/10 dark:bg-darkNav ${
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
          {sidebarNav(false)}
        </aside>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-darkBg">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
