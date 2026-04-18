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
import { SearchableSelect } from "@/components/SearchableSelect";

const TAB_LIST_ID = "inventory-receiving";

const TABS = [
  { id: "suppliers", label: "Suppliers", icon: Truck },
  { id: "stock", label: "Stock", icon: PackagePlus },
  { id: "inventory", label: "Inventory", icon: Package },
] as const;

type TabId = (typeof TABS)[number]["id"];

const VALID_TABS: TabId[] = ["suppliers", "stock", "inventory"];

export function InventoryReceivingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");

  const activeTab = useMemo((): TabId => {
    const normalized = tabParam === "goods-receipt" ? "stock" : tabParam;
    if (normalized && VALID_TABS.includes(normalized as TabId)) {
      return normalized as TabId;
    }
    return "stock";
  }, [tabParam]);

  const token = useAppSelector(selectToken);
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
    if (tabParam === "goods-receipt") {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", "stock");
          return next;
        },
        { replace: true }
      );
    }
  }, [tabParam, setSearchParams]);

  const handleTabChange = (id: TabId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", id);
      return next;
    });
  };

  const orgSelectOptions = useMemo(
    () => [
      { value: "", label: "Select organization" },
      ...orgs.map((org) => ({ value: org.id, label: org.name })),
    ],
    [orgs]
  );

  const branchSelectOptions = useMemo(
    () => [
      { value: "", label: "Select branch" },
      ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
    ],
    [branches]
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
            Stock and Inventory
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Suppliers, stock receiving, and inventory by branch
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
              <SearchableSelect
                id="inv-rec-context-org"
                options={orgSelectOptions}
                value={contextOrgId}
                onChange={(next) => {
                  setContextOrgId(next);
                  setContextBranchId("");
                }}
                placeholder="Search organization…"
                compact
                className="min-w-[11rem]"
                controlClassName="shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor="inv-rec-context-branch"
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Branch
              </label>
              <SearchableSelect
                id="inv-rec-context-branch"
                options={branchSelectOptions}
                value={contextBranchId}
                onChange={setContextBranchId}
                disabled={!contextOrgId}
                placeholder="Search branch…"
                compact
                className="min-w-[11rem]"
                controlClassName="shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500 disabled:opacity-60"
              />
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
        {activeTab === "stock" && (
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
