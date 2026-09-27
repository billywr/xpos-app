import React, { createContext, useContext, useState, useEffect } from "react";
import { storage } from "@/utils/storage";

interface AuthContextType {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (params?: any) => Promise<void>;
  logout: () => Promise<void>;
  setUsername: (name: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  token: "offline-token",
  username: "Store Manager",
  isAuthenticated: true,
  isLoading: false,
  login: async () => {},
  logout: async () => {},
  setUsername: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>("offline-token");
  const [username, setUsernameState] = useState<string>("Store Manager");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initOfflineAuth() {
      try {
        const storedUser = await storage.getUsername();
        if (storedUser) {
          setUsernameState(storedUser);
        }
      } catch (err) {
        console.warn("Failed to load local user:", err);
      } finally {
        setIsLoading(false);
      }
    }
    void initOfflineAuth();
  }, []);

  const login = async (params?: any) => {
    const user = params?.username?.trim() || "Store Manager";
    setUsernameState(user);
    setToken("offline-token");
    await storage.setUsername(user);
  };

  const logout = async () => {
    // In standalone offline mode, resetting preserves data and returns to Store Manager
    setUsernameState("Store Manager");
    setToken("offline-token");
  };

  const setUsername = (name: string) => {
    setUsernameState(name);
    void storage.setUsername(name);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        username,
        isAuthenticated: true, // Always directly authenticated in offline mode
        isLoading,
        login,
        logout,
        setUsername,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
