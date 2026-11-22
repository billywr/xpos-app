/**
 * Top navigation bar items (Home, Admin, Operator, Org).
 * app-name is the app/logo label (XPOS) used across the system.
 * Only static labels - values from DB (org name, branch, etc.) are not configurable here.
 */
export interface HeaderNavItemConfig {
  path: string;
  label: string;
  /** If false, cannot be hidden (e.g. critical nav or app name) */
  canHide: boolean;
  /** Optional row label in Settings (e.g. "App name" for app-name) */
  rowLabel?: string;
}

export const APP_NAME_KEY = "app-name";
export const LOGO_KEY = "logo";

export const HEADER_NAV_ITEMS: HeaderNavItemConfig[] = [
  { path: APP_NAME_KEY, label: "XPOS", canHide: false, rowLabel: "App name" },
  { path: "/", label: "Home", canHide: true },
  { path: "/admin", label: "Admin", canHide: true },
  { path: "/operator", label: "Operator", canHide: true },
  { path: "/operator/menu-order", label: "POS", canHide: true },
  { path: "/select-context", label: "Org", canHide: true },
];
