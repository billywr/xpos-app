import { createSlice } from "@reduxjs/toolkit";

export interface AuthState {
  token: string | null;
  iamUserId: string | null;
  username: string | null;
  expiresAt: number | null;
  roles: string[];
}

const initialState: AuthState = {
  token: null,
  iamUserId: null,
  username: null,
  expiresAt: null,
  roles: [],
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: {
        payload: {
          token: string;
          iamUserId: string;
          username?: string;
          expiresAt?: number;
          roles?: string[];
        };
      }
    ) => {
      state.token = action.payload.token;
      state.iamUserId = action.payload.iamUserId;
      state.username = action.payload.username ?? null;
      state.expiresAt = action.payload.expiresAt ?? null;
      state.roles = action.payload.roles ?? [];
    },
    clearCredentials: (state) => {
      state.token = null;
      state.iamUserId = null;
      state.username = null;
      state.expiresAt = null;
      state.roles = [];
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
