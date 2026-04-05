import type { RootState } from "@/store";

export const selectToken = (state: RootState): string | null => state.auth.token;

export const selectIamUserId = (state: RootState): string | null =>
  state.auth.iamUserId;

export const selectUsername = (state: RootState): string | null =>
  state.auth.username;

export const selectIsAuthenticated = (state: RootState): boolean =>
  Boolean(state.auth.token);

export const selectRoles = (state: RootState): string[] => state.auth.roles;

export const selectIsAdmin = (state: RootState): boolean =>
  state.auth.roles.includes("xpos-admin");

export const selectIsOperator = (state: RootState): boolean =>
  state.auth.roles.includes("xpos-operator");
