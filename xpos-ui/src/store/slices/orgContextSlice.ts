import { createSlice } from "@reduxjs/toolkit";

export interface OrgContextState {
  orgId: string | null;
  orgName: string | null;
  branchId: string | null;
  branchName: string | null;
  terminalId: string | null;
  terminalName: string | null;
}

const initialState: OrgContextState = {
  orgId: null,
  orgName: null,
  branchId: null,
  branchName: null,
  terminalId: null,
  terminalName: null,
};

const orgContextSlice = createSlice({
  name: "orgContext",
  initialState,
  reducers: {
    setOrg: (state, action: { payload: { orgId: string; orgName?: string | null } }) => {
      state.orgId = action.payload.orgId;
      state.orgName = action.payload.orgName ?? null;
      state.branchId = null;
      state.branchName = null;
      state.terminalId = null;
      state.terminalName = null;
    },
    setBranch: (state, action: { payload: { branchId: string; branchName?: string | null } }) => {
      state.branchId = action.payload.branchId;
      state.branchName = action.payload.branchName ?? null;
      state.terminalId = null;
      state.terminalName = null;
    },
    setTerminal: (state, action: { payload: { terminalId: string; terminalName?: string | null } }) => {
      state.terminalId = action.payload.terminalId;
      state.terminalName = action.payload.terminalName ?? null;
    },
    clearContext: () => initialState,
  },
});

export const { setOrg, setBranch, setTerminal, clearContext } = orgContextSlice.actions;
export default orgContextSlice.reducer;
