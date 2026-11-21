import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

// Polyfill localStorage and sessionStorage in case Node.js v22 experimental storage shadowed jsdom
function createMockStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

if (typeof window !== "undefined") {
  if (!window.localStorage || typeof window.localStorage.clear !== "function") {
    const mockStorage = createMockStorage();
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  }

  if (!window.sessionStorage || typeof window.sessionStorage.clear !== "function") {
    const mockSession = createMockStorage();
    Object.defineProperty(window, "sessionStorage", {
      value: mockSession,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      value: mockSession,
      writable: true,
      configurable: true,
    });
  }
}

beforeEach(() => {
  try {
    if (typeof window !== "undefined") {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    }
  } catch {
    // ignore
  }
});
