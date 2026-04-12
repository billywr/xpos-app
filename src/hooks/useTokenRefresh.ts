import { useEffect, useRef } from "react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { setCredentials } from "@/store/slices/authSlice";
import { selectExpiresAt, selectRefreshToken } from "@/store/selectors/authSelectors";
import { refreshAccessToken } from "@/api/auth";
import { setStoredAuth, getStoredAuth } from "@/utils/authStorage";
import { getEnv } from "@/utils/env";
import { getRolesFromToken, getUsernameFromToken } from "@/utils/jwt";

/** Refresh the access token 60 seconds before it expires. */
const REFRESH_AHEAD_MS = 60_000;

/**
 * Proactively refreshes the Keycloak access token before it expires.
 *
 * Without this, the first API call after token expiry returns 401 and the
 * user gets booted to the login page — even if they're actively using the app.
 */
export function useTokenRefresh() {
  const dispatch = useAppDispatch();
  const expiresAt = useAppSelector(selectExpiresAt);
  const refreshToken = useAppSelector(selectRefreshToken);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!expiresAt || !refreshToken) return;

    const remaining = expiresAt - Date.now() - REFRESH_AHEAD_MS;

    // If already past the refresh window, refresh immediately.
    // If the token is already fully expired, skip — the 401 handler will redirect.
    if (remaining < 0 && expiresAt > Date.now()) {
      doRefresh();
      return;
    }
    if (remaining < 0) return;

    const timerId = setTimeout(doRefresh, remaining);
    return () => clearTimeout(timerId);

    function doRefresh() {
      if (refreshingRef.current) return;
      refreshingRef.current = true;

      const keycloakUrl = getEnv("VITE_KEYCLOAK_URL") ?? "";
      const realm = getEnv("VITE_KEYCLOAK_REALM") ?? "xpos";
      const clientId = getEnv("VITE_KEYCLOAK_CLIENT_ID") ?? "xpos-client-api";

      // Read the latest refresh token from storage in case another tab refreshed first
      const stored = getStoredAuth();
      const currentRefreshToken = stored?.refreshToken ?? refreshToken;

      refreshAccessToken({
        keycloakUrl,
        realm,
        clientId,
        refreshToken: currentRefreshToken!,
      })
        .then((result) => {
          const roles = getRolesFromToken(result.token);
          const username = getUsernameFromToken(result.token);
          dispatch(
            setCredentials({
              token: result.token,
              iamUserId: result.iamUserId,
              username: username ?? undefined,
              expiresAt: result.expiresAt ?? undefined,
              refreshToken: result.refreshToken,
              roles,
            }),
          );
          setStoredAuth({
            token: result.token,
            iamUserId: result.iamUserId,
            username,
            expiresAt: result.expiresAt ?? null,
            refreshToken: result.refreshToken,
            roles,
          });
        })
        .catch(() => {
          // Refresh failed (e.g. refresh token expired). The next API call will
          // 401 and the on401 handler in Layout will redirect to login.
        })
        .finally(() => {
          refreshingRef.current = false;
        });
    }
  }, [expiresAt, refreshToken, dispatch]);
}
