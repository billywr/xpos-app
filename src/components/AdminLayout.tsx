import { useState, useMemo, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useNavVisibilityContext } from "@/contexts/NavVisibilityContext";
import { isNavItemVisible } from "@/hooks/useAdminNavVisibility";
import { ADMIN_NAV_ITEMS, ADMIN_GROUP_ORDER } from "@/config/adminNavItems";

function groupNavItems(items: typeof ADMIN_NAV_ITEMS) {
  const byGroup = new Map<string, typeof ADMIN_NAV_ITEMS>();
  for (const item of items) {
    const group = item.group ?? "Other";
    const list = byGroup.get(group) ?? [];
    list.push(item);
    byGroup.set(group, list);
  }
  return ADMIN_GROUP_ORDER.filter((g) => byGroup.has(g)).map((group) => ({
    label: group,
    items: byGroup.get(group) ?? [],
  }));
}

export function AdminLayout() {
  const [collapsed, toggle] = useSidebarCollapsed();
  const { adminVisibility: visibilityState, getAdminLabel } = useNavVisibilityContext();
  const location = useLocation();

  const visibleNavItems = useMemo(
    () =>
      ADMIN_NAV_ITEMS.filter((item) =>
        isNavItemVisible(item.to, item.canHide, visibilityState)
      ),
    [visibilityState]
  );

  const navGroups = useMemo(() => groupNavItems(visibleNavItems), [visibleNavItems]);

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
  }, [location.pathname, navGroups]);

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

  const HEADER_HEIGHT = "3.5rem";

  return (
    <div className="flex min-h-0 flex-1">
      {/* Sidebar: fixed so it always extends to bottom regardless of page length */}
      <aside
        className={`fixed left-0 z-10 flex flex-col bg-sidebar transition-[width] duration-200 ${
          collapsed ? "w-[4.25rem]" : "w-56"
        }`}
        style={{
          top: HEADER_HEIGHT,
          bottom: 0,
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
                  groupItems.map(({ to, label, icon: Icon, end }) => {
                    const displayLabel = getAdminLabel(to, label);
                    return (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      title={displayLabel}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition ${
                          collapsed ? "justify-center px-3" : "pl-6 pr-3"
                        } ${
                          isActive
                            ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/30 dark:text-indigo-100"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                        }`
                      }
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{displayLabel}</span>}
                    </NavLink>
                  );
                  })}
              </div>
            );
          })}
        </nav>
      </aside>
      {/* Content area: offset by sidebar width so it doesn't sit under the fixed sidebar */}
      <main
        className={`min-h-[calc(100vh-3.5rem)] min-w-0 flex-1 overflow-auto bg-transparent p-6 transition-[margin] duration-200 ${
          collapsed ? "ml-[4.25rem]" : "ml-56"
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}
