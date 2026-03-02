import { createSlice } from "@reduxjs/toolkit";

export interface AuthState {
  token: string | null;
  iamUserId: string | null;
  expiresAt: number | null;
}

const initialState: AuthState = {
  token: null,
  iamUserId: null,
  expiresAt: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: {
        payload: { token: string; iamUserId: string; expiresAt?: number };
      }
    ) => {
      state.token = action.payload.token;
      state.iamUserId = action.payload.iamUserId;
      state.expiresAt = action.payload.expiresAt ?? null;
    },
    clearCredentials: (state) => {
      state.token = null;
      state.iamUserId = null;
      state.expiresAt = null;
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
