import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { storage } from "@/utils/storage";
import { loginKeycloak, parseJwtUsername, isUuid, isTokenExpired, refreshKeycloakToken } from "@/api/auth";
import { set401Handler, setTokenRefreshedHandler } from "@/api/client";
import { DEFAULT_CONFIG } from "@/constants/config";

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

const resolveHumanUsername = async (jwtToken: string | null): Promise<string> => {
  if (jwtToken) {
    const fromJwt = parseJwtUsername(jwtToken);
    if (fromJwt && !isUuid(fromJwt)) return fromJwt;
  }
  const stored = await storage.getUsername();
  if (stored && !isUuid(stored)) return stored;
  return "Operator";
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isRefreshingRef = useRef(false);

  const logout = async () => {
    await storage.clearAll();
    setToken(null);
    setUsername(null);
  };

  useEffect(() => {
    // Register 401 and token-refreshed hooks with api client
    setTokenRefreshedHandler((newToken: string) => {
      setToken(newToken);
      void resolveHumanUsername(newToken).then(setUsername);
    });

    set401Handler(() => {
      void logout();
    });

    return () => {
      setTokenRefreshedHandler(null);
      set401Handler(null);
    };
  }, []);

  useEffect(() => {
    async function initAuth() {
      try {
        const storedToken = await storage.getAuthToken();
        if (storedToken) {
          if (!isTokenExpired(storedToken)) {
            setToken(storedToken);
            const user = await resolveHumanUsername(storedToken);
            setUsername(user);
          } else {
            // Access token expired, attempt to refresh
            const refreshToken = await storage.getRefreshToken();
            if (refreshToken) {
              const keycloakUrl = (await storage.getKeycloakUrl()) || DEFAULT_CONFIG.KEYCLOAK_URL;
              const realm = (await storage.getRealm()) || DEFAULT_CONFIG.KEYCLOAK_REALM;
              const clientId = (await storage.getClientId()) || DEFAULT_CONFIG.KEYCLOAK_CLIENT_ID;
              try {
                const newToken = await refreshKeycloakToken({
                  keycloakUrl,
                  realm,
                  clientId,
                  refreshToken,
                });
                setToken(newToken);
                const user = await resolveHumanUsername(newToken);
                setUsername(user);
                return;
              } catch (refreshErr) {
                console.warn("Stored refresh token invalid, logging out:", refreshErr);
              }
            }
            // If no refresh token or refresh failed, clear session
            await storage.clearAll();
            setToken(null);
            setUsername(null);
          }
        }
      } catch {
        await storage.clearAll();
        setToken(null);
        setUsername(null);
      } finally {
        setIsLoading(false);
      }
    }
    void initAuth();
  }, []);

  // Proactive periodic token refresh before access token expires
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      if (isRefreshingRef.current) return;
      if (isTokenExpired(token, 60)) {
        isRefreshingRef.current = true;
        try {
          const refreshToken = await storage.getRefreshToken();
          if (refreshToken) {
            const keycloakUrl = (await storage.getKeycloakUrl()) || DEFAULT_CONFIG.KEYCLOAK_URL;
            const realm = (await storage.getRealm()) || DEFAULT_CONFIG.KEYCLOAK_REALM;
            const clientId = (await storage.getClientId()) || DEFAULT_CONFIG.KEYCLOAK_CLIENT_ID;
            const newToken = await refreshKeycloakToken({
              keycloakUrl,
              realm,
              clientId,
              refreshToken,
            });
            setToken(newToken);
            const user = await resolveHumanUsername(newToken);
            setUsername(user);
          }
        } catch {
          // Will be handled on demand by 401 interceptor
        } finally {
          isRefreshingRef.current = false;
        }
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [token]);

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
      setUsername(!isUuid(res.username) ? res.username : "Operator");
    } finally {
      setIsLoading(false);
    }
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
