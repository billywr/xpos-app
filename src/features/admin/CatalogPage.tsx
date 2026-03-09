import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { filterActiveOrgs } from "@/types/org";
import { AdminTabList, AdminTabPanel } from "@/components/ui/AdminTabs";
import { CategoriesListPage } from "@/features/admin/CategoriesListPage";
import { UomsListPage } from "@/features/admin/UomsListPage";
import { ItemsListPage } from "@/features/admin/ItemsListPage";
import { PriceListsListPage } from "@/features/admin/PriceListsListPage";
import { PriceListItemsListPage } from "@/features/admin/PriceListItemsListPage";
import { FolderTree, Ruler, Package, Receipt, ListChecks } from "lucide-react";

const TAB_LIST_ID = "catalog";

const TABS = [
  { id: "categories", label: "Categories", icon: FolderTree },
  { id: "uoms", label: "Units (UOM)", icon: Ruler },
  { id: "items", label: "Items", icon: Package },
  { id: "price-lists", label: "Price lists", icon: Receipt },
  { id: "price-list-items", label: "Price list items", icon: ListChecks },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function CatalogPage() {
  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("categories");
  const [contextOrgId, setContextOrgId] = useState<string>("");

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const hasOrgs = orgs.length > 0;

  useEffect(() => {
    if (!contextOrgId && orgs.length > 0) {
      setContextOrgId(orgs[0].id);
    }
  }, [orgs, contextOrgId]);

  // When switching to Items tab, invalidate categories so dropdown shows latest (e.g. newly created on Categories tab)
  useEffect(() => {
    if (activeTab === "items" && contextOrgId && token) {
      queryClient.invalidateQueries({
        queryKey: ["admin-categories", token, contextOrgId],
      });
    }
  }, [activeTab, contextOrgId, token, queryClient]);

  const tabItems = useMemo(
    () =>
      TABS.map((tab) => ({
        id: tab.id,
        label: tab.label,
        icon: tab.icon,
        enabled: hasOrgs,
        disabledReason: hasOrgs ? undefined : "Add at least one organization first.",
      })),
    [hasOrgs]
  );

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Catalog
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Categories, units of measure, items, and price lists
          </p>
        </div>
        {hasOrgs && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="catalog-context-org"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Context org:
            </label>
            <select
              id="catalog-context-org"
              value={contextOrgId}
              onChange={(e) => setContextOrgId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <option value="">Select organization</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <AdminTabList
        tabListId={TAB_LIST_ID}
        ariaLabel="Catalog sections"
        tabs={tabItems}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
      />

      <AdminTabPanel
        panelId={`${TAB_LIST_ID}-panel-${activeTab}`}
        tabId={`${TAB_LIST_ID}-tab-${activeTab}`}
      >
        {activeTab === "categories" && (
          <CategoriesListPage
            initialOrgId={contextOrgId || undefined}
            onOrgChange={setContextOrgId}
          />
        )}
        {activeTab === "uoms" && (
          <UomsListPage
            initialOrgId={contextOrgId || undefined}
            onOrgChange={setContextOrgId}
          />
        )}
        {activeTab === "items" && (
          <ItemsListPage
            initialOrgId={contextOrgId || undefined}
            onOrgChange={setContextOrgId}
          />
        )}
        {activeTab === "price-lists" && (
          <PriceListsListPage
            initialOrgId={contextOrgId || undefined}
            onOrgChange={setContextOrgId}
          />
        )}
        {activeTab === "price-list-items" && (
          <PriceListItemsListPage
            initialOrgId={contextOrgId || undefined}
            onOrgChange={setContextOrgId}
          />
        )}
      </AdminTabPanel>
    </div>
  );
}
