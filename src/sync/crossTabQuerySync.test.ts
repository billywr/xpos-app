import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  createCrossTabQuerySync,
  crossTabQuerySyncTestUtils,
  type InvalidateBroadcastMessage,
} from "./crossTabQuerySync";

const { CHANNEL_NAME, DEBOUNCE_MS, shouldApplyMessage } = crossTabQuerySyncTestUtils;

type PostedMessage = InvalidateBroadcastMessage;

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];

  readonly name: string;
  onmessage: ((event: MessageEvent<PostedMessage>) => void) | null = null;
  readonly posted: PostedMessage[] = [];

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(data: PostedMessage): void {
    this.posted.push(data);
    for (const channel of MockBroadcastChannel.instances) {
      if (channel !== this && channel.onmessage) {
        channel.onmessage({ data } as MessageEvent<PostedMessage>);
      }
    }
  }

  close(): void {
    const index = MockBroadcastChannel.instances.indexOf(this);
    if (index >= 0) {
      MockBroadcastChannel.instances.splice(index, 1);
    }
  }
}

function mockSessionTabId(tabId: string): void {
  const storage = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  });
  storage.set("xpos-tab-id", tabId);
}

describe("crossTabQuerySync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockBroadcastChannel.instances = [];
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("shouldApplyMessage", () => {
    const getContext = () => ({ orgId: "org-1", branchId: "branch-1" });

    it("suppresses echo from the same tab", () => {
      const message: InvalidateBroadcastMessage = {
        type: "invalidate",
        tabId: "tab-a",
        queryKeys: [["std-stock-count"]],
      };
      expect(shouldApplyMessage(message, "tab-a", getContext)).toBe(false);
    });

    it("accepts messages from another tab in the same org/branch", () => {
      const message: InvalidateBroadcastMessage = {
        type: "invalidate",
        tabId: "tab-b",
        queryKeys: [["std-stock-count"]],
        orgId: "org-1",
        branchId: "branch-1",
      };
      expect(shouldApplyMessage(message, "tab-a", getContext)).toBe(true);
    });

    it("rejects messages from a different org", () => {
      const message: InvalidateBroadcastMessage = {
        type: "invalidate",
        tabId: "tab-b",
        queryKeys: [["std-stock-count"]],
        orgId: "org-other",
      };
      expect(shouldApplyMessage(message, "tab-a", getContext)).toBe(false);
    });

    it("rejects messages from a different branch", () => {
      const message: InvalidateBroadcastMessage = {
        type: "invalidate",
        tabId: "tab-b",
        queryKeys: [["std-stock-count"]],
        orgId: "org-1",
        branchId: "branch-other",
      };
      expect(shouldApplyMessage(message, "tab-a", getContext)).toBe(false);
    });
  });

  describe("broadcast debounce", () => {
    it("coalesces rapid invalidations into one broadcast", () => {
      mockSessionTabId("tab-local");
      const queryClient = new QueryClient();
      createCrossTabQuerySync(queryClient, () => ({
        orgId: "org-1",
        branchId: "branch-1",
      }));

      queryClient.invalidateQueries({ queryKey: ["std-stock-count"] });
      queryClient.invalidateQueries({ queryKey: ["stockLevels"] });
      queryClient.invalidateQueries({ queryKey: ["std-stock-count"] });

      expect(MockBroadcastChannel.instances[0]?.posted).toHaveLength(0);

      vi.advanceTimersByTime(DEBOUNCE_MS);

      expect(MockBroadcastChannel.instances).toHaveLength(1);
      expect(MockBroadcastChannel.instances[0]?.name).toBe(CHANNEL_NAME);
      expect(MockBroadcastChannel.instances[0]?.posted).toHaveLength(1);
      const payload = MockBroadcastChannel.instances[0]?.posted[0];
      expect(payload?.tabId).toBe("tab-local");
      expect(payload?.orgId).toBe("org-1");
      expect(payload?.branchId).toBe("branch-1");
      expect(payload?.queryKeys).toHaveLength(2);
    });
  });

  describe("cross-tab receive", () => {
    it("applies remote invalidations on another tab client", async () => {
      mockSessionTabId("tab-a");
      const queryClientA = new QueryClient();
      createCrossTabQuerySync(queryClientA, () => ({
        orgId: "org-1",
        branchId: "branch-1",
      }));

      const storageB = new Map<string, string>([["xpos-tab-id", "tab-b"]]);
      vi.stubGlobal("sessionStorage", {
        getItem: (key: string) => storageB.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storageB.set(key, value);
        },
      });

      const queryClientB = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClientB, "invalidateQueries");
      createCrossTabQuerySync(queryClientB, () => ({
        orgId: "org-1",
        branchId: "branch-1",
      }));

      queryClientA.invalidateQueries({ queryKey: ["std-stock-count"] });
      vi.advanceTimersByTime(DEBOUNCE_MS);

      await vi.runAllTimersAsync();

      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["std-stock-count"] })
      );
    });
  });
});
