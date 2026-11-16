import type { RootState } from "@/store";

export const selectOrgId = (state: RootState): string | null =>
  state.orgContext.orgId;

export const selectOrgName = (state: RootState): string | null =>
  state.orgContext.orgName;

export const selectBranchId = (state: RootState): string | null =>
  state.orgContext.branchId;

export const selectBranchName = (state: RootState): string | null =>
  state.orgContext.branchName;

export const selectTerminalId = (state: RootState): string | null =>
  state.orgContext.terminalId;

export const selectTerminalName = (state: RootState): string | null =>
  state.orgContext.terminalName;

export const selectHasOperatorContext = (state: RootState): boolean =>
  Boolean(
    state.orgContext.orgId &&
      state.orgContext.branchId &&
      state.orgContext.terminalId
  );
