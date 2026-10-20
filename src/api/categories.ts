import { apiFetch, buildPageQuery } from "@/api/client";
import type { Category } from "@/types/catalog";
import type { PageResponse } from "@/types/api";

export async function fetchCategories(
  token: string | null,
  orgId: string,
  params?: { page?: number; size?: number; sort?: string }
): Promise<PageResponse<Category>> {
  const query = buildPageQuery({
    page: params?.page ?? 0,
    size: params?.size ?? 100,
    sort: params?.sort ?? "createdAt,desc",
  });
  return apiFetch<PageResponse<Category>>(
    `/api/v1/admin/orgs/${orgId}/categories${query}`,
    { token }
  );
}

export async function fetchCategory(
  token: string | null,
  orgId: string,
  categoryId: string
): Promise<Category> {
  return apiFetch<Category>(
    `/api/v1/admin/orgs/${orgId}/categories/${categoryId}`,
    { token }
  );
}

export interface CreateCategoryBody {
  parentId: string | null;
  name: string;
  type: string;
}

export async function createCategory(
  token: string | null,
  orgId: string,
  body: CreateCategoryBody
): Promise<Category> {
  return apiFetch<Category>(`/api/v1/admin/orgs/${orgId}/categories`, {
    token,
    method: "POST",
    body: {
      parentId: body.parentId,
      name: body.name,
      type: body.type,
    },
  });
}

export interface UpdateCategoryBody {
  parentId: string | null;
  name: string;
  type: string;
}

export async function updateCategory(
  token: string | null,
  orgId: string,
  categoryId: string,
  body: UpdateCategoryBody
): Promise<Category> {
  return apiFetch<Category>(
    `/api/v1/admin/orgs/${orgId}/categories/${categoryId}`,
    {
      token,
      method: "PATCH",
      body: {
        parentId: body.parentId,
        name: body.name,
        type: body.type,
      },
    }
  );
}

export async function deleteCategory(
  token: string | null,
  orgId: string,
  categoryId: string
): Promise<void> {
  await apiFetch<void>(
    `/api/v1/admin/orgs/${orgId}/categories/${categoryId}`,
    { token, method: "DELETE" }
  );
}
