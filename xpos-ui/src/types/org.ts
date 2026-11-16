/**
 * Org, branch, terminal list types. Align with backend DTOs.
 */

export const ORG_STATUS_ACTIVE = "ACTIVE";
export const ORG_STATUS_DELETED = "DELETED";

export function filterActiveBranches<T extends { status: string }>(items: T[]): T[] {
  return items.filter((x) => x.status === ORG_STATUS_ACTIVE);
}

export function filterActiveTerminals<T extends { status: string }>(items: T[]): T[] {
  return items.filter((x) => x.status === ORG_STATUS_ACTIVE);
}

export function filterActiveDevices<T extends { status: string }>(items: T[]): T[] {
  return items.filter((x) => x.status === ORG_STATUS_ACTIVE);
}

/** Excludes only DELETED; ACTIVE and INACTIVE remain usable. */
export function filterNonDeletedBranches<T extends { status: string }>(items: T[]): T[] {
  return items.filter((x) => x.status !== ORG_STATUS_DELETED);
}

/** Excludes only DELETED; ACTIVE and INACTIVE remain usable. */
export function filterNonDeletedTerminals<T extends { status: string }>(items: T[]): T[] {
  return items.filter((x) => x.status !== ORG_STATUS_DELETED);
}

/** Excludes only DELETED; ACTIVE and INACTIVE remain usable. */
export function filterNonDeletedDevices<T extends { status: string }>(items: T[]): T[] {
  return items.filter((x) => x.status !== ORG_STATUS_DELETED);
}

export interface Org {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function filterActiveOrgs(orgs: Org[]): Org[] {
  return orgs.filter((o) => o.status === ORG_STATUS_ACTIVE);
}

export interface Business {
  id: string;
  orgId: string;
  legalName: string;
  kraPin: string | null;
  logoUrl: string | null;
  receiptFooter: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  orgId: string;
  businessId: string;
  name: string;
  timezone: string;
  currency: string;
  status: string;
  addressJson?: string | null;
  taxAgencyConfigId?: string | null;
  receiptTemplateId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Terminal {
  id: string;
  orgId: string;
  branchId: string;
  terminalCode: string;
  status: string;
  printerProfileId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceRegistration {
  id: string;
  orgId: string;
  deviceId: string;
  status: string;
  branchId?: string | null;
  terminalId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
