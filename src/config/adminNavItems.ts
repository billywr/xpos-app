import type React from "react";
import {
  BarChart3,
  Building2,
  Briefcase,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  FileText,
  FolderTree,
  LayoutDashboard,
  MapPin,
  Monitor,
  Package,

  PencilLine,
  ScanBarcode,
  Settings,
  ShoppingCart,
  Smartphone,
  TrendingUp,
  Users,

  UtensilsCrossed,
  Wallet,
  CalendarClock,
} from "lucide-react";

export interface AdminNavItemConfig {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  end: boolean;
  /** If false, cannot be hidden from sidebar (e.g. Dashboard, Settings) */
  canHide: boolean;
}

function navItem(
  to: string,
  label: string,
  icon: React.ComponentType<{ className?: string }>,
  group: string,
  end?: boolean,
  canHide = true
): AdminNavItemConfig {
  return { to, label, icon, group, end: end ?? false, canHide };
}

export const ADMIN_NAV_ITEMS: AdminNavItemConfig[] = [
  navItem("/admin", "Dashboard", LayoutDashboard, "Overview", true, false),
  navItem("/admin/org-setup", "Org setup", Building2, "Organization", false),
  navItem("/admin/orgs", "Organizations", Building2, "Organization"),
  navItem("/admin/businesses", "Businesses", Briefcase, "Organization"),
  navItem("/admin/branches", "Branches", MapPin, "Organization"),
  navItem("/admin/terminals", "Terminals", Monitor, "Organization"),
  navItem("/admin/devices", "Devices", Smartphone, "Organization"),
  navItem("/admin/staff", "Staff", Users, "Organization"),
  navItem("/admin/catalog", "Catalog", FolderTree, "Catalog", false),
  navItem("/admin/categories", "Categories", FolderTree, "Catalog"),

  navItem("/admin/items", "Items", Package, "Catalog"),

  navItem("/admin/tender-types", "Tender types", CreditCard, "Sales"),
  navItem("/admin/tables", "Tables", UtensilsCrossed, "Sales"),
  navItem("/admin/sales", "Sales", ShoppingCart, "Sales"),
  navItem("/operator/sales-recording", "Sales Recording", PencilLine, "Sales"),
  navItem("/admin/shifts", "Shifts", Wallet, "Sales"),
  navItem("/admin/z-report", "Z-Report", FileText, "Sales"),
  navItem("/admin/inventory", "Stock and Inventory", Package, "Inventory"),
  navItem("/admin/stock-taking-schedules", "Stock Taking", CalendarClock, "Inventory"),
  navItem("/admin/stock-count-sessions", "Manual Stock Taking", ClipboardList, "Inventory"),
  navItem("/admin/standard-stock-count", "Standard Stock Count", FileSpreadsheet, "Inventory"),
  navItem("/admin/revenue", "Revenue & P&L", TrendingUp, "Reports"),
  navItem("/admin/analytics", "Analytics", BarChart3, "Reports"),
  navItem("/admin/barcode-scanner", "Barcode scanner", ScanBarcode, "Settings"),
  navItem("/admin/settings", "Settings", Settings, "Settings", true, false),
];

export const ADMIN_GROUP_ORDER = [
  "Overview",
  "Organization",
  "Catalog",
  "Inventory",
  "Sales",
  "Reports",
  "Settings",
  "Other",
];
