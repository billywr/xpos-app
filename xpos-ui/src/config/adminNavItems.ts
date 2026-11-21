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
  NotebookPen,
  Package,

  PencilLine,
  Receipt,
  ScanBarcode,
  Settings,
  ShoppingCart,
  Smartphone,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Wallet,
  CalendarClock,
  HandCoins,
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

  navItem("/admin/debts", "Debts & expenses", HandCoins, "Sales"),
  navItem("/admin/sales", "Sales", ShoppingCart, "Sales"),
  navItem("/admin/pos", "POS", ShoppingCart, "Sales"),
  navItem("/admin/sales-recording", "Sales recording", PencilLine, "Sales"),
  navItem("/admin/receipts", "Receipts", Receipt, "Sales"),
  navItem("/admin/shifts", "Shifts", Wallet, "Sales"),
  navItem("/admin/z-report", "Z-Report", FileText, "Sales"),
  navItem("/admin/tender-types", "Tender types", CreditCard, "Sales"),
  navItem("/admin/tables", "Tables", UtensilsCrossed, "Sales"),
  navItem("/admin/payments", "Manage payments", CreditCard, "Sales"),
  navItem("/admin/inventory", "Stock & inventory", Package, "Inventory"),
  navItem("/admin/stock-taking-schedules", "Stock taking schedules", CalendarClock, "Inventory"),
  navItem("/admin/stock-count-sessions", "Manual stock taking", ClipboardList, "Inventory"),
  navItem("/admin/standard-stock-count", "Stock taking", FileSpreadsheet, "Inventory"),
  navItem("/admin/manual-stock-sheet", "Manual stock sheet", NotebookPen, "Inventory"),
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
