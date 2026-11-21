import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import {
  usePersistedTab,
  clearStoredTab,
  getStoredTab,
  setStoredTab,
} from "./usePersistedTab";

describe("usePersistedTab", () => {
  const TAB_LIST_ID = "test-tabs";
  const VALID_TABS = ["expenses", "debts", "utilities"] as const;

  beforeEach(() => {
    clearStoredTab(TAB_LIST_ID);
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    clearStoredTab(TAB_LIST_ID);
    sessionStorage.clear();
    localStorage.clear();
  });

  function createWrapper(initialUrl = "/test") {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <MemoryRouter initialEntries={[initialUrl]}>
          {children}
        </MemoryRouter>
      );
    };
  }

  it("returns defaultTab when URL and storage are empty", () => {
    const { result } = renderHook(
      () =>
        usePersistedTab({
          tabListId: TAB_LIST_ID,
          validTabs: VALID_TABS,
          defaultTab: "expenses",
        }),
      { wrapper: createWrapper("/test") }
    );

    expect(result.current[0]).toBe("expenses");
  });

  it("reads tab from URL query parameter when present", () => {
    const { result } = renderHook(
      () =>
        usePersistedTab({
          tabListId: TAB_LIST_ID,
          validTabs: VALID_TABS,
          defaultTab: "expenses",
        }),
      { wrapper: createWrapper("/test?tab=debts") }
    );

    expect(result.current[0]).toBe("debts");
  });

  it("falls back to storage when URL query parameter is absent", () => {
    setStoredTab(TAB_LIST_ID, "utilities");

    const { result } = renderHook(
      () =>
        usePersistedTab({
          tabListId: TAB_LIST_ID,
          validTabs: VALID_TABS,
          defaultTab: "expenses",
        }),
      { wrapper: createWrapper("/test") }
    );

    expect(result.current[0]).toBe("utilities");
  });

  it("prioritizes URL query parameter over storage", () => {
    setStoredTab(TAB_LIST_ID, "expenses");

    const { result } = renderHook(
      () =>
        usePersistedTab({
          tabListId: TAB_LIST_ID,
          validTabs: VALID_TABS,
          defaultTab: "expenses",
        }),
      { wrapper: createWrapper("/test?tab=utilities") }
    );

    expect(result.current[0]).toBe("utilities");
  });

  it("applies normalizeTab if provided", () => {
    const { result } = renderHook(
      () =>
        usePersistedTab({
          tabListId: "inventory-receiving",
          validTabs: ["suppliers", "stock", "inventory"] as const,
          defaultTab: "stock",
          normalizeTab: (raw) => (raw === "goods-receipt" ? "stock" : raw),
        }),
      { wrapper: createWrapper("/test?tab=goods-receipt") }
    );

    expect(result.current[0]).toBe("stock");
  });

  it("updates storage and URL when setTab is called", () => {
    function useHookWithLocation() {
      const tabState = usePersistedTab({
        tabListId: TAB_LIST_ID,
        validTabs: VALID_TABS,
        defaultTab: "expenses",
      });
      const location = useLocation();
      return { tabState, location };
    }

    const { result } = renderHook(() => useHookWithLocation(), {
      wrapper: createWrapper("/test?tab=expenses"),
    });

    expect(result.current.tabState[0]).toBe("expenses");

    act(() => {
      result.current.tabState[1]("debts");
    });

    expect(result.current.tabState[0]).toBe("debts");
    expect(result.current.location.search).toBe("?tab=debts");
    expect(getStoredTab(TAB_LIST_ID)).toBe("debts");
  });

  it("ignores invalid tab parameter in URL and falls back to storage or default", () => {
    setStoredTab(TAB_LIST_ID, "debts");

    const { result } = renderHook(
      () =>
        usePersistedTab({
          tabListId: TAB_LIST_ID,
          validTabs: VALID_TABS,
          defaultTab: "expenses",
        }),
      { wrapper: createWrapper("/test?tab=invalid-tab-id") }
    );

    expect(result.current[0]).toBe("debts");
  });
});
