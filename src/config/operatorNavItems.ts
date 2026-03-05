import type React from "react";
import {
  BarChart3,
  ChefHat,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  HandCoins,
  LayoutDashboard,
  Receipt,
  ReceiptText,
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
}

function navItem(
  to: string,
  label: string,
  group: string,
  canHide = true,
  icon?: React.ComponentType<{ className?: string }>,
  isGroup?: boolean
): OperatorNavItemConfig {
  return { to, label, icon, group, canHide, isGroup };
}

export const OPERATOR_NAV_ITEMS: OperatorNavItemConfig[] = [
  navItem("/operator", "Dashboard", "Main", false, LayoutDashboard),
  navItem("/operator/menu-order", "Menu Order", "Main", true, ShoppingCart),
  navItem("/operator/receipts", "Receipts", "Main", true, Receipt),
  navItem("/operator/analytics", "Analytics", "Main", true, BarChart3),
  navItem("/operator/debts", "Customer Debts", "Main", true, HandCoins),
  navItem("/operator/misc-expenses", "Misc Expenses", "Main", true, ReceiptText),
  navItem("/operator/stock-count", "Manual Stock Taking", "Main", true, ClipboardList),
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
