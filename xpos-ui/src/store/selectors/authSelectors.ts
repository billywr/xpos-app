import type { RootState } from "@/store";
import { getEnv } from "@/utils/env";

const ROLE_ADMIN = getEnv("VITE_ROLE_ADMIN") ?? "xpos-admin";
const ROLE_OPERATOR = getEnv("VITE_ROLE_OPERATOR") ?? "xpos-operator";

export { ROLE_ADMIN, ROLE_OPERATOR };

export const selectToken = (state: RootState): string | null => state.auth.token;

export const selectIamUserId = (state: RootState): string | null =>
  state.auth.iamUserId;

export const selectUsername = (state: RootState): string | null =>
  state.auth.username;

export const selectIsAuthenticated = (state: RootState): boolean =>
  Boolean(state.auth.token);

export const selectRoles = (state: RootState): string[] => state.auth.roles;

export const selectIsAdmin = (state: RootState): boolean =>
  state.auth.roles.includes(ROLE_ADMIN);

export const selectIsOperator = (state: RootState): boolean =>
  state.auth.roles.includes(ROLE_OPERATOR);

export const selectExpiresAt = (state: RootState): number | null =>
  state.auth.expiresAt;

export const selectRefreshToken = (state: RootState): string | null =>
  state.auth.refreshToken;
