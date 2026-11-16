import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateSalt, hashPin } from "@/utils/crypto";

const KEYS = {
  AUTH_TOKEN: "@xpos:auth_token",
  REFRESH_TOKEN: "@xpos:refresh_token",
  USER_INFO: "@xpos:user_info",
  API_BASE_URL: "@xpos:api_base_url",
  KEYCLOAK_URL: "@xpos:keycloak_url",
  REALM: "@xpos:realm",
  CLIENT_ID: "@xpos:client_id",
  SELECTED_ORG_ID: "@xpos:selected_org_id",
  SELECTED_ORG_NAME: "@xpos:selected_org_name",
  SELECTED_BRANCH_ID: "@xpos:selected_branch_id",
  SELECTED_BRANCH_NAME: "@xpos:selected_branch_name",
  SELECTED_TERMINAL_ID: "@xpos:selected_terminal_id",
  SELECTED_TERMINAL_NAME: "@xpos:selected_terminal_name",
  THEME_MODE: "@xpos:theme_mode",
  USERNAME: "@xpos:username",
  CUSTOM_SERVERS: "@xpos:custom_servers",
  OFFLINE_PIN_HASH: "@xpos:offline_pin_hash",
  OFFLINE_PIN_SALT: "@xpos:offline_pin_salt",
  OFFLINE_SESSION_CACHE: "@xpos:offline_session_cache",
};

export interface CustomServer {
  id: string;
  name: string;
  apiBaseUrl: string;
  keycloakUrl: string;
  realm: string;
  clientId: string;
}

export interface OfflineSessionData {
  username: string | null;
  orgId: string | null;
  orgName: string | null;
  branchId: string | null;
  branchName: string | null;
  terminalId: string | null;
  terminalName: string | null;
  lastToken: string | null;
  savedAt: string;
}

