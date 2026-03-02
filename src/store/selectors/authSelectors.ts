import type { RootState } from "@/store";

export const selectToken = (state: RootState): string | null => state.auth.token;

export const selectIamUserId = (state: RootState): string | null =>
  state.auth.iamUserId;

export const selectIsAuthenticated = (state: RootState): boolean =>
  Boolean(state.auth.token);
