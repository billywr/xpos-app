import { createContext, useContext } from "react";

export type NavVisibilityState = Record<string, boolean>;

interface NavVisibilityContextValue {
  adminVisibility: NavVisibilityState;
  operatorVisibility: NavVisibilityState;
  setAdminVisible: (path: string, visible: boolean) => void;
  setOperatorVisible: (path: string, visible: boolean) => void;
  resetAdminToDefaults: () => void;
  resetOperatorToDefaults: () => void;
  isLoading: boolean;
  isSaving: boolean;
  /** True when org must be selected before settings can be saved */
  needsOrgSelection: boolean;
}

const NavVisibilityContext = createContext<NavVisibilityContextValue | null>(null);

export function useNavVisibilityContext(): NavVisibilityContextValue {
  const ctx = useContext(NavVisibilityContext);
  if (!ctx) {
    throw new Error("useNavVisibilityContext must be used within NavVisibilityProvider");
  }
  return ctx;
}

export function useNavVisibilityContextOrNull(): NavVisibilityContextValue | null {
  return useContext(NavVisibilityContext);
}

export { NavVisibilityContext };
