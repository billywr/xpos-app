import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch, set401Handler } from "./client";

describe("apiFetch", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    set401Handler(null);
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/fail-network")) {
          return Promise.reject(new Error("Failed to fetch"));
        }
        if (url.includes("/ok")) {
          return Promise.resolve(
            new Response(JSON.stringify({ content: [], totalElements: 0 }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        if (url.includes("/unauthorized")) {
          return Promise.resolve(
            new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Not Found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          })
        );
      })
    );
  });

  afterEach(() => {
    set401Handler(null);
    vi.stubGlobal("fetch", originalFetch);
  });

  it("throws user-friendly message when fetch throws Failed to fetch", async () => {
    await expect(
      apiFetch("/fail-network", { token: "dummy" })
    ).rejects.toMatchObject({
      status: 0,
      data: {
        code: "NETWORK_ERROR",
        message: expect.stringContaining("Cannot reach server"),
        requestId: expect.any(String),
      },
    });
  });

  it("returns parsed JSON on 200", async () => {
    const data = await apiFetch<{ content: unknown[]; totalElements: number }>(
      "/ok",
      { token: "dummy" }
    );
    expect(data.content).toEqual([]);
    expect(data.totalElements).toBe(0);
  });

  it("throws status and data on 4xx", async () => {
    const err = await apiFetch("/not-found", { token: "dummy" }).then(
      () => null,
      (e) => e
    );
    expect(err).toMatchObject({ status: 404 });
    expect(err).toHaveProperty("data");
    expect(err.data).toBeDefined();
  });

  it("calls 401 handler then throws on 401", async () => {
    const on401 = vi.fn();
    set401Handler(on401);
    const err = await apiFetch("/unauthorized", { token: "dummy" }).then(
      () => null,
      (e) => e
    );
    expect(on401).toHaveBeenCalledTimes(1);
    expect(err).toMatchObject({ status: 401 });
    expect(err).toHaveProperty("data");
  });
});
