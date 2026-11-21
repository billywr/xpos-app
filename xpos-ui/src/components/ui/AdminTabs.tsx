import type { ComponentType } from "react";
import { toSentenceCase } from "@/utils/textCase";

/**
 * Single tab configuration for AdminTabList.
 * enabled and disabledReason drive disabled state and tooltip.
 * icon: Lucide icon component (e.g. Building2, Package).
 */
export interface AdminTabItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  enabled: boolean;
  disabledReason?: string;
}

export interface AdminTabListProps {
  /** Unique id for the tablist (e.g. "org-setup") for aria and tab ids */
  tabListId: string;
  /** Aria label for the tablist */
  ariaLabel: string;
  tabs: AdminTabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

/**
 * Horizontal tab bar for admin section pages. Uses padding so the first tab's
 * left border and focus ring are not clipped. Supports disabled tabs with tooltip.
 */
export function AdminTabList({
  tabListId,
  ariaLabel,
  tabs,
  activeTab,
  onTabChange,
}: AdminTabListProps) {
  return (
    <div
      className="border-b border-slate-200 pl-2 dark:border-slate-700"
      role="tablist"
      aria-label={ariaLabel}
    >
      <nav className="-mb-px flex flex-wrap gap-1" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`${tabListId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-disabled={!tab.enabled}
              disabled={!tab.enabled}
              title={tab.disabledReason ?? undefined}
              onClick={() => tab.enabled && onTabChange(tab.id)}
              className={`inline-flex items-center gap-2 rounded-t-lg border px-4 py-3 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                isActive
                  ? "border-slate-300 border-b-white bg-white text-slate-900 dark:border-slate-600 dark:border-b-slate-800 dark:bg-slate-800 dark:text-white"
                  : tab.enabled
                    ? "border-transparent text-primary-600 hover:border-slate-300 hover:text-primary-700 dark:text-primary-400 dark:hover:border-slate-600 dark:hover:text-primary-300"
                    : "cursor-not-allowed border-transparent text-slate-400 dark:text-slate-500"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {toSentenceCase(tab.label)}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export interface AdminTabPanelProps {
  children: React.ReactNode;
  /** Unique id for this panel (e.g. "org-setup-panel") */
  panelId: string;
  /** Id of the tab that controls this panel (for aria-labelledby) */
  tabId: string;
}

/**
 * Wrapper for tab panel content. Rounded bottom border and padding to match AdminTabList.
 */
export function AdminTabPanel({ children, panelId, tabId }: AdminTabPanelProps) {
  return (
    <div
      className="rounded-b-lg border border-t-0 border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800"
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
    >
      {children}
    </div>
  );
}
