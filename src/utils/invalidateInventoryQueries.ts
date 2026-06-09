import type { QueryClient } from "@tanstack/react-query";

/** Invalidate server-backed inventory views after GRN, stock count, or std stock sheet changes. */
export function invalidateInventoryQueries(queryClient: QueryClient): Promise<void[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["std-stock-count"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-inventory-report"] }),
    queryClient.invalidateQueries({ queryKey: ["stockLevels"] }),
    queryClient.invalidateQueries({ queryKey: ["sales-recording-stock"] }),
    queryClient.invalidateQueries({ queryKey: ["sales-recording-stats"] }),
    queryClient.invalidateQueries({ queryKey: ["manual-stock-count"] }),
  ]);
}
