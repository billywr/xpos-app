import { useEffect, useLayoutEffect, useState } from "react";
import { Outlet, Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Store, LayoutDashboard, LogOut, Sun, Moon, Menu, X } from "lucide-react";
import { ContextSelectDropdowns } from "@/components/ContextSelectDropdowns";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { clearCredentials } from "@/store/slices/authSlice";
import { clearContext } from "@/store/slices/orgContextSlice";
import { selectToken, selectIamUserId, selectUsername, selectIsAdmin, selectIsOperator } from "@/store/selectors/authSelectors";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import { isHeaderNavItemVisible } from "@/hooks/useHeaderNavVisibility";
import { APP_NAME_KEY } from "@/config/headerNavItems";
import { set401Handler } from "@/api/client";
import { clearStoredAuth } from "@/utils/authStorage";
import { clearStoredContext } from "@/utils/contextStorage";

const HEADER_NAV_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/admin", label: "Admin" },
  { to: "/operator", label: "Operator" },
  { to: "/select-context", label: "Org", end: true },
];

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectToken);
  const iamUserId = useAppSelector(selectIamUserId);
  const username = useAppSelector(selectUsername);
  const isAdmin = useAppSelector(selectIsAdmin);
  const isOperator = useAppSelector(selectIsOperator);
  const { theme, toggleTheme } = useTheme();
  const navVisibility = useNavVisibilityContextOrNull();
  const headerVisibility = navVisibility?.headerVisibility ?? {};
  const getHeaderLabel = navVisibility?.getHeaderLabel ?? ((_, l) => l);
  const getHeaderLogo = navVisibility?.getHeaderLogo ?? (() => null);
  const appName = navVisibility ? getHeaderLabel(APP_NAME_KEY, "XPOS") : "XPOS";
  const logoUrl = navVisibility ? getHeaderLogo() : null;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useLayoutEffect(() => {
    document.title = appName ? `${appName} — POS` : "XPOS";
  }, [appName]);

  useEffect(() => {
    set401Handler(() => {
      clearStoredAuth();
      clearStoredContext();
      dispatch(clearCredentials());
      dispatch(clearContext());
      navigate("/login", { replace: true });
    });
    return () => set401Handler(null);
  }, [dispatch, navigate]);

  useIdleLogout(() => {
    clearStoredAuth();
    clearStoredContext();
    dispatch(clearCredentials());
    dispatch(clearContext());
    navigate("/login", { replace: true, state: { from: "idle" } });
  });

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    clearStoredAuth();
    clearStoredContext();
    dispatch(clearCredentials());
    dispatch(clearContext());
    const returnTo = location.pathname + location.search || "/";
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
  };

  const filteredNavLinks = HEADER_NAV_LINKS.filter((item) => {
    if (item.to === "/admin" && !isAdmin) return false;
    if (item.to === "/operator" && !isOperator && !isAdmin) return false;
    return isHeaderNavItemVisible(item.to, true, headerVisibility);
  });

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-app">
      <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-darkNav/95">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="flex items-center gap-2 font-semibold text-primary-700 dark:text-white"
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-7 w-7 object-contain"
                    aria-hidden
                  />
                ) : (
                  <Store className="h-7 w-7" />
                )}
                <span className="hidden xs:inline">{appName}</span>
              </Link>
            </div>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-3 sm:flex sm:gap-4">
              {filteredNavLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${
                      isActive
                        ? "bg-primary-100 font-semibold text-primary-700 dark:bg-white/15 dark:text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-primary-600 dark:text-white/90 dark:hover:bg-white/10 dark:hover:text-white"
                    }`
                  }
                >
                  {item.to === "/" && <LayoutDashboard className="h-4 w-4" />}
                  {getHeaderLabel(item.to, item.label)}
                </NavLink>
              ))}
              <ContextSelectDropdowns />
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              {token && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-slate-600 hover:text-primary-600 dark:text-white/90 dark:hover:text-white"
                  aria-label="Log out"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden md:inline">{username ?? iamUserId ?? "User"}</span>
                  <span className="md:ml-1">Logout</span>
                </button>
              )}
            </nav>

            {/* Mobile controls */}
            <div className="flex items-center gap-2 sm:hidden">
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-3 pb-3 pt-2 sm:hidden dark:border-white/10 dark:bg-darkNav">
            <nav className="flex flex-col gap-1">
              {filteredNavLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      isActive
                        ? "bg-primary-100 font-semibold text-primary-700 dark:bg-white/15 dark:text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-primary-600 dark:text-white/90 dark:hover:bg-white/10 dark:hover:text-white"
                    }`
                  }
                >
                  {item.to === "/" && <LayoutDashboard className="h-4 w-4" />}
                  {getHeaderLabel(item.to, item.label)}
                </NavLink>
              ))}
            </nav>
            <div className="mt-2 border-t border-slate-200 pt-2 dark:border-white/10">
              <ContextSelectDropdowns />
            </div>
            {token && (
              <div className="mt-2 border-t border-slate-200 pt-2 dark:border-white/10">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-primary-600 dark:text-white/90 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  {username ?? iamUserId ?? "User"} — Logout
                </button>
              </div>
            )}
          </div>
        )}
      </header>
      <main className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
