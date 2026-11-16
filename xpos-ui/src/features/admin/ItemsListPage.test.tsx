import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { ToastProvider } from "@/contexts/ToastContext";
import { ItemsListPage } from "./ItemsListPage";
import * as orgsApi from "@/api/orgs";
import * as itemsApi from "@/api/items";
import * as categoriesApi from "@/api/categories";
import * as itemsPdfUtil from "@/utils/itemsPdf";

vi.mock("@/api/orgs");
vi.mock("@/api/items");
vi.mock("@/api/categories");
vi.mock("@/utils/itemsPdf");

function wrap(component: React.ReactElement) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      orgContext: orgContextReducer,
      cart: cartReducer,
    },
    preloadedState: {
      auth: {
        token: "test-token",
        iamUserId: "user-1",
        username: null,
        expiresAt: null,
        refreshToken: null,
        roles: [],
      },
    },
  });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>{component}</MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </Provider>
  );
}

describe("ItemsListPage Download PDF", () => {
  const mockItems = [
    {
      id: "item-1",
      orgId: "org-1",
      sku: "SKU-1",
      name: "Tusker Lager",
      itemType: "STOCK" as const,
      categoryId: null,
      taxProfileId: null,
      trackInventory: true,
      active: true,
      buyingPrice: 180,
      defaultSellingPrice: 250,
      baseUomId: null,
      visibleInPos: true,
      primaryImageUrl: null,
      barcode: "123456",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.mocked(orgsApi.fetchOrgs).mockResolvedValue({
      content: [
        {
          id: "org-1",
          name: "Acme Pubs",
          status: "ACTIVE",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ],
      totalElements: 1,
      totalPages: 1,
      size: 200,
      number: 0,
      first: true,
      last: true,
    });

    vi.mocked(itemsApi.fetchItems).mockResolvedValue({
      content: mockItems,
      totalElements: 1,
      totalPages: 1,
      size: 500,
      number: 0,
      first: true,
      last: true,
    });

    vi.mocked(itemsApi.fetchAllOrgItems).mockResolvedValue(mockItems);

    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: 500,
      number: 0,
      first: true,
      last: true,
    });
  });

  it("renders Download PDF button and triggers downloadItemsPdf", async () => {
    wrap(<ItemsListPage initialOrgId="org-1" />);

    expect(await screen.findByText("Tusker Lager")).toBeInTheDocument();

    const downloadBtn = await screen.findByRole("button", { name: /download pdf/i });
    expect(downloadBtn).toBeInTheDocument();

    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(itemsApi.fetchAllOrgItems).toHaveBeenCalledWith("test-token", "org-1");
      expect(itemsPdfUtil.downloadItemsPdf).toHaveBeenCalledWith(mockItems, {
        orgName: "Acme Pubs",
      });
    });
  });
});
