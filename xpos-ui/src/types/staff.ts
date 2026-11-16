/**
 * Staff user, profile, and branch assignment types. Align with backend DTOs.
 */

export interface StaffUser {
  id: string;
  orgId: string;
  iamUserId: string;
  username: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffProfile {
  id: string;
  orgId: string;
  staffUserId: string;
  displayName: string | null;
  phone: string | null;
  email: string | null;
  employeeNo: string | null;
  defaultBranchId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffBranchAssignment {
  id: string;
  orgId: string;
  staffUserId: string;
  branchId: string;
  primary: boolean;
  createdAt: string;
}
