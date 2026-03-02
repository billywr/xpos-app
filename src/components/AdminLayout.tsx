import { Outlet, NavLink } from "react-router-dom";
import {
  BarChart3,
  Building2,
  Briefcase,
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
} from "lucide-react";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/orgs", label: "Organizations", icon: Building2, end: false },
  { to: "/admin/businesses", label: "Businesses", icon: Briefcase, end: false },
  { to: "/admin/branches", label: "Branches", icon: MapPin, end: false },
  { to: "/admin/terminals", label: "Terminals", icon: Monitor, end: false },
  { to: "/admin/devices", label: "Devices", icon: Smartphone, end: false },
  { to: "/admin/staff", label: "Staff", icon: Users, end: false },
  { to: "/admin/catalog", label: "Catalog", icon: FolderTree, end: false },
  { to: "/admin/uoms", label: "Units (UOM)", icon: Ruler, end: false },
  { to: "/admin/items", label: "Items", icon: Package, end: false },
  { to: "/admin/price-lists", label: "Price lists", icon: Receipt, end: false },
  { to: "/admin/tender-types", label: "Tender types", icon: CreditCard, end: false },
  { to: "/admin/tables", label: "Tables", icon: UtensilsCrossed, end: false },
  { to: "/admin/sales", label: "Sales", icon: ShoppingCart, end: false },
  { to: "/admin/shifts", label: "Shifts", icon: Wallet, end: false },
  { to: "/admin/z-report", label: "Z-Report", icon: FileText, end: false },
  { to: "/admin/suppliers", label: "Suppliers", icon: Truck, end: false },
  { to: "/admin/goods-receipt", label: "Goods Receipt", icon: PackagePlus, end: false },
  { to: "/admin/inventory", label: "Inventory", icon: Package, end: false },
  { to: "/admin/revenue", label: "Revenue & P&L", icon: TrendingUp, end: false },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, end: false },
];

export function AdminLayout() {
  const [collapsed, toggle] = useSidebarCollapsed();

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
          className={`flex items-center border-b border-slate-200/60 px-3 py-3 dark:border-slate-600/60 ${
            collapsed ? "justify-end" : "justify-between"
          }`}
        >
          {!collapsed && (
            <div>
              <h2 className="font-semibold text-slate-800 dark:text-white">Admin</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Setup &amp; configuration
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={toggle}
            className="rounded-lg p-2 text-slate-500 hover:bg-primary-100 hover:text-primary-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 p-2" aria-label="Admin">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  collapsed ? "justify-center" : ""
                } ${
                  isActive
                    ? "bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
      {/* Content area: at least viewport height so layout feels full; grows with content and scrolls when needed */}
      <main className="min-h-[calc(100vh-3.5rem)] min-w-0 flex-1 overflow-auto bg-transparent p-6">
        <Outlet />
      </main>
    </div>
  );
}
