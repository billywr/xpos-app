import { useState, useMemo, useEffect, useCallback } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { PageTransition } from "@/components/ui/PageTransition";
import { ChevronDown, ChevronRight, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
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
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const HEADER_HEIGHT = "3.5rem";

  const sidebarNav = (isMobile: boolean) => (
    <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Admin">
      {navGroups.map(({ label: groupLabel, items: groupItems }) => {
        const isOpen = openGroups.has(groupLabel);
        const showLabels = isMobile || !collapsed;
        const singleItem = groupItems.length === 1;
        return (
          <div key={groupLabel} className="space-y-0.5">
            {showLabels && !singleItem ? (
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
            {(singleItem || !showLabels || isOpen) &&
              groupItems.map(({ to, label, icon: Icon, end }) => {
                const displayLabel = getAdminLabel(to, label);
                return (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  title={displayLabel}
                  onClick={isMobile ? closeMobile : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition ${
                      !showLabels ? "justify-center px-3" : singleItem ? "px-3" : "pl-6 pr-3"
                    } ${
                      isActive
                        ? "bg-primary-600 text-white dark:bg-primary-500"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                    }`
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {showLabels && <span>{displayLabel}</span>}
                </NavLink>
              );
              })}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-0 flex-1">
      {/* Mobile hamburger button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg md:hidden"
        aria-label="Open sidebar menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={closeMobile}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-xl"
            style={{ top: HEADER_HEIGHT }}
          >
            <div className="flex items-center justify-between border-b border-slate-200/60 px-3 py-3 dark:border-white/10">
              <div>
                <h2 className="font-semibold text-slate-800 dark:text-white">Admin</h2>
                <p className="text-xs text-slate-500 dark:text-white/80">
                  Setup &amp; configuration
                </p>
              </div>
              <button
                type="button"
                onClick={closeMobile}
                className="rounded-lg p-2 text-slate-500 hover:bg-primary-100 hover:text-primary-700 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarNav(true)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar: fixed so it always extends to bottom regardless of page length */}
      <aside
        className={`fixed left-0 z-10 hidden flex-col bg-sidebar transition-[width] duration-200 md:flex ${
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
        {sidebarNav(false)}
      </aside>

      {/* Content area: offset by sidebar width on desktop, full-width on mobile */}
      <main
        className={`min-h-[calc(100vh-3.5rem)] min-w-0 flex-1 overflow-auto bg-transparent p-3 transition-[margin] duration-200 sm:p-4 md:p-6 ${
          collapsed ? "md:ml-[4.25rem]" : "md:ml-56"
        }`}
      >
        <PageTransition />
      </main>
    </div>
  );
}
