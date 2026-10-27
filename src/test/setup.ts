import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

// Polyfill localStorage in case Node.js v22 experimental localStorage shadowed jsdom
if (typeof window !== "undefined") {
  if (!window.localStorage || typeof window.localStorage.clear !== "function") {
    const store: Record<string, string> = {};
    const mockStorage = {
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
}

beforeEach(() => {
  try {
    if (typeof window !== "undefined" && window.localStorage?.clear) {
      window.localStorage.clear();
    }
  } catch {
    // ignore
  }
});
