import { apiFetch } from "@/api/client";

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  active: boolean;
}

export interface CreateCustomerRequest {
  name: string;
  phone?: string;
  email?: string;
}

/**
 * Create a customer on-the-fly (operator flow, e.g. when recording debt).
 * No need to pre-capture in Admin.
 */
export async function createCustomer(
  token: string | null,
  orgId: string,
  body: CreateCustomerRequest
): Promise<Customer> {
  return apiFetch<Customer>(
    `/api/v1/operator/orgs/${orgId}/customers`,
    { token, body, method: "POST" }
  );
}
