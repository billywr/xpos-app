import { describe, it, expect, beforeEach } from "vitest";
import { clearPersistedQueryCache, getPersistOptions } from "./queryPersister";

describe("queryPersister", () => {
  beforeEach(async () => {
    await clearPersistedQueryCache("test-cache-key");
  });

  it("creates a persister and provides default persist options", () => {
    const options = getPersistOptions("test-cache-key");
    expect(options).toBeDefined();
    expect(options.persister).toBeDefined();
    expect(options.maxAge).toBe(24 * 60 * 60 * 1000);
    expect(options.buster).toBe("v1.0");
    expect(options.dehydrateOptions?.shouldDehydrateQuery).toBeTypeOf("function");
  });

  it("filters out non-successful or empty queries in dehydrate filter", () => {
    const options = getPersistOptions("test-cache-key");
    const filter = options.dehydrateOptions!.shouldDehydrateQuery!;
    const querySuccessWithData = {
      state: { status: "success", data: [{ id: "1" }] },
    } as any;
    const querySuccessNoData = {
      state: { status: "success", data: undefined },
    } as any;
    const queryLoading = {
      state: { status: "pending", data: undefined },
    } as any;
    const queryError = {
      state: { status: "error", data: undefined },
    } as any;

    expect(filter(querySuccessWithData)).toBe(true);
    expect(filter(querySuccessNoData)).toBe(false);
    expect(filter(queryLoading)).toBe(false);
    expect(filter(queryError)).toBe(false);
  });
});
