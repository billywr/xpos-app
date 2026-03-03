import { useState, useMemo, useEffect } from "react";
import type React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  Building2,
  Briefcase,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  FolderTree,
  LayoutDashboard,
  MapPin,
  Monitor,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  ShoppingCart,
  Smartphone,
  TrendingUp,
  Users,
  Ruler,
  UtensilsCrossed,
  Wallet,
  Truck,
  PackagePlus,
  CalendarClock,
} from "lucide-react";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";

interface NavItemConfig {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  end: boolean;
}

const navItem = (
  to: string,
  label: string,
  icon: React.ComponentType<{ className?: string }>,
  group: string,
  end?: boolean
): NavItemConfig => ({ to, label, icon, group, end: end ?? false });

const allNavItems = [
  navItem("/admin", "Dashboard", LayoutDashboard, "Overview", true),
  navItem("/admin/orgs", "Organizations", Building2, "Organization"),
  navItem("/admin/businesses", "Businesses", Briefcase, "Organization"),
  navItem("/admin/branches", "Branches", MapPin, "Organization"),
  navItem("/admin/terminals", "Terminals", Monitor, "Organization"),
  navItem("/admin/devices", "Devices", Smartphone, "Organization"),
  navItem("/admin/staff", "Staff", Users, "Organization"),
  navItem("/admin/catalog", "Catalog", FolderTree, "Catalog"),
  navItem("/admin/uoms", "Units (UOM)", Ruler, "Catalog"),
  navItem("/admin/items", "Items", Package, "Catalog"),
  navItem("/admin/price-lists", "Price lists", Receipt, "Catalog"),
  navItem("/admin/tender-types", "Tender types", CreditCard, "Sales"),
  navItem("/admin/tables", "Tables", UtensilsCrossed, "Sales"),
  navItem("/admin/sales", "Sales", ShoppingCart, "Sales"),
  navItem("/admin/shifts", "Shifts", Wallet, "Sales"),
  navItem("/admin/z-report", "Z-Report", FileText, "Sales"),
  navItem("/admin/suppliers", "Suppliers", Truck, "Inventory"),
  navItem("/admin/goods-receipt", "Goods Receipt", PackagePlus, "Inventory"),
  navItem("/admin/inventory", "Inventory", Package, "Inventory"),
  navItem("/admin/stock-taking-schedules", "Stock Taking", CalendarClock, "Inventory"),
  navItem("/admin/stock-count-sessions", "Manual Stock Taking", ClipboardList, "Inventory"),
  navItem("/admin/revenue", "Revenue & P&L", TrendingUp, "Reports"),
  navItem("/admin/analytics", "Analytics", BarChart3, "Reports"),
];

const GROUP_ORDER = [
  "Overview",
  "Organization",
  "Catalog",
  "Sales",
  "Inventory",
  "Reports",
  "Other",
];

function groupNavItems() {
  const byGroup = new Map<string, NavItemConfig[]>();
  for (const item of allNavItems) {
    const group = item.group ?? "Other";
    const list = byGroup.get(group) ?? [];
    list.push(item);
    byGroup.set(group, list);
  }
  return GROUP_ORDER.filter((g) => byGroup.has(g)).map((group) => ({
    label: group,
    items: byGroup.get(group) ?? [],
  }));
}

const navGroups = groupNavItems();

export function AdminLayout() {
  const [collapsed, toggle] = useSidebarCollapsed();
  const location = useLocation();

  const activeGroupLabels = useMemo(() => {
    const path = location.pathname;
    const set = new Set<string>();
    for (const g of navGroups) {
      const hasActive = g.items.some((item) => {
        if (item.end) return path === item.to;
        return path === item.to || path.startsWith(item.to + "/");
      });
      if (hasActive) set.add(g.label);
    }
    return set;
  }, [location.pathname]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => activeGroupLabels);

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      for (const label of activeGroupLabels) next.add(label);
      return next;
    });
  }, [activeGroupLabels]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div className="flex min-h-0 flex-1 items-start">
      {/* Sidebar: sticky full viewport height, soft edge so it feels anchored not hanging */}
      <aside
        className={`sticky top-0 z-10 flex shrink-0 flex-col bg-sidebar transition-[width] duration-200 ${
          collapsed ? "w-[4.25rem]" : "w-56"
        }`}
        style={{
          height: "calc(100vh - 3.5rem)",
          boxShadow: "2px 0 16px -4px var(--sidebar-edge)",
        }}
      >
        <div
          className={`flex items-center border-b border-slate-200/60 px-3 py-3 dark:border-white/10 ${
            collapsed ? "justify-end" : "justify-between"
          }`}
        >
          {!collapsed && (
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-white">Admin</h2>
              <p className="text-xs text-slate-500 dark:text-white/80">
                Setup &amp; configuration
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={toggle}
            className="rounded-lg p-2 text-slate-500 hover:bg-primary-100 hover:text-primary-700 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Admin">
          {navGroups.map(({ label: groupLabel, items: groupItems }) => {
            const isOpen = openGroups.has(groupLabel);
            return (
              <div key={groupLabel} className="space-y-0.5">
                {!collapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupLabel)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-300"
                    aria-expanded={isOpen}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {groupLabel}
                  </button>
                ) : null}
                {(collapsed || isOpen) &&
                  groupItems.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition ${
                          collapsed ? "justify-center px-3" : "pl-6 pr-3"
                        } ${
                          isActive
                            ? "bg-primary-100 text-primary-800 dark:bg-white/15 dark:text-white"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                        }`
                      }
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{label}</span>}
                    </NavLink>
                  ))}
              </div>
            );
          })}
        </nav>
      </aside>
      {/* Content area: at least viewport height so layout feels full; grows with content and scrolls when needed */}
      <main className="min-h-[calc(100vh-3.5rem)] min-w-0 flex-1 overflow-auto bg-transparent p-6">
        <Outlet />
      </main>
    </div>
  );
}
