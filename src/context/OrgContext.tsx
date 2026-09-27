import React, { createContext, useContext, useState, useEffect } from "react";
import { storage } from "@/utils/storage";
import { getDatabase } from "@/db/database";

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
  orgId: "offline-org",
  orgName: "My Store",
  branchId: "offline-branch",
  branchName: "Main Store",
  terminalId: "offline-terminal",
  terminalName: "POS-01",
  setOrg: async () => {},
  setBranch: async () => {},
  setTerminal: async () => {},
  clearContext: async () => {},
  isLoading: false,
});

export const OrgProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [orgId, setOrgId] = useState<string | null>("offline-org");
  const [orgName, setOrgName] = useState<string | null>("My Store");
  const [branchId, setBranchId] = useState<string | null>("offline-branch");
  const [branchName, setBranchName] = useState<string | null>("Main Store");
  const [terminalId, setTerminalId] = useState<string | null>("offline-terminal");
  const [terminalName, setTerminalName] = useState<string | null>("POS-01");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadOfflineContext() {
      try {
        const db = await getDatabase();
        const storeNameSetting = await db.getFirstAsync<{ value: string }>(
          `SELECT value FROM store_settings WHERE key = 'store_name'`
        );
        const branchNameSetting = await db.getFirstAsync<{ value: string }>(
          `SELECT value FROM store_settings WHERE key = 'branch_name'`
        );

        if (storeNameSetting?.value) {
          setOrgName(storeNameSetting.value);
        }
        if (branchNameSetting?.value) {
          setBranchName(branchNameSetting.value);
        }
      } catch (err) {
        console.warn("Failed to load local store settings:", err);
      } finally {
        setIsLoading(false);
      }
    }
    void loadOfflineContext();
  }, []);

  const setOrg = async (id: string | null, name: string | null) => {
    setOrgId(id || "offline-org");
    setOrgName(name || "My Store");
    if (name) {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT OR REPLACE INTO store_settings (key, value) VALUES ('store_name', ?)`,
        [name]
      );
    }
  };

  const setBranch = async (id: string | null, name: string | null) => {
    setBranchId(id || "offline-branch");
    setBranchName(name || "Main Store");
    if (name) {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT OR REPLACE INTO store_settings (key, value) VALUES ('branch_name', ?)`,
        [name]
      );
    }
  };

  const setTerminal = async (id: string | null, name: string | null) => {
    setTerminalId(id || "offline-terminal");
    setTerminalName(name || "POS-01");
  };

  const clearContext = async () => {
    setOrgId("offline-org");
    setOrgName("My Store");
    setBranchId("offline-branch");
    setBranchName("Main Store");
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
