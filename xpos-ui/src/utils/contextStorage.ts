/**
 * Persist org/branch/terminal context to sessionStorage so refresh keeps the operator context.
 * Also supports org+branch-only (admin context) for pages like Analytics that don't need terminal.
 */

const CONTEXT_STORAGE_KEY = "xpos_context";

export interface StoredContext {
  orgId: string;
  orgName: string;
  branchId: string;
  branchName: string;
  terminalId: string;
  terminalName: string;
}

export interface StoredAdminContext {
  orgId: string;
  orgName: string;
  branchId: string;
  branchName: string;
}

/** Returns full stored context if valid (org+branch+terminal); otherwise null. */
export function getStoredContext(): StoredContext | null {
  try {
    const raw = sessionStorage.getItem(CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, string>;
    if (data.orgId && data.branchId && data.terminalId) {
      return {
        orgId: data.orgId,
        orgName: data.orgName ?? "",
        branchId: data.branchId,
        branchName: data.branchName ?? "",
        terminalId: data.terminalId,
        terminalName: data.terminalName ?? "",
      };
    }
  } catch {
    // ignore
  }
  return null;
}

/** Returns org+branch only (for admin pages). Used when full context not set. */
export function getStoredAdminContext(): StoredAdminContext | null {
  try {
    const raw = sessionStorage.getItem(CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, string>;
    if (data.orgId && data.branchId) {
      return {
        orgId: data.orgId,
        orgName: data.orgName ?? "",
        branchId: data.branchId,
        branchName: data.branchName ?? "",
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function setStoredContext(ctx: StoredContext): void {
  sessionStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(ctx));
}

/** Persist org+branch for admin pages (Analytics, Revenue). Survives refresh. */
export function setStoredAdminContext(ctx: StoredAdminContext): void {
  const raw = sessionStorage.getItem(CONTEXT_STORAGE_KEY);
  const existing = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  sessionStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify({
    ...existing,
    orgId: ctx.orgId,
    orgName: ctx.orgName,
    branchId: ctx.branchId,
    branchName: ctx.branchName,
  }));
}

export function clearStoredContext(): void {
  sessionStorage.removeItem(CONTEXT_STORAGE_KEY);
}
