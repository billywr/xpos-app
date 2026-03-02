import { apiFetch } from "@/api/client";

export interface StockLevelResponse {
  itemId: string;
  onHandQty: number;
}

export async function fetchStockLevels(
  token: string | null,
  orgId: string,
  branchId: string,
  itemIds: string[]
): Promise<StockLevelResponse[]> {
  if (itemIds.length === 0) return [];
  const params = new URLSearchParams();
  itemIds.forEach((id) => params.append("itemIds", id));
  return apiFetch<StockLevelResponse[]>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/stock-levels?${params.toString()}`,
    { token }
  );
}
