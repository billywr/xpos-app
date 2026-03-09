import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { filterActiveOrgs, filterNonDeletedBranches } from "@/types/org";
import { AdminTabList, AdminTabPanel } from "@/components/ui/AdminTabs";
import { SuppliersListPage } from "@/features/admin/SuppliersListPage";
import { GoodsReceiptPage } from "@/features/admin/GoodsReceiptPage";
import { InventoryPage } from "@/features/admin/InventoryPage";
import { Truck, PackagePlus, Package } from "lucide-react";

const TAB_LIST_ID = "inventory-receiving";

const TABS = [
  { id: "suppliers", label: "Suppliers", icon: Truck },
  { id: "goods-receipt", label: "Goods Receipt", icon: PackagePlus },
  { id: "inventory", label: "Inventory", icon: Package },
] as const;

type TabId = (typeof TABS)[number]["id"];

const VALID_TABS: TabId[] = ["suppliers", "goods-receipt", "inventory"];

export function InventoryReceivingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: TabId =
    tabParam && VALID_TABS.includes(tabParam as TabId) ? (tabParam as TabId) : "suppliers";

  const token = useAppSelector(selectToken);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [contextOrgId, setContextOrgId] = useState<string>("");
  const [contextBranchId, setContextBranchId] = useState<string>("");

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: branchesData } = useQuery({
    queryKey: ["admin-branches", token, contextOrgId],
    queryFn: () => fetchBranches(token, contextOrgId, { size: 200 }),
    enabled: Boolean(token) && Boolean(contextOrgId),
  });

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const branches = filterNonDeletedBranches(branchesData?.content ?? []);
  const hasOrgs = orgs.length > 0;

  useEffect(() => {
    if (!contextOrgId && orgs.length > 0) {
      setContextOrgId(orgs[0].id);
    }
  }, [orgs, contextOrgId]);

  useEffect(() => {
    if (contextOrgId && !contextBranchId && branches.length > 0) {
      setContextBranchId(branches[0].id);
    } else if (!contextOrgId) {
      setContextBranchId("");
    }
  }, [contextOrgId, contextBranchId, branches]);

  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam as TabId) && tabParam !== activeTab) {
      setActiveTab(tabParam as TabId);
    }
  }, [tabParam]);

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", id);
      return next;
    });
  };

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
            Inventory &amp; Receiving
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Suppliers, goods receipt, and inventory by branch
          </p>
        </div>
        {hasOrgs && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label
                htmlFor="inv-rec-context-org"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Organization
              </label>
              <select
                id="inv-rec-context-org"
                value={contextOrgId}
                onChange={(e) => {
                  setContextOrgId(e.target.value);
                  setContextBranchId("");
                }}
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
            <div className="flex items-center gap-2">
              <label
                htmlFor="inv-rec-context-branch"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Branch
              </label>
              <select
                id="inv-rec-context-branch"
                value={contextBranchId}
                onChange={(e) => setContextBranchId(e.target.value)}
                disabled={!contextOrgId}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              >
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <AdminTabList
        tabListId={TAB_LIST_ID}
        ariaLabel="Inventory sections"
        tabs={tabItems}
        activeTab={activeTab}
        onTabChange={(id) => handleTabChange(id as TabId)}
      />

      <AdminTabPanel
        panelId={`${TAB_LIST_ID}-panel-${activeTab}`}
        tabId={`${TAB_LIST_ID}-tab-${activeTab}`}
      >
        {activeTab === "suppliers" && (
          <SuppliersListPage
            initialOrgId={contextOrgId || undefined}
            onOrgChange={setContextOrgId}
          />
        )}
        {activeTab === "goods-receipt" && (
          <GoodsReceiptPage
            initialOrgId={contextOrgId || undefined}
            initialBranchId={contextBranchId || undefined}
            onOrgChange={setContextOrgId}
            onBranchChange={setContextBranchId}
          />
        )}
        {activeTab === "inventory" && (
          <InventoryPage
            initialOrgId={contextOrgId || undefined}
            initialBranchId={contextBranchId || undefined}
            onOrgChange={setContextOrgId}
            onBranchChange={setContextBranchId}
          />
        )}
      </AdminTabPanel>
    </div>
  );
}
