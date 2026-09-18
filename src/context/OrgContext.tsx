import React, { createContext, useContext, useState, useEffect } from "react";
import { storage } from "@/utils/storage";

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

  const setOrg = async (id: string | null, name: string | null) => {
    setOrgId(id);
    setOrgName(name);
    setBranchId(null);
    setBranchName(null);
    setTerminalId(null);
    setTerminalName(null);
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
