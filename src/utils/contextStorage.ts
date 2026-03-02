/**
 * Persist org/branch/terminal context to sessionStorage so refresh keeps the operator context.
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

/** Returns stored context if valid; otherwise null. */
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

export function setStoredContext(ctx: StoredContext): void {
  sessionStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(ctx));
}

export function clearStoredContext(): void {
  sessionStorage.removeItem(CONTEXT_STORAGE_KEY);
}
