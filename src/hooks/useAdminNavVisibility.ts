import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "xpos_admin_nav_visibility";

export type AdminNavVisibilityState = Record<string, boolean>;

function readStored(): AdminNavVisibilityState {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return {};
    const parsed = JSON.parse(s) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as AdminNavVisibilityState;
    }
  } catch {
    // ignore
  }
  return {};
}

export function useAdminNavVisibility(): [
  AdminNavVisibilityState,
  (path: string, visible: boolean) => void,
  () => void,
] {
  const [state, setState] = useState<AdminNavVisibilityState>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const setVisible = useCallback((path: string, visible: boolean) => {
    setState((prev) => ({ ...prev, [path]: visible }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setState({});
  }, []);

  return [state, setVisible, resetToDefaults];
}

export function isNavItemVisible(
  path: string,
  canHide: boolean,
  visibilityState: AdminNavVisibilityState
): boolean {
  if (!canHide) return true;
  if (path in visibilityState) return visibilityState[path];
  return true;
}
