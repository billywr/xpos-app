import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBusinesses } from "@/api/businesses";
import { fetchBranches } from "@/api/branches";
import { filterActiveOrgs } from "@/types/org";
import { AdminTabList, AdminTabPanel } from "@/components/ui/AdminTabs";
import { OrgsListPage } from "@/features/admin/OrgsListPage";
import { BusinessesListPage } from "@/features/admin/BusinessesListPage";
import { BranchesListPage } from "@/features/admin/BranchesListPage";
import { TerminalsListPage } from "@/features/admin/TerminalsListPage";
import { DevicesListPage } from "@/features/admin/DevicesListPage";
import { StaffListPage } from "@/features/admin/StaffListPage";
import {
  Building2,
  Briefcase,
  MapPin,
  Monitor,
  Smartphone,
  Users,
} from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

const TAB_LIST_ID = "org-setup";

const TABS = [
  { id: "org", label: "Organizations", icon: Building2, dependsOn: null },
  { id: "business", label: "Businesses", icon: Briefcase, dependsOn: "org" },
  { id: "branch", label: "Branches", icon: MapPin, dependsOn: "business" },
  { id: "terminal", label: "Terminals", icon: Monitor, dependsOn: "branch" },
  { id: "device", label: "Devices", icon: Smartphone, dependsOn: "org" },
  { id: "staff", label: "Staff", icon: Users, dependsOn: "org" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function OrgSetupPage() {
  const token = useAppSelector(selectToken);
  const [activeTab, setActiveTab] = useState<TabId>("org");
  const [contextOrgId, setContextOrgId] = useState<string>("");

  const { data: orgsData } = useQuery({
    queryKey: ["admin-orgs", token],
    queryFn: () => fetchOrgs(token, { size: 200 }),
    enabled: Boolean(token),
  });

  const { data: businessesPage } = useQuery({
    queryKey: ["admin-businesses", token, contextOrgId, 0, 1],
    queryFn: () => fetchBusinesses(token, contextOrgId, { page: 0, size: 1 }),
    enabled: Boolean(token) && Boolean(contextOrgId),
  });

  const { data: branchesPage } = useQuery({
    queryKey: ["admin-branches", token, contextOrgId, 0, 1],
    queryFn: () => fetchBranches(token, contextOrgId, { page: 0, size: 1 }),
    enabled: Boolean(token) && Boolean(contextOrgId),
  });

  const orgs = filterActiveOrgs(orgsData?.content ?? []);
  const hasOrgs = orgs.length > 0;
  const hasBusinesses = (businessesPage?.totalElements ?? 0) > 0;
  const hasBranches = (branchesPage?.totalElements ?? 0) > 0;

  useEffect(() => {
    if (!contextOrgId && orgs.length > 0) {
      setContextOrgId(orgs[0].id);
    }
  }, [orgs, contextOrgId]);

  const orgSelectOptions = useMemo(
    () => [
      { value: "", label: "Select organization" },
      ...orgs.map((org) => ({ value: org.id, label: org.name })),
    ],
    [orgs]
  );

  const tabItems = useMemo(() => {
    const isEnabled = (tab: (typeof TABS)[number]): boolean => {
      switch (tab.dependsOn) {
        case null:
          return true;
        case "org":
          return hasOrgs;
        case "business":
          return hasOrgs && hasBusinesses;
        case "branch":
          return hasOrgs && hasBranches;
        default:
          return true;
      }
    };
    const reason = (tab: (typeof TABS)[number]): string => {
      if (tab.dependsOn === null) return "";
      if (!hasOrgs) return "Add at least one organization first.";
      if (tab.dependsOn === "business" && !hasBusinesses) {
        return "Add at least one business for the selected organization first.";
      }
      if (tab.dependsOn === "branch" && !hasBranches) {
        return "Add at least one branch for the selected organization first.";
      }
      return "";
    };
    return TABS.map((tab) => ({
      id: tab.id,
      label: tab.label,
      icon: tab.icon,
      enabled: isEnabled(tab),
      disabledReason: reason(tab) || undefined,
    }));
  }, [hasOrgs, hasBusinesses, hasBranches]);

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Org setup
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Organizations, businesses, branches, terminals, devices, and staff
          </p>
        </div>
        {hasOrgs && activeTab !== "org" && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="org-setup-context-org"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Context org:
            </label>
            <SearchableSelect
              id="org-setup-context-org"
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
        ariaLabel="Org setup sections"
        tabs={tabItems}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
      />

      <AdminTabPanel
        panelId={`${TAB_LIST_ID}-panel-${activeTab}`}
        tabId={`${TAB_LIST_ID}-tab-${activeTab}`}
      >
        {activeTab === "org" && <OrgsListPage />}
        {activeTab === "business" && (
          <BusinessesListPage initialOrgId={contextOrgId || undefined} />
        )}
        {activeTab === "branch" && (
          <BranchesListPage initialOrgId={contextOrgId || undefined} />
        )}
        {activeTab === "terminal" && (
          <TerminalsListPage initialOrgId={contextOrgId || undefined} />
        )}
        {activeTab === "device" && (
          <DevicesListPage initialOrgId={contextOrgId || undefined} />
        )}
        {activeTab === "staff" && (
          <StaffListPage initialOrgId={contextOrgId || undefined} />
        )}
      </AdminTabPanel>
    </div>
  );
}
