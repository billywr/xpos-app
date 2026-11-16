import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";
import { storage } from "@/utils/storage";
import { loginKeycloak, parseJwtUsername, isUuid, isTokenExpired, refreshKeycloakToken } from "@/api/auth";
import { set401Handler, setTokenRefreshedHandler } from "@/api/client";
import { DEFAULT_CONFIG } from "@/constants/config";

interface AuthContextType {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasOfflinePin: boolean;
  isOfflineSession: boolean;
  login: (params: {
    keycloakUrl: string;
    realm: string;
    clientId: string;
    username: string;
    password: string;
  }) => Promise<void>;
  loginWithOfflinePin: (pin: string) => Promise<boolean>;
  refreshOfflinePinStatus: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  username: null,
  isAuthenticated: false,
  isLoading: true,
  hasOfflinePin: false,
  isOfflineSession: false,
  login: async () => {},
  loginWithOfflinePin: async () => false,
  refreshOfflinePinStatus: async () => {},
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
  const [hasOfflinePin, setHasOfflinePin] = useState(false);
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const isRefreshingRef = useRef(false);

  const refreshOfflinePinStatus = async () => {
    const hasPin = await storage.hasOfflinePin();
    setHasOfflinePin(hasPin);
  };

  const logout = async () => {
    await storage.clearAll();
    setToken(null);
    setUsername(null);
    setIsOfflineSession(false);
    await refreshOfflinePinStatus();
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
        await refreshOfflinePinStatus();
        const storedToken = await storage.getAuthToken();
        if (storedToken) {
          if (!isTokenExpired(storedToken)) {
            setToken(storedToken);
            const user = await resolveHumanUsername(storedToken);
            setUsername(user);
          } else {
            // Check network status before attempting refresh
            const net = await NetInfo.fetch();
            if (!net.isConnected) {
              // We are offline; keep stored token as offline session
              setToken(storedToken);
              const user = await resolveHumanUsername(storedToken);
              setUsername(user);
              setIsOfflineSession(true);
              return;
            }

            // Access token expired and online, attempt to refresh
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
              } catch (refreshErr: any) {
                // If network failure during refresh, do not wipe session
                if (refreshErr?.message?.includes("network failure")) {
                  setToken(storedToken);
                  const user = await resolveHumanUsername(storedToken);
                  setUsername(user);
                  setIsOfflineSession(true);
                  return;
                }
                console.warn("Stored refresh token invalid, logging out:", refreshErr);
              }
            }
            // If explicit invalid grant from Keycloak, clear session
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
    if (!token || isOfflineSession) return;
    const interval = setInterval(async () => {
      if (isRefreshingRef.current) return;
      if (isTokenExpired(token, 60)) {
        isRefreshingRef.current = true;
        try {
          const net = await NetInfo.fetch();
          if (!net.isConnected) return;

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
  }, [token, isOfflineSession]);

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
      const uname = !isUuid(res.username) ? res.username : "Operator";
      setUsername(uname);
      setIsOfflineSession(false);
      await refreshOfflinePinStatus();

      // Persist offline session snapshot
      const orgCtx = await storage.getOrgContext();
      await storage.saveOfflineSession({
        username: uname,
        orgId: orgCtx.orgId,
        orgName: orgCtx.orgName,
        branchId: orgCtx.branchId,
        branchName: orgCtx.branchName,
        terminalId: orgCtx.terminalId,
        terminalName: orgCtx.terminalName,
        lastToken: res.token,
        savedAt: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithOfflinePin = async (pin: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const isValid = await storage.verifyOfflinePin(pin);
      if (!isValid) {
        return false;
      }
      const offlineSession = await storage.getOfflineSession();
      const existingToken =
        (await storage.getAuthToken()) ||
        offlineSession?.lastToken ||
        `offline-session-${Date.now()}`;

      await storage.setAuthToken(existingToken);
      setToken(existingToken);

      const user = offlineSession?.username || (await storage.getUsername()) || "Operator";
      setUsername(user);
      setIsOfflineSession(true);

      if (offlineSession) {
        await storage.setOrgContext({
          orgId: offlineSession.orgId,
          orgName: offlineSession.orgName,
          branchId: offlineSession.branchId,
          branchName: offlineSession.branchName,
          terminalId: offlineSession.terminalId,
          terminalName: offlineSession.terminalName,
        });
      }
      return true;
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
        hasOfflinePin,
        isOfflineSession,
        login,
        loginWithOfflinePin,
        refreshOfflinePinStatus,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
