import type { ApiError } from "@/types/api";

/** Thrown by apiFetch: { status, data: ApiError } */
export interface ApiFetchError {
  status: number;
  data: ApiError;
}

export function isApiFetchError(err: unknown): err is ApiFetchError {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    "data" in err &&
    typeof (err as ApiFetchError).data === "object" &&
    (err as ApiFetchError).data !== null &&
    "message" in (err as ApiFetchError).data
  );
}

/**
 * Returns a user-facing message for API/network errors.
 * Use in list and form components to show a consistent error message.
 */
export function getApiErrorMessage(err: unknown): string {
  if (isApiFetchError(err)) {
    return err.data.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Something went wrong.";
}

/**
 * Returns the error code from an API error when available (e.g. ITEM_NOT_SUPPLIED).
 */
export function getApiErrorCode(err: unknown): string | undefined {
  if (isApiFetchError(err) && err.data.code) {
    return err.data.code;
  }
  return undefined;
}

/**
 * Returns the requestId from an API error when available (for support reference).
 */
export function getApiErrorRequestId(err: unknown): string | undefined {
  if (isApiFetchError(err) && err.data.requestId) {
    return err.data.requestId;
  }
  return undefined;
}
