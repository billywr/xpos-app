import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { setCredentials } from "@/store/slices/authSlice";
import { loginWithPassword } from "@/api/auth";
import { setStoredAuth } from "@/utils/authStorage";
import { getStoredBranding } from "@/utils/brandingStorage";
import { getEnv } from "@/utils/env";
import { getRolesFromToken, getUsernameFromToken } from "@/utils/jwt";
import { Store, Settings } from "lucide-react";
import { ServerConfigModal } from "@/components/ServerConfigModal";

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/";
  const fromIdle = (location.state as { from?: string } | null)?.from === "idle";

  const branding = getStoredBranding();
  const appName = branding?.appName ?? "XPOS";
  const logoUrl = branding?.logoDataUrl ?? null;

  useEffect(() => {
    document.title = appName ? `${appName} — Sign in` : "XPOS";
  }, [appName]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);

  const keycloakUrl = getEnv("VITE_KEYCLOAK_URL") ?? "";
  const realm = getEnv("VITE_KEYCLOAK_REALM") ?? "xpos";
  const clientId = getEnv("VITE_KEYCLOAK_CLIENT_ID") ?? "xpos-client-api";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Username and password are required.");
      return;
    }
    if (!keycloakUrl) {
      setError("Login is not configured (missing VITE_KEYCLOAK_URL).");
      return;
    }
    setLoading(true);
    try {
      const { token, iamUserId, expiresAt, refreshToken } = await loginWithPassword({
        keycloakUrl,
        realm,
        clientId,
        username: username.trim(),
        password,
      });
      const roles = getRolesFromToken(token);
      const keycloakUsername = getUsernameFromToken(token);
      dispatch(setCredentials({ token, iamUserId, username: keycloakUsername ?? undefined, expiresAt: expiresAt ?? undefined, refreshToken, roles }));
      setStoredAuth({ token, iamUserId, username: keycloakUsername, expiresAt: expiresAt ?? null, refreshToken, roles });
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 dark:bg-slate-900">
      {/* Corner Server Config Button */}
      <button
        type="button"
        onClick={() => setShowServerModal(true)}
        className="absolute right-4 top-4 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-700"
        title="Server & IAM Configuration"
      >
        <Settings className="h-3.5 w-3.5 text-slate-400" />
        <span>{keycloakUrl.includes("62.169.22.51") ? "Production (Cloud)" : "Local Dev"}</span>
      </button>

      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-2 text-primary-700 dark:text-primary-400">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="h-10 w-10 object-contain"
                aria-hidden
              />
            ) : (
              <Store className="h-10 w-10" />
            )}
            <span className="text-xl font-bold">{appName}</span>
          </div>
        </div>
        <h1 className="mb-2 text-center text-lg font-semibold text-slate-800 dark:text-white">
          Sign in
        </h1>
        {fromIdle && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            You were logged out due to inactivity.
          </p>
        )}
        <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Use your credentials to access the backend.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="login-username"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Username
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              placeholder="Username"
              disabled={loading}
            />
          </div>
          <div>
            <label
              htmlFor="login-password"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              placeholder="Password"
              disabled={loading}
            />
          </div>
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
            >
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary-600 py-2.5 font-medium text-white transition hover:bg-primary-500 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <ServerConfigModal
        open={showServerModal}
        onClose={() => setShowServerModal(false)}
      />
    </div>
  );
}
