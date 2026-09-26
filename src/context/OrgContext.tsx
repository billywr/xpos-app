import React, { createContext, useContext, useState, useEffect } from "react";
import { storage } from "@/utils/storage";
import { useAuth } from "@/context/AuthContext";
import { fetchOrgs, fetchBranches, fetchTerminals } from "@/api/context";
import { catalogRepository } from "@/repositories/catalogRepository";

interface OrgContextType {
  orgId: string | null;
  orgName: string | null;
  branchId: string | null;
  branchName: string | null;
  terminalId: string | null;
  terminalName: string | null;
  setOrg: (id: string | null, name: string | null) => Promise<void>;
  setBranch: (id: string | null, name: string | null) => Promise<void>;
  setTerminal: (id: string | null, name: string | null) => Promise<void>;
  clearContext: () => Promise<void>;
  isLoading: boolean;
}

const OrgContext = createContext<OrgContextType>({
  orgId: null,
  orgName: null,
  branchId: null,
  branchName: null,
  terminalId: null,
  terminalName: null,
  setOrg: async () => {},
  setBranch: async () => {},
  setTerminal: async () => {},
  clearContext: async () => {},
  isLoading: true,
});

export const OrgProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [terminalName, setTerminalName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadOrgContext() {
      try {
        const ctx = await storage.getOrgContext();
        setOrgId(ctx.orgId);
        setOrgName(ctx.orgName);
        setBranchId(ctx.branchId);
        setBranchName(ctx.branchName);
        setTerminalId(ctx.terminalId);
        setTerminalName(ctx.terminalName);
      } finally {
        setIsLoading(false);
      }
    }
    void loadOrgContext();
  }, []);

  // Automatically select first org, branch, and terminal if not already selected
  useEffect(() => {
    if (!token) {
      setOrgId(null);
      setOrgName(null);
      setBranchId(null);
      setBranchName(null);
      setTerminalId(null);
      setTerminalName(null);
      return;
    }

    let isMounted = true;
    async function autoSelect() {
      try {
        let currentOrgId = orgId;
        let currentOrgName = orgName;
        let currentBranchId = branchId;
        let currentBranchName = branchName;
        let currentTerminalId = terminalId;

        // Fetch organizations available to this authenticated user in this environment
        const orgsRes = await fetchOrgs(token);
        const orgs = orgsRes?.content ?? [];

        // If currentOrgId is not set or belongs to another environment (stale UUID), reset to first org
        const matchedOrg = orgs.find((o) => o.id === currentOrgId);
        if (!matchedOrg && orgs.length > 0 && isMounted) {
          currentOrgId = orgs[0].id;
          currentOrgName = orgs[0].name;
          setOrgId(currentOrgId);
          setOrgName(currentOrgName);
          currentBranchId = null;
          currentBranchName = null;
          setBranchId(null);
          setBranchName(null);
          currentTerminalId = null;
          setTerminalId(null);
          setTerminalName(null);
          await storage.setOrgContext({
            orgId: currentOrgId,
            orgName: currentOrgName,
            branchId: null,
            branchName: null,
            terminalId: null,
            terminalName: null,
          });
        }

        if (token && currentOrgId) {
          void catalogRepository.hydrateCatalog(token, currentOrgId);
        }

        // Validate or select branch
        if (currentOrgId && isMounted) {
          const branchesRes = await fetchBranches(token, currentOrgId);
          const branches = branchesRes?.content ?? [];
          const matchedBranch = branches.find((b) => b.id === currentBranchId);
          if (!matchedBranch && branches.length > 0 && isMounted) {
            currentBranchId = branches[0].id;
            currentBranchName = branches[0].name;
            setBranchId(currentBranchId);
            setBranchName(currentBranchName);
            currentTerminalId = null;
            setTerminalId(null);
            setTerminalName(null);
            await storage.setOrgContext({
              branchId: currentBranchId,
              branchName: currentBranchName,
              terminalId: null,
              terminalName: null,
            });
          }
        }

        // Validate or select terminal
        if (currentOrgId && currentBranchId && isMounted) {
          const terminalsRes = await fetchTerminals(token, currentOrgId, currentBranchId);
          const terminals = terminalsRes?.content ?? [];
          const matchedTerminal = terminals.find((t) => t.id === currentTerminalId);
          if (!matchedTerminal && terminals.length > 0 && isMounted) {
            const firstTerminal = terminals[0];
            setTerminalId(firstTerminal.id);
            setTerminalName(firstTerminal.name);
            await storage.setOrgContext({
              terminalId: firstTerminal.id,
              terminalName: firstTerminal.name,
            });
          }
        }
      } catch {
        // Silently continue if network fails
      }
    }

    void autoSelect();
  }, [token]);

  const setOrg = async (id: string | null, name: string | null) => {
    setOrgId(id);
    setOrgName(name);
    setBranchId(null);
    setBranchName(null);
    setTerminalId(null);
    setTerminalName(null);
    if (token && id) {
      void catalogRepository.hydrateCatalog(token, id);
    }
    await storage.setOrgContext({
      orgId: id,
      orgName: name,
      branchId: null,
      branchName: null,
      terminalId: null,
      terminalName: null,
    });
  };

  const setBranch = async (id: string | null, name: string | null) => {
    setBranchId(id);
    setBranchName(name);
    setTerminalId(null);
    setTerminalName(null);
    await storage.setOrgContext({
      branchId: id,
      branchName: name,
      terminalId: null,
      terminalName: null,
    });
  };

  const setTerminal = async (id: string | null, name: string | null) => {
    setTerminalId(id);
    setTerminalName(name);
    await storage.setOrgContext({
      terminalId: id,
      terminalName: name,
    });
  };

  const clearContext = async () => {
    setOrgId(null);
    setOrgName(null);
    setBranchId(null);
    setBranchName(null);
    setTerminalId(null);
    setTerminalName(null);
    await storage.setOrgContext({
      orgId: null,
      orgName: null,
      branchId: null,
      branchName: null,
      terminalId: null,
      terminalName: null,
    });
  };

  return (
    <OrgContext.Provider
      value={{
        orgId,
        orgName,
        branchId,
        branchName,
        terminalId,
        terminalName,
        setOrg,
        setBranch,
        setTerminal,
        clearContext,
        isLoading,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
};

export const useOrg = () => useContext(OrgContext);
