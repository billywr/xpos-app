import { describe, it, expect } from "vitest";
import {
  getApiErrorMessage,
  getApiErrorRequestId,
  isApiFetchError,
  type ApiFetchError,
} from "./apiError";

describe("apiError utils", () => {
  describe("isApiFetchError", () => {
    it("returns true for thrown apiFetch shape", () => {
      const err: ApiFetchError = {
        status: 404,
        data: {
          timestamp: "",
          status: 404,
          error: "Not Found",
          code: "NOT_FOUND",
          message: "Org not found",
          path: "/api/v1/admin/orgs/1",
          requestId: "req-123",
        },
      };
      expect(isApiFetchError(err)).toBe(true);
    });

    it("returns false for Error instance", () => {
      expect(isApiFetchError(new Error("Failed to fetch"))).toBe(false);
    });

    it("returns false for null/undefined", () => {
      expect(isApiFetchError(null)).toBe(false);
      expect(isApiFetchError(undefined)).toBe(false);
    });
  });

  describe("getApiErrorMessage", () => {
    it("returns data.message for ApiFetchError", () => {
      const err: ApiFetchError = {
        status: 0,
        data: {
          timestamp: "",
          status: 0,
          error: "NETWORK_ERROR",
          code: "NETWORK_ERROR",
          message: "Cannot reach server. Check that the backend is running.",
          path: "/api/v1/admin/orgs",
          requestId: "req-456",
        },
      };
      expect(getApiErrorMessage(err)).toBe(
        "Cannot reach server. Check that the backend is running."
      );
    });

    it("returns message for Error", () => {
      expect(getApiErrorMessage(new Error("Failed to fetch"))).toBe("Failed to fetch");
    });

    it("returns fallback for unknown", () => {
      expect(getApiErrorMessage("string")).toBe("Something went wrong.");
    });
  });

  describe("getApiErrorRequestId", () => {
    it("returns requestId for ApiFetchError", () => {
      const err: ApiFetchError = {
        status: 500,
        data: {
          timestamp: "",
          status: 500,
          error: "Error",
          code: "ERR",
          message: "Server error",
          path: "/api",
          requestId: "abc-123",
        },
      };
      expect(getApiErrorRequestId(err)).toBe("abc-123");
    });

    it("returns undefined for Error", () => {
      expect(getApiErrorRequestId(new Error("x"))).toBeUndefined();
    });
  });
});
