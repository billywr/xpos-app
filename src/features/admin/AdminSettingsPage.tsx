import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavVisibilityContext } from "@/contexts/NavVisibilityContext";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { selectOrgId } from "@/store/selectors/orgContextSelectors";
import { fetchAssistantSettings, fetchAssistantUsage } from "@/api/assistant";
import { isNavItemVisible } from "@/hooks/useAdminNavVisibility";
import { isOperatorNavItemVisible } from "@/hooks/useOperatorNavVisibility";
import { isHeaderNavItemVisible } from "@/hooks/useHeaderNavVisibility";
import { ADMIN_NAV_ITEMS, ADMIN_GROUP_ORDER } from "@/config/adminNavItems";
import { OPERATOR_NAV_ITEMS, OPERATOR_GROUP_ORDER } from "@/config/operatorNavItems";
import { HEADER_NAV_ITEMS } from "@/config/headerNavItems";
import {
  MENU_ORDER_SHOW_ORDER_TYPE,
  MENU_ORDER_SHOW_TABLE_SELECT,
  MENU_ORDER_SHOW_ITEM_LIST,
  isMenuOrderOptionVisible,
} from "@/config/menuOrderVisibility";
import {
  BARCODE_GOODS_RECEIPT,
  BARCODE_ITEMS,
  BARCODE_MENU_ORDER,
  isBarcodeVisible,
} from "@/config/barcodeVisibility";
import {
  STD_STOCK_COUNT_SHOW_PDF,
  STD_STOCK_COUNT_SHOW_SAVE,
  STD_STOCK_COUNT_SHOW_RECONCILE,
  STD_STOCK_COUNT_SHOW_RECORD_SALES,
  isStdStockCountButtonVisible,
} from "@/config/stdStockCountVisibility";
import {
  ASSISTANT_SHOW_WIDGET,
  isAssistantWidgetVisible,
} from "@/config/assistantVisibility";
import { Settings, Upload, Trash2, Store } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { resizeImageForLogo } from "@/utils/logoResize";

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

