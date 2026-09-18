import React, { createContext, useContext, useState, useEffect } from "react";
import { storage } from "@/utils/storage";
import { loginKeycloak, parseJwtSub } from "@/api/auth";

interface AuthContextType {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (params: {
    keycloakUrl: string;
    realm: string;
    clientId: string;
    username: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  username: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      try {
        const storedToken = await storage.getAuthToken();
        if (storedToken) {
          setToken(storedToken);
          const sub = parseJwtSub(storedToken);
          setUsername(sub);
        }
      } finally {
        setIsLoading(false);
      }
    }
    void initAuth();
  }, []);

  const login = async (params: {
    keycloakUrl: string;
    realm: string;
    clientId: string;
    username: string;
    password: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await loginKeycloak(params);
      setToken(res.token);
      setUsername(res.username);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await storage.clearAll();
    setToken(null);
    setUsername(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        username,
        isAuthenticated: Boolean(token),
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
