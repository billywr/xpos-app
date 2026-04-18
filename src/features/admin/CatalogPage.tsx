import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { filterActiveOrgs } from "@/types/org";
import { AdminTabList, AdminTabPanel } from "@/components/ui/AdminTabs";
import { CategoriesListPage } from "@/features/admin/CategoriesListPage";
import { ItemsListPage } from "@/features/admin/ItemsListPage";
import { FolderTree, Package } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const TAB_LIST_ID = "catalog";

const TABS = [
  { id: "categories", label: "Categories", icon: FolderTree },
  { id: "items", label: "Items", icon: Package },
] as const;

type TabId = (typeof TABS)[number]["id"];

const VALID_TAB_IDS: TabId[] = TABS.map((t) => t.id);

function catalogTabFromQuery(tabParam: string | null): TabId {
  if (tabParam && VALID_TAB_IDS.includes(tabParam as TabId)) {
    return tabParam as TabId;
  }
  return "items";
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = useMemo(() => catalogTabFromQuery(tabParam), [tabParam]);

  const token = useAppSelector(selectToken);
  const queryClient = useQueryClient();
  const [contextOrgId, setContextOrgId] = useState<string>("");

  const handleTabChange = (id: TabId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", id);
      return next;
    });
  };

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

  const orgSelectOptions = useMemo(
    () => [
      { value: "", label: "Select organization" },
      ...orgs.map((org) => ({ value: org.id, label: org.name })),
    ],
    [orgs]
  );

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
            <SearchableSelect
              id="catalog-context-org"
              options={orgSelectOptions}
              value={contextOrgId}
              onChange={setContextOrgId}
              placeholder="Search organization…"
              compact
              className="min-w-[11rem]"
              controlClassName="shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500"
            />
          </div>
        )}
      </div>

      <AdminTabList
        tabListId={TAB_LIST_ID}
        ariaLabel="Catalog sections"
        tabs={tabItems}
        activeTab={activeTab}
        onTabChange={(id) => handleTabChange(id as TabId)}
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
        {activeTab === "items" && (
          <ItemsListPage
            initialOrgId={contextOrgId || undefined}
            onOrgChange={setContextOrgId}
          />
        )}
      </AdminTabPanel>
    </div>
  );
}