function LogoUploadRow({
  logoDataUrl,
  onLogoChange,
  onLogoRemove,
  isSaving,
}: {
  logoDataUrl: string | null;
  onLogoChange: (dataUrl: string) => void;
  onLogoRemove: () => void;
  isSaving: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please select an image (PNG, JPEG, etc.)");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await resizeImageForLogo(file);
      onLogoChange(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process image");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-[11rem] flex-1">
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          System logo
        </label>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700">
            {logoDataUrl ? (
              <img
                src={logoDataUrl}
                alt="Logo"
                className="h-full w-full object-contain"
              />
            ) : (
              <Store className="h-6 w-6 text-slate-400 dark:text-slate-500" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="sr-only"
              aria-label="Upload logo"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving || uploading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Upload className="h-4 w-4" />
              {logoDataUrl ? "Change" : "Upload"}
            </button>
            {logoDataUrl && (
              <button
                type="button"
                onClick={onLogoRemove}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            )}
          </div>
        </div>
        {error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          PNG, JPEG or WebP. Shown in header and operator bar. Max 160px.
        </p>
      </div>
    </div>
  );
}

function NavItemRow({
  path,
  defaultLabel,
  customLabel,
  visible,
  canHide,
  onToggle,
  onLabelChange,
  rowLabel,
}: {
  path: string;
  defaultLabel: string;
  customLabel: string;
  visible: boolean;
  canHide: boolean;
  onToggle: (visible: boolean) => void;
  onLabelChange: (path: string, label: string) => void;
  rowLabel?: string;
}) {
  const [localValue, setLocalValue] = useState(customLabel || "");
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (!isEditingRef.current && customLabel !== localValue) {
      setLocalValue(customLabel || "");
    }
  }, [customLabel]);

  const handleBlur = () => {
    isEditingRef.current = false;
    const trimmed = localValue.trim();
    const savedTrimmed = customLabel.trim();
    if (trimmed !== savedTrimmed) {
      onLabelChange(path, trimmed);
    }
  };

  const displayLabel = (customLabel || localValue).trim() || defaultLabel;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-[11rem] flex-1">
        {rowLabel && (
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            {rowLabel}
          </label>
        )}
        <input
          type="text"
          value={localValue}
          onChange={(e) => {
            isEditingRef.current = true;
            setLocalValue(e.target.value);
          }}
          onFocus={() => {
            isEditingRef.current = true;
          }}
          onBlur={handleBlur}
          placeholder={defaultLabel}
          className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
          aria-label={`Label for ${displayLabel}`}
        />
        {(customLabel || localValue).trim() && (
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Default: {defaultLabel}
          </span>
        )}
      </div>
      {canHide ? (
        <label className="relative flex shrink-0 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => onToggle(e.target.checked)}
            className="peer sr-only"
          />
          <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:bg-slate-600 dark:after:border-slate-500 dark:peer-focus:ring-primary-800" />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {visible ? "Visible" : "Hidden"}
          </span>
        </label>
      ) : (
        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
          Always visible
        </span>
      )}
    </div>
  );
}

function MenuOrderVisibilityRow({
  label,
  visible,
  onToggle,
}: {
  label: string;
  visible: boolean;
  onToggle: (visible: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
      <label className="relative flex shrink-0 cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => onToggle(e.target.checked)}
          className="peer sr-only"
        />
        <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:bg-slate-600 dark:after:border-slate-500 dark:peer-focus:ring-primary-800" />
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {visible ? "Visible" : "Hidden"}
        </span>
      </label>
    </div>
  );
}

function AssistantUsageSection() {
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);

  const usageQuery = useQuery({
    queryKey: ["assistant-usage", token, orgId],
    queryFn: () => fetchAssistantUsage(token, orgId!, 7),
    enabled: Boolean(token && orgId),
  });

  const settingsQuery = useQuery({
    queryKey: ["assistant-settings", token, orgId],
    queryFn: () => fetchAssistantSettings(token, orgId!),
    enabled: Boolean(token && orgId),
  });

  if (!orgId) {
    return (
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">
          AI usage & governance
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Select an organization context to view assistant usage metrics.
        </p>
      </section>
    );
  }

  const usage = usageQuery.data;
  const settings = settingsQuery.data;

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">
        AI usage & governance
      </h2>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Branch-scoped assistant queries are logged with tool name, latency, and optional LLM routing.
        LLM model and token budget are configured on the server.
      </p>
      <div className="min-w-0 max-w-xl rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        {usageQuery.isLoading && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading usage…</p>
        )}
        {usageQuery.isError && (
          <p className="text-sm text-red-700 dark:text-red-300">Could not load usage data.</p>
        )}
        {usage && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Queries (7 days)</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">
                {usage.totalQueries}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">LLM tokens (7 days)</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">
                {usage.llmTokensUsed}
              </dd>
            </div>
            {settings && (
              <>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">LLM routing</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">
                    {settings.llmConfigured && settings.llmEnabled ? settings.model : "Disabled"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Daily token cap / org</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">
                    {settings.maxTokensPerDayPerOrg > 0
                      ? settings.maxTokensPerDayPerOrg.toLocaleString()
                      : "Unlimited"}
                  </dd>
                </div>
              </>
            )}
          </dl>
        )}
        {usage?.topIntents && usage.topIntents.length > 0 && (
          <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-600">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Top intents
            </p>
            <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {usage.topIntents.slice(0, 5).map((row) => (
                <li key={row.intent} className="flex justify-between gap-2">
                  <span>{row.intent}</span>
                  <span className="font-medium">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export function AdminSettingsPage() {
  const {
    adminVisibility: visibilityState,
    operatorVisibility: opVisibilityState,
    headerVisibility: headerVisibilityState,
    adminLabels,
    operatorLabels,
    headerLabels,
    setAdminVisible: setVisible,
    setOperatorVisible: opSetVisible,
    setHeaderVisible: setHeaderVisible,
    setAdminLabel,
    setOperatorLabel,
    setHeaderLabel,
    getHeaderLogo,
    setHeaderLogo,
    resetAdminToDefaults: resetToDefaults,
    resetOperatorToDefaults: opResetToDefaults,
    resetHeaderToDefaults: resetHeaderToDefaults,
    resetAdminLabels,
    resetOperatorLabels,
    resetHeaderLabels,
    darkTheme,
    setDarkTheme,
    needsOrgSelection,
    isSaving,
  } = useNavVisibilityContext();

  if (needsOrgSelection) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          title="Settings"
          icon={Settings}
          fallbackTo="/admin"
        />
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          Select an organization from the header dropdown to configure sidebar visibility. Settings are stored per organization and sync across all devices.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Settings"
        icon={Settings}
        fallbackTo="/admin"
      />
      <p className="mb-6 text-slate-600 dark:text-slate-400">
        Choose which items appear in the top bar, admin and operator sidebars, and
        customize static menu labels. Values from the database (e.g. org name, branch)
        are not configurable here. Settings are stored per organization and sync
        across devices. Changes apply immediately.
      </p>

      <div className="flex flex-col gap-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">
            Top navigation bar
          </h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            System logo and app name (shown in header, operator bar). Home, Admin,
            Operator, Org links. Database values (org dropdown, user name) are
            shown as-is.
          </p>
          <div className="max-w-xl rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="space-y-3">
              <LogoUploadRow
                logoDataUrl={getHeaderLogo()}
                onLogoChange={(url) => setHeaderLogo(url)}
                onLogoRemove={() => setHeaderLogo(null)}
                isSaving={isSaving}
              />
              {HEADER_NAV_ITEMS.map((item) => (
                <NavItemRow
                  key={item.path}
                  path={item.path}
                  defaultLabel={item.label}
                  customLabel={headerLabels[item.path] ?? ""}
                  visible={isHeaderNavItemVisible(
                    item.path,
                    item.canHide,
                    headerVisibilityState
                  )}
                  canHide={item.canHide}
                  onToggle={(v) => setHeaderVisible(item.path, v)}
                  onLabelChange={setHeaderLabel}
                  rowLabel={item.rowLabel}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetHeaderToDefaults}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Reset visibility (show all)
            </button>
            <button
              type="button"
              onClick={resetHeaderLabels}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Reset labels to default
            </button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">
            Admin sidebar
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {adminNavGroups.map(({ label: groupLabel, items: groupItems }) => (
              <div
                key={groupLabel}
                className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
              >
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {groupLabel}
                </h3>
                <div className="space-y-3">
                  {groupItems.map((item) => (
                    <NavItemRow
                      key={item.to}
                      path={item.to}
                      defaultLabel={item.label}
                      customLabel={adminLabels[item.to] ?? ""}
                      visible={isNavItemVisible(
                        item.to,
                        item.canHide,
                        visibilityState
                      )}
                      canHide={item.canHide}
                      onToggle={(v) => setVisible(item.to, v)}
                      onLabelChange={setAdminLabel}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetToDefaults}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Reset visibility (show all)
            </button>
            <button
              type="button"
              onClick={resetAdminLabels}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Reset labels to default
            </button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">
            Operator sidebar
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {operatorNavGroups.map(({ label: groupLabel, items: groupItems }) => (
              <div
                key={groupLabel}
                className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
              >
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {groupLabel}
                </h3>
                <div className="space-y-3">
                  {groupItems.map((item) => (
                    <NavItemRow
                      key={item.to}
                      path={item.to}
                      defaultLabel={item.label}
                      customLabel={operatorLabels[item.to] ?? ""}
                      visible={isOperatorNavItemVisible(
                        item.to,
                        item.canHide,
                        opVisibilityState
                      )}
                      canHide={item.canHide}
                      onToggle={(v) => opSetVisible(item.to, v)}
                      onLabelChange={setOperatorLabel}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={opResetToDefaults}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Reset visibility (show all)
            </button>
            <button
              type="button"
              onClick={resetOperatorLabels}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Reset labels to default
            </button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">
            POS (operator)
          </h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Show or hide elements on the operator POS screen: order type
            (Dine-in / Takeaway / Delivery), table selector, and the item list
            (categories and search).
          </p>
          <div className="min-w-0 max-w-xl rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="space-y-4">
              <MenuOrderVisibilityRow
                label="Order type (Dine-in / Takeaway / Delivery)"
                visible={isMenuOrderOptionVisible(
                  opVisibilityState,
                  MENU_ORDER_SHOW_ORDER_TYPE
                )}
                onToggle={(v) => opSetVisible(MENU_ORDER_SHOW_ORDER_TYPE, v)}
              />
              <MenuOrderVisibilityRow
                label="Table selector"
                visible={isMenuOrderOptionVisible(
                  opVisibilityState,
                  MENU_ORDER_SHOW_TABLE_SELECT
                )}
                onToggle={(v) => opSetVisible(MENU_ORDER_SHOW_TABLE_SELECT, v)}
              />
              <MenuOrderVisibilityRow
                label="Item list (categories and search)"
                visible={isMenuOrderOptionVisible(
                  opVisibilityState,
                  MENU_ORDER_SHOW_ITEM_LIST
                )}
                onToggle={(v) => opSetVisible(MENU_ORDER_SHOW_ITEM_LIST, v)}
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">
            XPOS Assistant
          </h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Show or hide the branch insights assistant button (bottom-right) in admin and
            operator layouts. Hidden by default until enabled for this organization.
          </p>
          <div className="min-w-0 max-w-xl rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <MenuOrderVisibilityRow
              label="Assistant button"
              visible={isAssistantWidgetVisible(opVisibilityState)}
              onToggle={(v) => opSetVisible(ASSISTANT_SHOW_WIDGET, v)}
            />
          </div>
        </section>

        <AssistantUsageSection />

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">
            Standard stock count
          </h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Show or hide toolbar buttons on the operator Standard Stock Taking page.
          </p>
          <div className="min-w-0 max-w-xl rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="space-y-4">
              <MenuOrderVisibilityRow
                label="Download PDF"
                visible={isStdStockCountButtonVisible(
                  opVisibilityState,
                  STD_STOCK_COUNT_SHOW_PDF
                )}
                onToggle={(v) => opSetVisible(STD_STOCK_COUNT_SHOW_PDF, v)}
              />
              <MenuOrderVisibilityRow
                label="Save"
                visible={isStdStockCountButtonVisible(
                  opVisibilityState,
                  STD_STOCK_COUNT_SHOW_SAVE
                )}
                onToggle={(v) => opSetVisible(STD_STOCK_COUNT_SHOW_SAVE, v)}
              />
              <MenuOrderVisibilityRow
                label="Reconcile inventory"
                visible={isStdStockCountButtonVisible(
                  opVisibilityState,
                  STD_STOCK_COUNT_SHOW_RECONCILE
                )}
                onToggle={(v) => opSetVisible(STD_STOCK_COUNT_SHOW_RECONCILE, v)}
              />
              <MenuOrderVisibilityRow
                label="Record sales"
                visible={isStdStockCountButtonVisible(
                  opVisibilityState,
                  STD_STOCK_COUNT_SHOW_RECORD_SALES
                )}
                onToggle={(v) => opSetVisible(STD_STOCK_COUNT_SHOW_RECORD_SALES, v)}
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-white">
            Barcode (per screen)
          </h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Show or hide barcode scan / barcode field on each screen. When
            hidden, the barcode input is not shown on that screen.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Admin
              </h3>
              <div className="space-y-4">
                <MenuOrderVisibilityRow
                  label="Receive stock: barcode scan"
                  visible={isBarcodeVisible(
                    visibilityState,
                    BARCODE_GOODS_RECEIPT
                  )}
                  onToggle={(v) => setVisible(BARCODE_GOODS_RECEIPT, v)}
                />
                <MenuOrderVisibilityRow
                  label="Catalog (Items): barcode field"
                  visible={isBarcodeVisible(visibilityState, BARCODE_ITEMS)}
                  onToggle={(v) => setVisible(BARCODE_ITEMS, v)}
                />
              </div>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Operator
              </h3>
              <div className="space-y-4">
                <MenuOrderVisibilityRow
                  label="POS: barcode scan"
                  visible={isBarcodeVisible(
                    opVisibilityState,
                    BARCODE_MENU_ORDER
                  )}
                  onToggle={(v) => opSetVisible(BARCODE_MENU_ORDER, v)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Dark Mode Theme */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-white">
            Dark Mode Theme
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              { id: "ocean", name: "Ocean", colors: ["#0d2a4a", "#113264", "#164278", "#0ea5e9"] },
              { id: "forest", name: "Magenta", colors: ["#3a1243", "#52124d", "#601558", "#ec4899"] },
              { id: "ember", name: "Midnight", colors: ["#0d0d24", "#141432", "#1c1c3d", "#8b5cf6"] },
              { id: "slate", name: "Slate", colors: ["#111318", "#1a1d24", "#24282f", "#94a3b8"] },
            ] as const).map((theme) => {
              const isActive = darkTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setDarkTheme(theme.id)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition ${
                    isActive
                      ? "border-primary-500 bg-primary-50 shadow-md dark:border-primary-400 dark:bg-primary-900/30"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-slate-500"
                  }`}
                >
                  <div className="flex h-8 w-full overflow-hidden rounded-lg">
                    {theme.colors.map((c, i) => (
                      <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <span className={`text-sm font-medium ${isActive ? "text-primary-700 dark:text-primary-300" : "text-slate-700 dark:text-slate-300"}`}>
                    {theme.name}
                  </span>
                  {isActive && (
                    <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
