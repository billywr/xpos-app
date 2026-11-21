import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { setOrg, setBranch, setTerminal, clearContext } from "@/store/slices/orgContextSlice";
import { selectToken } from "@/store/selectors/authSelectors";
import { fetchOrgs } from "@/api/orgs";
import { fetchBranches } from "@/api/branches";
import { fetchTerminals } from "@/api/terminals";
import type { Branch, Org, Terminal } from "@/types/org";
import {
  filterActiveOrgs,
  filterNonDeletedBranches,
  filterNonDeletedTerminals,
} from "@/types/org";
import { Store, ChevronRight } from "lucide-react";
import {
  getStoredContext,
  setStoredContext,
  clearStoredContext,
} from "@/utils/contextStorage";

export function SelectContextPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/";
  const token = useAppSelector(selectToken);
  const dispatch = useAppDispatch();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedOrgName, setSelectedOrgName] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);

  const { data: orgsData, isLoading: orgsLoading } = useQuery({
    queryKey: ["orgs", token],
    queryFn: () => fetchOrgs(token, { size: 100 }),
    enabled: Boolean(token),
  });

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ["branches", token, selectedOrgId],
    queryFn: () => fetchBranches(token, selectedOrgId!, { size: 100 }),
    enabled: Boolean(token && selectedOrgId),
  });

  const { data: terminalsData, isLoading: terminalsLoading } = useQuery({
    queryKey: ["terminals", token, selectedOrgId, selectedBranch?.id],
    queryFn: () =>
      fetchTerminals(token, selectedOrgId!, selectedBranch!.id, { size: 100 }),
    enabled: Boolean(token && selectedOrgId && selectedBranch?.id),
  });

  const allOrgs = orgsData?.content ?? [];
  const orgs = useMemo(() => filterActiveOrgs(allOrgs), [allOrgs]);
  const branches = useMemo(
    () => filterNonDeletedBranches(branchesData?.content ?? []),
    [branchesData?.content]
  );
  const terminals = useMemo(
    () => filterNonDeletedTerminals(terminalsData?.content ?? []),
    [terminalsData?.content]
  );

  useEffect(() => {
    if (orgs.length === 0) return;
    const persisted = getStoredContext();
    if (persisted && !orgs.some((o: Org) => o.id === persisted.orgId)) {
      clearStoredContext();
      dispatch(clearContext());
    }
  }, [orgs, dispatch]);

  useEffect(() => {
    if (orgs.length === 1 && !selectedOrgId) {
      const first = orgs[0] as Org;
      setSelectedOrgId(first.id);
      setSelectedOrgName(first.name);
      setSelectedBranch(null);
      setSelectedTerminal(null);
      dispatch(setOrg({ orgId: first.id, orgName: first.name }));
    }
  }, [orgs, selectedOrgId, dispatch]);

  useEffect(() => {
    if (
      selectedOrgId &&
      branches.length === 1 &&
      (!selectedBranch || selectedBranch.id !== branches[0].id)
    ) {
      const first = branches[0];
      setSelectedBranch(first);
      setSelectedTerminal(null);
      dispatch(setBranch({ branchId: first.id, branchName: first.name }));
    }
  }, [selectedOrgId, branches, selectedBranch?.id, dispatch]);

  useEffect(() => {
    if (
      selectedBranch &&
      terminals.length === 1 &&
      (!selectedTerminal || selectedTerminal.id !== terminals[0].id)
    ) {
      const first = terminals[0];
      setSelectedTerminal(first);
      dispatch(
        setTerminal({
          terminalId: first.id,
          terminalName: first.terminalCode,
        })
      );
    }
  }, [selectedBranch, terminals, selectedTerminal?.id, dispatch]);

  const handleOrgSelect = (orgId: string, orgName: string) => {
    setSelectedOrgId(orgId);
    setSelectedOrgName(orgName);
    setSelectedBranch(null);
    setSelectedTerminal(null);
    dispatch(setOrg({ orgId, orgName }));
  };

  const handleBranchSelect = (branch: Branch) => {
    setSelectedBranch(branch);
    setSelectedTerminal(null);
    dispatch(setBranch({ branchId: branch.id, branchName: branch.name }));
  };

  const handleTerminalSelect = (terminal: Terminal) => {
    setSelectedTerminal(terminal);
    dispatch(
      setTerminal({
        terminalId: terminal.id,
        terminalName: terminal.terminalCode,
      })
    );
  };

  const handleConfirm = () => {
    if (!selectedOrgId || !selectedBranch || !selectedTerminal) return;
    setStoredContext({
      orgId: selectedOrgId,
      orgName: selectedOrgName,
      branchId: selectedBranch.id,
      branchName: selectedBranch.name,
      terminalId: selectedTerminal.id,
      terminalName: selectedTerminal.terminalCode,
    });
    navigate(returnTo, { replace: true });
  };

  const canConfirm = Boolean(selectedOrgId && selectedBranch && selectedTerminal);
  const isFullyDeterministic =
    orgs.length === 1 && branches.length === 1 && terminals.length === 1;

  useEffect(() => {
    if (!canConfirm || !isFullyDeterministic) return;
    if (!selectedOrgId || !selectedBranch || !selectedTerminal) return;
    setStoredContext({
      orgId: selectedOrgId,
      orgName: selectedOrgName,
      branchId: selectedBranch.id,
      branchName: selectedBranch.name,
      terminalId: selectedTerminal.id,
      terminalName: selectedTerminal.terminalCode,
    });
    navigate(returnTo, { replace: true });
  }, [
    canConfirm,
    isFullyDeterministic,
    selectedOrgId,
    selectedOrgName,
    selectedBranch,
    selectedTerminal,
    returnTo,
    navigate,
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 flex items-center gap-2 text-slate-800 dark:text-white">
        <Store className="h-8 w-8 text-primary-600 dark:text-primary-400" />
        <h1 className="text-2xl font-bold">Select context</h1>
      </div>
      <p className="mb-6 text-slate-600 dark:text-slate-300">
        Choose organization, branch, and terminal to use for this session.
      </p>

      {/* Step 1: Org (hidden when only one organization) */}
      {orgs.length !== 1 && (
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
          1. Organization
        </h2>
        {orgsLoading ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
            Loading organizations…
          </div>
        ) : orgs.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            No organizations found. Create one in Admin first.
          </div>
        ) : (
          <ul className="space-y-2">
            {orgs.map((org) => (
              <li key={org.id}>
                <button
                  type="button"
                  onClick={() => handleOrgSelect(org.id, org.name)}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                    selectedOrgId === org.id
                      ? "border-primary-500 bg-primary-50 text-primary-800 dark:border-primary-500 dark:bg-primary-900/40 dark:text-primary-200"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:border-slate-500 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className="font-medium">{org.name}</span>
                  <ChevronRight className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {/* Step 2: Branch (hidden when only one branch) */}
      {branches.length !== 1 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {orgs.length === 1 ? "1. Branch" : "2. Branch"}
          </h2>
          {!selectedOrgId ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
              Select an organization first.
            </div>
          ) : branchesLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
              Loading branches…
            </div>
          ) : branches.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              No branches for this org. Create one in Admin.
            </div>
          ) : (
            <ul className="space-y-2">
              {branches.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => handleBranchSelect(b)}
                    className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                      selectedBranch?.id === b.id
                        ? "border-primary-500 bg-primary-50 text-primary-800 dark:border-primary-500 dark:bg-primary-900/40 dark:text-primary-200"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:border-slate-500 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span className="font-medium">{b.name}</span>
                    <ChevronRight className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Step 3: Terminal */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
          {orgs.length === 1 && branches.length === 1
            ? "1. Terminal"
            : orgs.length === 1 || branches.length === 1
            ? "2. Terminal"
            : "3. Terminal"}
        </h2>
        {!selectedBranch ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
            Select a branch first.
          </div>
        ) : terminalsLoading ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
            Loading terminals…
          </div>
        ) : terminals.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            No terminals for this branch. Create one in Admin.
          </div>
        ) : (
          <ul className="space-y-2">
            {terminals.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => handleTerminalSelect(t)}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                    selectedTerminal?.id === t.id
                      ? "border-primary-500 bg-primary-50 text-primary-800 dark:border-primary-500 dark:bg-primary-900/40 dark:text-primary-200"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:border-slate-500 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className="font-medium">{t.terminalCode}</span>
                  <ChevronRight className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="rounded-lg bg-primary-600 px-6 py-2.5 font-medium text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
