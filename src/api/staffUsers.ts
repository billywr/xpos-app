import { apiFetch, buildPageQuery } from "@/api/client";
import type { StaffUser } from "@/types/staff";
import type { StaffProfile } from "@/types/staff";
import type { StaffBranchAssignment } from "@/types/staff";
import type { PageResponse } from "@/types/api";

export async function fetchStaffUsers(
  token: string | null,
  orgId: string,
  params?: { page?: number; size?: number }
): Promise<PageResponse<StaffUser>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 25,
  });
  return apiFetch<PageResponse<StaffUser>>(
    `/api/v1/admin/orgs/${orgId}/staff-users${query}`,
    { token }
  );
}

export async function fetchStaffUser(
  token: string | null,
  orgId: string,
  staffUserId: string
): Promise<StaffUser> {
  return apiFetch<StaffUser>(
    `/api/v1/admin/orgs/${orgId}/staff-users/${staffUserId}`,
    { token }
  );
}

export interface CreateStaffUserBody {
  iamUserId: string;
  username: string;
}

export async function createStaffUser(
  token: string | null,
  orgId: string,
  body: CreateStaffUserBody
): Promise<StaffUser> {
  return apiFetch<StaffUser>(`/api/v1/admin/orgs/${orgId}/staff-users`, {
    token,
    method: "POST",
    body: { iamUserId: body.iamUserId, username: body.username ?? "" },
  });
}

export async function updateStaffUserStatus(
  token: string | null,
  orgId: string,
  staffUserId: string,
  status: string
): Promise<StaffUser> {
  return apiFetch<StaffUser>(
    `/api/v1/admin/orgs/${orgId}/staff-users/${staffUserId}/status`,
    { token, method: "PATCH", body: { status } }
  );
}

export async function fetchStaffProfile(
  token: string | null,
  orgId: string,
  staffUserId: string
): Promise<StaffProfile> {
  return apiFetch<StaffProfile>(
    `/api/v1/admin/orgs/${orgId}/staff-users/${staffUserId}/profile`,
    { token }
  );
}

export interface StaffProfileUpsertBody {
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  employeeNo?: string | null;
  defaultBranchId?: string | null;
  status: string;
}

export async function upsertStaffProfile(
  token: string | null,
  orgId: string,
  staffUserId: string,
  body: StaffProfileUpsertBody
): Promise<StaffProfile> {
  return apiFetch<StaffProfile>(
    `/api/v1/admin/orgs/${orgId}/staff-users/${staffUserId}/profile`,
    {
      token,
      method: "PUT",
      body: {
        displayName: body.displayName ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        employeeNo: body.employeeNo ?? null,
        defaultBranchId: body.defaultBranchId ?? null,
        status: body.status,
      },
    }
  );
}

export async function fetchStaffBranchAssignments(
  token: string | null,
  orgId: string,
  staffUserId: string
): Promise<StaffBranchAssignment[]> {
  return apiFetch<StaffBranchAssignment[]>(
    `/api/v1/admin/orgs/${orgId}/staff-users/${staffUserId}/branches`,
    { token }
  );
}

export async function assignStaffBranch(
  token: string | null,
  orgId: string,
  staffUserId: string,
  branchId: string,
  primary: boolean
): Promise<StaffBranchAssignment> {
  return apiFetch<StaffBranchAssignment>(
    `/api/v1/admin/orgs/${orgId}/staff-users/${staffUserId}/branches`,
    {
      token,
      method: "POST",
      body: { branchId, primary },
    }
  );
}

export async function deleteStaffUser(
  token: string | null,
  orgId: string,
  staffUserId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/admin/orgs/${orgId}/staff-users/${staffUserId}`,
    { token, method: "DELETE" }
  );
}