export const storage = {
  async getUsername(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.USERNAME);
  },
  async setUsername(username: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.USERNAME, username);
  },
  async clearUsername(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.USERNAME);
  },
  async getAuthToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.AUTH_TOKEN);
  },
  async setAuthToken(token: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.AUTH_TOKEN, token);
  },
  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.REFRESH_TOKEN);
  },
  async setRefreshToken(token: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.REFRESH_TOKEN, token);
  },
  async getApiBaseUrl(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.API_BASE_URL);
  },
  async setApiBaseUrl(url: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.API_BASE_URL, url);
  },
  async getKeycloakUrl(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.KEYCLOAK_URL);
  },
  async setKeycloakUrl(url: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.KEYCLOAK_URL, url);
  },
  async getRealm(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.REALM);
  },
  async setRealm(realm: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.REALM, realm);
  },
  async getClientId(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.CLIENT_ID);
  },
  async setClientId(clientId: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.CLIENT_ID, clientId);
  },
  async getCustomServers(): Promise<CustomServer[]> {
    const raw = await AsyncStorage.getItem(KEYS.CUSTOM_SERVERS);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as CustomServer[];
    } catch {
      return [];
    }
  },
  async setCustomServers(servers: CustomServer[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.CUSTOM_SERVERS, JSON.stringify(servers));
  },
  async getOrgContext(): Promise<{
    orgId: string | null;
    orgName: string | null;
    branchId: string | null;
    branchName: string | null;
    terminalId: string | null;
    terminalName: string | null;
  }> {
    const [orgId, orgName, branchId, branchName, terminalId, terminalName] =
      await Promise.all([
        AsyncStorage.getItem(KEYS.SELECTED_ORG_ID),
        AsyncStorage.getItem(KEYS.SELECTED_ORG_NAME),
        AsyncStorage.getItem(KEYS.SELECTED_BRANCH_ID),
        AsyncStorage.getItem(KEYS.SELECTED_BRANCH_NAME),
        AsyncStorage.getItem(KEYS.SELECTED_TERMINAL_ID),
        AsyncStorage.getItem(KEYS.SELECTED_TERMINAL_NAME),
      ]);
    return { orgId, orgName, branchId, branchName, terminalId, terminalName };
  },
  async setOrgContext(context: {
    orgId?: string | null;
    orgName?: string | null;
    branchId?: string | null;
    branchName?: string | null;
    terminalId?: string | null;
    terminalName?: string | null;
  }): Promise<void> {
    const promises: Promise<void>[] = [];
    if (context.orgId !== undefined) {
      promises.push(
        context.orgId
          ? AsyncStorage.setItem(KEYS.SELECTED_ORG_ID, context.orgId)
          : AsyncStorage.removeItem(KEYS.SELECTED_ORG_ID)
      );
    }
    if (context.orgName !== undefined) {
      promises.push(
        context.orgName
          ? AsyncStorage.setItem(KEYS.SELECTED_ORG_NAME, context.orgName)
          : AsyncStorage.removeItem(KEYS.SELECTED_ORG_NAME)
      );
    }
    if (context.branchId !== undefined) {
      promises.push(
        context.branchId
          ? AsyncStorage.setItem(KEYS.SELECTED_BRANCH_ID, context.branchId)
          : AsyncStorage.removeItem(KEYS.SELECTED_BRANCH_ID)
      );
    }
    if (context.branchName !== undefined) {
      promises.push(
        context.branchName
          ? AsyncStorage.setItem(KEYS.SELECTED_BRANCH_NAME, context.branchName)
          : AsyncStorage.removeItem(KEYS.SELECTED_BRANCH_NAME)
      );
    }
    if (context.terminalId !== undefined) {
      promises.push(
        context.terminalId
          ? AsyncStorage.setItem(KEYS.SELECTED_TERMINAL_ID, context.terminalId)
          : AsyncStorage.removeItem(KEYS.SELECTED_TERMINAL_ID)
      );
    }
    if (context.terminalName !== undefined) {
      promises.push(
        context.terminalName
          ? AsyncStorage.setItem(KEYS.SELECTED_TERMINAL_NAME, context.terminalName)
          : AsyncStorage.removeItem(KEYS.SELECTED_TERMINAL_NAME)
      );
    }
    await Promise.all(promises);
  },
  async clearAll(): Promise<void> {
    const keys = [
      KEYS.AUTH_TOKEN,
      KEYS.REFRESH_TOKEN,
      KEYS.USER_INFO,
      KEYS.SELECTED_ORG_ID,
      KEYS.SELECTED_ORG_NAME,
      KEYS.SELECTED_BRANCH_ID,
      KEYS.SELECTED_BRANCH_NAME,
      KEYS.SELECTED_TERMINAL_ID,
      KEYS.SELECTED_TERMINAL_NAME,
      KEYS.USERNAME,
    ];
    await Promise.all(keys.map((k) => AsyncStorage.removeItem(k)));
  },
  async setOfflinePin(pin: string, sessionData: OfflineSessionData): Promise<void> {
    const salt = generateSalt();
    const hash = hashPin(pin, salt);
    await Promise.all([
      AsyncStorage.setItem(KEYS.OFFLINE_PIN_HASH, hash),
      AsyncStorage.setItem(KEYS.OFFLINE_PIN_SALT, salt),
      AsyncStorage.setItem(KEYS.OFFLINE_SESSION_CACHE, JSON.stringify(sessionData)),
    ]);
  },
  async verifyOfflinePin(pin: string): Promise<boolean> {
    const [hash, salt] = await Promise.all([
      AsyncStorage.getItem(KEYS.OFFLINE_PIN_HASH),
      AsyncStorage.getItem(KEYS.OFFLINE_PIN_SALT),
    ]);
    if (!hash || !salt) return false;
    return hashPin(pin, salt) === hash;
  },
  async hasOfflinePin(): Promise<boolean> {
    const hash = await AsyncStorage.getItem(KEYS.OFFLINE_PIN_HASH);
    return Boolean(hash);
  },
  async clearOfflinePin(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(KEYS.OFFLINE_PIN_HASH),
      AsyncStorage.removeItem(KEYS.OFFLINE_PIN_SALT),
      AsyncStorage.removeItem(KEYS.OFFLINE_SESSION_CACHE),
    ]);
  },
  async getOfflineSession(): Promise<OfflineSessionData | null> {
    const raw = await AsyncStorage.getItem(KEYS.OFFLINE_SESSION_CACHE);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OfflineSessionData;
    } catch {
      return null;
    }
  },
  async saveOfflineSession(sessionData: OfflineSessionData): Promise<void> {
    await AsyncStorage.setItem(KEYS.OFFLINE_SESSION_CACHE, JSON.stringify(sessionData));
  },
};
