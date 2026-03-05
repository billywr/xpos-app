import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "xpos_operator_nav_visibility";

export type OperatorNavVisibilityState = Record<string, boolean>;

function readStored(): OperatorNavVisibilityState {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return {};
    const parsed = JSON.parse(s) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as OperatorNavVisibilityState;
    }
  } catch {
    // ignore
  }
  return {};
}

export function useOperatorNavVisibility(): [
  OperatorNavVisibilityState,
  (path: string, visible: boolean) => void,
  () => void,
] {
  const [state, setState] = useState<OperatorNavVisibilityState>(readStored);

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

export function isOperatorNavItemVisible(
  path: string,
  canHide: boolean,
  visibilityState: OperatorNavVisibilityState
): boolean {
  if (!canHide) return true;
  if (path in visibilityState) return visibilityState[path];
  return true;
}
