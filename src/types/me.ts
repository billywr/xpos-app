/**
 * /api/v1/me and org context types.
 */

export interface MeResponse {
  orgId: string;
  orgName: string;
  staffUserId: string | null;
  displayName: string | null;
  branches: MeBranch[];
}

export interface MeBranch {
  branchId: string;
  branchName: string;
  primary: boolean;
  terminals: MeTerminal[];
}

export interface MeTerminal {
  terminalId: string;
  terminalCode: string;
}
