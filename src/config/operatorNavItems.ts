import type React from "react";
import {
  BarChart3,
  ChefHat,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  HandCoins,
  LayoutDashboard,
  NotebookPen,
  Receipt,
  ShoppingCart,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

export interface OperatorNavItemConfig {
  to: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  group: string;
  /** If false, cannot be hidden (e.g. Dashboard) */
  canHide: boolean;
  /** When true, represents a collapsible section (e.g. Manage Table with sub-items) */
  isGroup?: boolean;
  /** If true, NavLink only active when path matches exactly (e.g. Dashboard at /operator) */
  end?: boolean;
}

function navItem(
  to: string,
  label: string,
  group: string,
  canHide = true,
  icon?: React.ComponentType<{ className?: string }>,
  isGroup?: boolean,
  end?: boolean
): OperatorNavItemConfig {
  return { to, label, icon, group, canHide, isGroup, end };
}

export const OPERATOR_NAV_ITEMS: OperatorNavItemConfig[] = [
  navItem("/operator", "Dashboard", "Main", false, LayoutDashboard, false, true),
  navItem("/operator/menu-order", "POS", "Main", true, ShoppingCart),
  navItem("/operator/receipts", "Receipts", "Main", true, Receipt),
  navItem("/operator/analytics", "Analytics", "Main", true, BarChart3),
  navItem("/operator/debts", "Debts & Expenses", "Main", true, HandCoins),
  navItem("/operator/stock-count", "Stock count sessions", "Main", true, ClipboardList),
  navItem(
    "/operator/manual-stock-sheet",
    "Manual stock sheet",
    "Main",
    true,
    NotebookPen
  ),
  navItem(
    "/operator/inventory/stock-count",
    "Standard Stock Taking",
    "Main",
    true,
    FileSpreadsheet
  ),
  navItem("/operator/withdrawal", "Withdrawal", "Main", true, Wallet),
  navItem(
    "/operator/tables",
    "Manage Table",
    "Manage",
    true,
    UtensilsCrossed,
    true
  ),
  navItem("/operator/dishes", "Manage Dish", "Manage", true, ChefHat),
  navItem("/operator/payments", "Manage Payment", "Manage", true, CreditCard),
];

export const OPERATOR_GROUP_ORDER = ["Main", "Manage"];
