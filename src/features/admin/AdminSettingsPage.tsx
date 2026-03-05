import { useNavVisibilityContext } from "@/contexts/NavVisibilityContext";
import { isNavItemVisible } from "@/hooks/useAdminNavVisibility";
import { isOperatorNavItemVisible } from "@/hooks/useOperatorNavVisibility";
import { ADMIN_NAV_ITEMS, ADMIN_GROUP_ORDER } from "@/config/adminNavItems";
import { OPERATOR_NAV_ITEMS, OPERATOR_GROUP_ORDER } from "@/config/operatorNavItems";
import { Settings } from "lucide-react";

function groupAdminNavItems() {
  const byGroup = new Map<string, typeof ADMIN_NAV_ITEMS>();
  for (const item of ADMIN_NAV_ITEMS) {
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

function groupOperatorNavItems() {
  const byGroup = new Map<string, typeof OPERATOR_NAV_ITEMS>();
  for (const item of OPERATOR_NAV_ITEMS) {
    const group = item.group ?? "Other";
    const list = byGroup.get(group) ?? [];
    list.push(item);
    byGroup.set(group, list);
  }
  return OPERATOR_GROUP_ORDER.filter((g) => byGroup.has(g)).map((group) => ({
    label: group,
    items: byGroup.get(group) ?? [],
  }));
}

const adminNavGroups = groupAdminNavItems();
const operatorNavGroups = groupOperatorNavItems();

function NavItemToggle({
  label,
  visible,
  canHide,
  onToggle,
}: {
  label: string;
  visible: boolean;
  canHide: boolean;
  onToggle: (visible: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      {canHide ? (
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => onToggle(e.target.checked)}
            className="peer sr-only"
          />
          <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:bg-slate-600 dark:after:border-slate-500 dark:peer-focus:ring-primary-800" />
          <span className="ml-3 text-sm text-slate-600 dark:text-slate-400">
            {visible ? "Visible" : "Hidden"}
          </span>
        </label>
      ) : (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Always visible
        </span>
      )}
    </div>
  );
}

export function AdminSettingsPage() {
  const {
    adminVisibility: visibilityState,
    operatorVisibility: opVisibilityState,
    setAdminVisible: setVisible,
    setOperatorVisible: opSetVisible,
    resetAdminToDefaults: resetToDefaults,
    resetOperatorToDefaults: opResetToDefaults,
    needsOrgSelection,
  } = useNavVisibilityContext();

  if (needsOrgSelection) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-white">
          <Settings className="h-7 w-7" />
          Settings
        </h1>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          Select an organization from the header dropdown to configure sidebar visibility. Settings are stored per organization and sync across all devices.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-white">
        <Settings className="h-7 w-7" />
        Settings
      </h1>
      <p className="mb-6 text-slate-600 dark:text-slate-400">
        Choose which items appear in the admin and operator sidebars. Settings
        are stored per organization and sync across devices. Changes apply immediately.
      </p>

      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">
            Admin sidebar
          </h2>
          <div className="space-y-6">
            {adminNavGroups.map(({ label: groupLabel, items: groupItems }) => (
              <div
                key={groupLabel}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
              >
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {groupLabel}
                </h3>
                <div className="space-y-3">
                  {groupItems.map((item) => (
                    <NavItemToggle
                      key={item.to}
                      label={item.label}
                      visible={isNavItemVisible(
                        item.to,
                        item.canHide,
                        visibilityState
                      )}
                      canHide={item.canHide}
                      onToggle={(v) => setVisible(item.to, v)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={resetToDefaults}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Reset admin sidebar (show all)
            </button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">
            Operator sidebar
          </h2>
          <div className="space-y-6">
            {operatorNavGroups.map(({ label: groupLabel, items: groupItems }) => (
              <div
                key={groupLabel}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
              >
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {groupLabel}
                </h3>
                <div className="space-y-3">
                  {groupItems.map((item) => (
                    <NavItemToggle
                      key={item.to}
                      label={item.label}
                      visible={isOperatorNavItemVisible(
                        item.to,
                        item.canHide,
                        opVisibilityState
                      )}
                      canHide={item.canHide}
                      onToggle={(v) => opSetVisible(item.to, v)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={opResetToDefaults}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Reset operator sidebar (show all)
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
