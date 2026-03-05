/**
 * /api/v1/me and org context types.
 */

export interface MeStaffProfileResponse {
  displayName: string | null;
  phone: string | null;
  email: string | null;
  employeeNo: string | null;
  defaultBranchId: string | null;
  status: string;
}

export interface MeResponse {
  orgId: string;
  iamUserId: string;
  username: string;
  staffUserId: string;
  staffStatus: string;
  profile: MeStaffProfileResponse | null;
  primaryBranchId: string | null;
}
