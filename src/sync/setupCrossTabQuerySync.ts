import type { QueryClient } from "@tanstack/react-query";
import {
  createCrossTabQuerySync,
  type CrossTabQuerySyncHandle,
  type OrgContextSnapshot,
} from "./crossTabQuerySync";

export function setupCrossTabQuerySync(
  queryClient: QueryClient,
  getContext: () => OrgContextSnapshot
): CrossTabQuerySyncHandle | null {
  return createCrossTabQuerySync(queryClient, getContext);
}
