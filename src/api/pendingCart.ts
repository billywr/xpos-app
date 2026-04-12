import { apiFetch } from "@/api/client";
import type { CartState } from "@/store/slices/cartSlice";

export async function fetchPendingCart(
  token: string | null,
  orgId: string,
  branchId: string
): Promise<CartState> {
  return apiFetch<CartState>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/pending-cart`,
    { token }
  );
}

export async function savePendingCart(
  token: string | null,
  orgId: string,
  branchId: string,
  cart: CartState
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/pending-cart`,
    { token, method: "PUT", body: cart }
  );
}

export async function deletePendingCart(
  token: string | null,
  orgId: string,
  branchId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/operator/orgs/${orgId}/branches/${branchId}/pending-cart`,
    { token, method: "DELETE" }
  );
}
