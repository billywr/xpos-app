import { useEffect } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { Store, LayoutDashboard, LogOut, Sun, Moon } from "lucide-react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { clearCredentials } from "@/store/slices/authSlice";
import { clearContext } from "@/store/slices/orgContextSlice";
import { selectToken, selectIamUserId } from "@/store/selectors/authSelectors";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { useTheme } from "@/contexts/ThemeContext";
import { set401Handler } from "@/api/client";
import { clearStoredAuth } from "@/utils/authStorage";
import { clearStoredContext } from "@/utils/contextStorage";

const IDLE_LOGOUT_MS = 5 * 60 * 1000; // 5 minutes

export function Layout() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectToken);
  const iamUserId = useAppSelector(selectIamUserId);
  const { theme, toggleTheme } = useTheme();

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
  }, IDLE_LOGOUT_MS);

  const handleLogout = () => {
    clearStoredAuth();
    clearStoredContext();
    dispatch(clearCredentials());
    dispatch(clearContext());
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-app">
      <header className="border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Link
              to="/"
              className="flex items-center gap-2 font-semibold text-primary-700 dark:text-primary-400"
            >
              <Store className="h-7 w-7" />
              <span>XPOS</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                to="/"
                className="flex items-center gap-1.5 text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
              >
                <LayoutDashboard className="h-4 w-4" />
                Home
              </Link>
              <Link
                to="/admin"
                className="text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
              >
                Admin
              </Link>
              <Link
                to="/operator"
                className="text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
              >
                Operator
              </Link>
              <Link
                to="/select-context"
                className="text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
              >
                Context
              </Link>
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              {token && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-slate-600 hover:text-primary-600 dark:text-slate-300 dark:hover:text-primary-400"
                  aria-label="Log out"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">{iamUserId ?? "User"}</span>
                  <span className="sm:ml-1">Logout</span>
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
