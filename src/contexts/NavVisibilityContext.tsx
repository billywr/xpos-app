import { createContext, useContext } from "react";

export type NavVisibilityState = Record<string, boolean>;
export type NavLabelsState = Record<string, string>;

interface NavVisibilityContextValue {
  adminVisibility: NavVisibilityState;
  operatorVisibility: NavVisibilityState;
  headerVisibility: NavVisibilityState;
  adminLabels: NavLabelsState;
  operatorLabels: NavLabelsState;
  headerLabels: NavLabelsState;
  setAdminVisible: (path: string, visible: boolean) => void;
  setOperatorVisible: (path: string, visible: boolean) => void;
  setHeaderVisible: (path: string, visible: boolean) => void;
  setAdminLabel: (path: string, label: string) => void;
  setOperatorLabel: (path: string, label: string) => void;
  setHeaderLabel: (path: string, label: string) => void;
  resetAdminToDefaults: () => void;
  resetOperatorToDefaults: () => void;
  resetHeaderToDefaults: () => void;
  resetAdminLabels: () => void;
  resetOperatorLabels: () => void;
  resetHeaderLabels: () => void;
  getAdminLabel: (path: string, defaultLabel: string) => string;
  getOperatorLabel: (path: string, defaultLabel: string) => string;
  getHeaderLabel: (path: string, defaultLabel: string) => string;
  /** Custom logo data URL (or null for default Store icon) */
  getHeaderLogo: () => string | null;
  setHeaderLogo: (dataUrl: string | null) => void;
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
