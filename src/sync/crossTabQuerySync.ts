import type { QueryClient, QueryKey } from "@tanstack/react-query";

const CHANNEL_NAME = "xpos-query-sync";
const DEBOUNCE_MS = 150;
const TAB_ID_STORAGE_KEY = "xpos-tab-id";

export interface OrgContextSnapshot {
  orgId: string | null;
  branchId: string | null;
}

export interface InvalidateBroadcastMessage {
  type: "invalidate";
  tabId: string;
  queryKeys: QueryKey[];
  orgId?: string | null;
  branchId?: string | null;
}

function getOrCreateTabId(): string {
  try {
    const existing = sessionStorage.getItem(TAB_ID_STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const id = crypto.randomUUID();
    sessionStorage.setItem(TAB_ID_STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function serializeQueryKey(key: QueryKey): string {
  return JSON.stringify(key);
}

function deserializeQueryKey(serialized: string): QueryKey | null {
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed as QueryKey;
  } catch {
    return null;
  }
}

function shouldApplyMessage(
  message: InvalidateBroadcastMessage,
  localTabId: string,
  getContext: () => OrgContextSnapshot
): boolean {
  if (message.tabId === localTabId) {
    return false;
  }
  const { orgId, branchId } = getContext();
  if (message.orgId && orgId && message.orgId !== orgId) {
    return false;
  }
  if (message.branchId && branchId && message.branchId !== branchId) {
    return false;
  }
  return true;
}

export type CrossTabQuerySyncHandle = {
  dispose: () => void;
};

export function createCrossTabQuerySync(
  queryClient: QueryClient,
  getContext: () => OrgContextSnapshot
): CrossTabQuerySyncHandle | null {
  if (typeof BroadcastChannel === "undefined") {
    return null;
  }

  const tabId = getOrCreateTabId();
  const channel = new BroadcastChannel(CHANNEL_NAME);
  let applyingRemote = false;
  const pendingKeys = new Map<string, QueryKey>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flushPending = () => {
    flushTimer = null;
    if (pendingKeys.size === 0) {
      return;
    }
    const queryKeys = [...pendingKeys.values()];
    pendingKeys.clear();
    const { orgId, branchId } = getContext();
    const message: InvalidateBroadcastMessage = {
      type: "invalidate",
      tabId,
      queryKeys,
      orgId,
      branchId,
    };
    channel.postMessage(message);
  };

  const scheduleBroadcast = (queryKey: QueryKey) => {
    pendingKeys.set(serializeQueryKey(queryKey), queryKey);
    if (flushTimer != null) {
      clearTimeout(flushTimer);
    }
    flushTimer = setTimeout(flushPending, DEBOUNCE_MS);
  };

  const originalInvalidate = queryClient.invalidateQueries.bind(queryClient);

  queryClient.invalidateQueries = ((filters, options) => {
    const result = originalInvalidate(filters, options);
    if (!applyingRemote && filters && "queryKey" in filters && filters.queryKey) {
      const key = filters.queryKey;
      if (Array.isArray(key)) {
        scheduleBroadcast(key);
      }
    }
    return result;
  }) as typeof queryClient.invalidateQueries;

  channel.onmessage = (event: MessageEvent<InvalidateBroadcastMessage>) => {
    const message = event.data;
    if (!message || message.type !== "invalidate" || !Array.isArray(message.queryKeys)) {
      return;
    }
    if (!shouldApplyMessage(message, tabId, getContext)) {
      return;
    }
    applyingRemote = true;
    void (async () => {
      try {
        for (const queryKey of message.queryKeys) {
          if (Array.isArray(queryKey)) {
            await originalInvalidate({ queryKey });
          }
        }
      } finally {
        applyingRemote = false;
      }
    })();
  };

  return {
    dispose: () => {
      if (flushTimer != null) {
        clearTimeout(flushTimer);
      }
      channel.close();
    },
  };
}

/** @internal Test helpers */
export const crossTabQuerySyncTestUtils = {
  CHANNEL_NAME,
  DEBOUNCE_MS,
  shouldApplyMessage,
  serializeQueryKey,
  deserializeQueryKey,
};
