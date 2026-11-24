import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/store/slices/authSlice";
import orgContextReducer from "@/store/slices/orgContextSlice";
import cartReducer from "@/store/slices/cartSlice";
import { ToastProvider } from "@/contexts/ToastContext";
import { clearStoredMenuOrderCategory } from "@/utils/menuOrderCategoryStorage";
import { MenuOrderPage } from "./MenuOrderPage";
import * as categoriesApi from "@/api/categories";
import * as itemsApi from "@/api/items";
import * as stockLevelsApi from "@/api/stockLevels";
import * as tablesApi from "@/api/tables";
import * as mpesaApi from "@/api/mpesa";
import * as tenderTypesApi from "@/api/tenderTypes";
import * as shiftsApi from "@/api/shifts";

vi.mock("@/api/categories");
vi.mock("@/api/items");
vi.mock("@/api/stockLevels");
vi.mock("@/api/tables");
vi.mock("@/api/mpesa");
vi.mock("@/api/sales");
vi.mock("@/api/tenderTypes");
vi.mock("@/api/shifts");

const mockCategories = [
  { id: "cat-wine", name: "Wine" },
  { id: "cat-beer", name: "Beer" },
  { id: "cat-spirits", name: "Spirits" },
];

const mockItems = [
  {
    id: "item-1",
    name: "Whiskey",
    categoryId: "cat-spirits",
    defaultSellingPrice: 500,
    active: true,
    visibleInPos: true,
    trackInventory: false,
  },
  {
    id: "item-2",
    name: "Vodka",
    categoryId: "cat-spirits",
    defaultSellingPrice: 400,
    active: true,
    visibleInPos: true,
    trackInventory: false,
  },
  {
    id: "item-3",
    name: "Gin",
    categoryId: "cat-spirits",
    defaultSellingPrice: 450,
    active: true,
    visibleInPos: true,
    trackInventory: false,
  },
  {
    id: "item-4",
    name: "Lager",
    categoryId: "cat-beer",
    defaultSellingPrice: 250,
    active: true,
    visibleInPos: true,
    trackInventory: false,
  },
  {
    id: "item-5",
    name: "Pilsner",
    categoryId: "cat-beer",
    defaultSellingPrice: 260,
    active: true,
    visibleInPos: true,
    trackInventory: false,
  },
];

function renderMenuOrderPage() {
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
      orgContext: {
        orgId: "org-1",
        orgName: "Test Org",
        branchId: "branch-1",
        branchName: "Main Branch",
        terminalId: "term-1",
        terminalName: "POS 1",
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
    <MemoryRouter initialEntries={["/operator/pos"]}>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <MenuOrderPage />
          </ToastProvider>
        </QueryClientProvider>
      </Provider>
    </MemoryRouter>
  );
}

describe("MenuOrderPage category menu ordering and default selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearStoredMenuOrderCategory();
    localStorage.clear();
    sessionStorage.clear();

    vi.mocked(categoriesApi.fetchCategories).mockResolvedValue({
      content: mockCategories,
      totalElements: mockCategories.length,
      totalPages: 1,
      size: 50,
      number: 0,
    } as any);

    vi.mocked(itemsApi.fetchItems).mockResolvedValue({
      content: mockItems,
      totalElements: mockItems.length,
      totalPages: 1,
      size: 200,
      number: 0,
    } as any);

    vi.mocked(itemsApi.fetchItemModifierGroups).mockResolvedValue([]);
    vi.mocked(stockLevelsApi.fetchStockLevels).mockResolvedValue([]);
    vi.mocked(tablesApi.fetchOperatorTables).mockResolvedValue([]);
    vi.mocked(mpesaApi.fetchMpesaOperatorSettings).mockResolvedValue({ enabled: false } as any);
    vi.mocked(tenderTypesApi.fetchTenderTypes).mockResolvedValue([]);
    vi.mocked(shiftsApi.getCurrentShift).mockResolvedValue(null as any);
  });

  it("arranges categories in order of decreasing counter and defaults selection to the one with most counts", async () => {
    renderMenuOrderPage();

    // Wait for categories to load
    await waitFor(() => {
      expect(screen.getByText("Spirits")).toBeInTheDocument();
    });

    // Check tabs in the category strip
    // All (5), Spirits (3), Beer (2) - Wine (0) is hidden because its count is zero
    const categoryButtons = screen.getAllByRole("button").filter((btn) => {
      const text = btn.textContent || "";
      return (
        text.includes("All") ||
        text.includes("Spirits") ||
        text.includes("Beer") ||
        text.includes("Wine")
      );
    });

    const categoryNames = categoryButtons.map((btn) => btn.querySelector("span")?.textContent);
    expect(categoryNames).toEqual(["All", "Spirits", "Beer"]);
    expect(screen.queryByText("Wine")).not.toBeInTheDocument();

    // Default selected should be Spirits (most counts: 3)
    const spiritsButton = categoryButtons.find((btn) =>
      btn.querySelector("span")?.textContent === "Spirits"
    );
    expect(spiritsButton).toHaveClass("bg-primary-600");

    // Items from Spirits should be visible
    expect(screen.getByText("Whiskey")).toBeInTheDocument();
    expect(screen.getByText("Vodka")).toBeInTheDocument();
    expect(screen.getByText("Gin")).toBeInTheDocument();

    // Items from Beer should NOT be visible when Spirits is selected
    expect(screen.queryByText("Lager")).not.toBeInTheDocument();
    expect(screen.queryByText("Pilsner")).not.toBeInTheDocument();
  });

  it("allows switching to All and other categories when clicked", async () => {
    renderMenuOrderPage();

    await waitFor(() => {
      expect(screen.getByText("Spirits")).toBeInTheDocument();
    });

    // Click "All" tab
    const allButton = screen.getByRole("button", { name: /all/i });
    fireEvent.click(allButton);

    // All items should now be visible
    await waitFor(() => {
      expect(screen.getByText("Whiskey")).toBeInTheDocument();
      expect(screen.getByText("Lager")).toBeInTheDocument();
      expect(screen.getByText("Pilsner")).toBeInTheDocument();
    });
    expect(allButton).toHaveClass("bg-primary-600");

    // Click "Beer" tab
    const beerButton = screen.getByRole("button", { name: /beer/i });
    fireEvent.click(beerButton);

    await waitFor(() => {
      expect(screen.getByText("Lager")).toBeInTheDocument();
      expect(screen.getByText("Pilsner")).toBeInTheDocument();
    });
    expect(screen.queryByText("Whiskey")).not.toBeInTheDocument();
    expect(beerButton).toHaveClass("bg-primary-600");
  });

  it("renders alternative vertical category POS layout when configured with 4-column product grid and vertical category panel", async () => {
    localStorage.setItem("ui.pos.layout", "vertical-category");
    renderMenuOrderPage();

    await waitFor(() => {
      expect(screen.getByText("Spirits")).toBeInTheDocument();
    });

    // Check vertical category navigation
    const categoryNav = screen.getByRole("navigation", { name: "Product categories" });
    expect(categoryNav).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Categories" })).toBeInTheDocument();

    // Spirits should be selected with amber styling
    const spiritsNavBtn = screen.getByRole("button", { name: /spirits/i });
    expect(spiritsNavBtn).toHaveClass("bg-amber-500");

    // Center workspace heading has category title
    expect(screen.getByRole("heading", { name: "Spirits" })).toBeInTheDocument();

    // Items from Spirits should be visible in product grid
    expect(screen.getByText("Whiskey")).toBeInTheDocument();
    expect(screen.getByText("Vodka")).toBeInTheDocument();
    expect(screen.getByText("Gin")).toBeInTheDocument();

    // Beer items not visible
    expect(screen.queryByText("Lager")).not.toBeInTheDocument();

    // Filter by clicking "Beer" in the vertical panel
    const beerNavBtn = screen.getByRole("button", { name: /beer/i });
    fireEvent.click(beerNavBtn);

    await waitFor(() => {
      expect(screen.getByText("Lager")).toBeInTheDocument();
      expect(screen.getByText("Pilsner")).toBeInTheDocument();
    });
    expect(screen.queryByText("Whiskey")).not.toBeInTheDocument();
    expect(beerNavBtn).toHaveClass("bg-amber-500");
  });

  it("preserves active cart lines when switching between layouts", async () => {
    // Start in vertical layout
    localStorage.setItem("ui.pos.layout", "vertical-category");
    renderMenuOrderPage();

    await waitFor(() => {
      expect(screen.getByText("Whiskey")).toBeInTheDocument();
    });

    // Add Whiskey to cart by clicking the Whiskey card
    const whiskeyCard = screen.getByText("Whiskey");
    fireEvent.click(whiskeyCard);

    // Whiskey should be in current order ticket
    await waitFor(() => {
      expect(screen.getAllByText("Whiskey").length).toBeGreaterThanOrEqual(2);
    });

    // Switch layout to standard via custom event
    fireEvent(
      window,
      new CustomEvent("pos-layout-changed", { detail: { layout: "standard" } })
    );

    // Standard layout is active (category tabs along top, no vertical navigation)
    await waitFor(() => {
      expect(screen.queryByRole("navigation", { name: "Product categories" })).not.toBeInTheDocument();
    });

    // Cart line with Whiskey must still be intact
    expect(screen.getAllByText("Whiskey").length).toBeGreaterThanOrEqual(2);
  });

  it("searches products across all categories regardless of active category selection", async () => {
    // Start in vertical layout (default category selection is Spirits with Whiskey, Vodka, Gin)
    localStorage.setItem("ui.pos.layout", "vertical-category");
    renderMenuOrderPage();

    await waitFor(() => {
      expect(screen.getByText("Whiskey")).toBeInTheDocument();
    });

    // Beer items like "Lager" are not in the Spirits category
    expect(screen.queryByText("Lager")).not.toBeInTheDocument();

    // Type "Lager" into the search input
    const searchInput = screen.getByRole("searchbox", { name: "Search products" });
    expect(searchInput).toHaveClass("pl-11.5");
    expect(searchInput).toHaveClass("sm:pl-12");
    fireEvent.change(searchInput, { target: { value: "Lager" } });

    // Lager from Beer category should now be found and displayed!
    await waitFor(() => {
      expect(screen.getByText("Lager")).toBeInTheDocument();
    });

    // Spirits items are filtered out by the search query
    expect(screen.queryByText("Whiskey")).not.toBeInTheDocument();
    expect(screen.queryByText("Vodka")).not.toBeInTheDocument();

    // Clear search filter restores category filter
    const clearBtn = screen.getByRole("button", { name: "Clear search" });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByText("Whiskey")).toBeInTheDocument();
    });
    expect(screen.queryByText("Lager")).not.toBeInTheDocument();
  });

  it("maintains constant pill size for selected category indicator without dynamic width shrinking", async () => {
    localStorage.setItem("ui.pos.layout", "vertical-category");
    renderMenuOrderPage();

    await waitFor(() => {
      expect(screen.getByText("Whiskey")).toBeInTheDocument();
    });

    // The selected category pill container should have constant width classes
    const categoryHeading = screen.getByRole("heading", { name: "Spirits" });
    const pillContainer = categoryHeading.closest("div");
    expect(pillContainer).not.toBeNull();
    expect(pillContainer).toHaveClass("w-64");
    expect(pillContainer).toHaveClass("sm:w-72");
    expect(pillContainer).toHaveClass("lg:w-80");
    expect(pillContainer).not.toHaveClass("w-fit");
  });

  it("hides selected category label when ui.pos.selected_category_label is configured false", async () => {
    localStorage.setItem("ui.pos.layout", "vertical-category");
    localStorage.setItem("ui.pos.selected_category_label", "false");
    renderMenuOrderPage();

    await waitFor(() => {
      expect(screen.getByText("Whiskey")).toBeInTheDocument();
    });

    // The heading for selected category should not be present in Zone 2
    expect(screen.queryByRole("heading", { name: "Spirits" })).not.toBeInTheDocument();
  });

  it("renders a page refresh button next to the search bar at the same level", async () => {
    renderMenuOrderPage();

    await waitFor(() => {
      expect(screen.getByText("Spirits")).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole("button", { name: "Refresh page" });
    expect(refreshButton).toBeInTheDocument();
    expect(refreshButton).toHaveAttribute("title", "Refresh page");
    expect(refreshButton).toHaveClass("h-11", "w-11");
  });

  it("persists user selected category across page refreshes / re-mounts until logout", async () => {
    const { unmount } = renderMenuOrderPage();

    await waitFor(() => {
      expect(screen.getByText("Spirits")).toBeInTheDocument();
    });

    // Default was Spirits. Click "Beer"
    const beerButton = screen.getByRole("button", { name: /beer/i });
    fireEvent.click(beerButton);

    await waitFor(() => {
      expect(screen.getByText("Lager")).toBeInTheDocument();
    });
    expect(beerButton).toHaveClass("bg-primary-600");

    // Unmount (simulating user navigating away or browser reload)
    unmount();

    // Re-mount / reload page
    const r2 = renderMenuOrderPage();

    // Beer should be immediately restored without defaulting back to Spirits!
    await waitFor(() => {
      expect(screen.getByText("Lager")).toBeInTheDocument();
      expect(screen.queryByText("Whiskey")).not.toBeInTheDocument();
    });

    r2.unmount();

    // Now simulate logout clearing storage
    clearStoredMenuOrderCategory();

    // Re-mount again after logout
    renderMenuOrderPage();

    // After logout, it should default back to Spirits (top category by item count)
    await waitFor(() => {
      expect(screen.getByText("Whiskey")).toBeInTheDocument();
      expect(screen.queryByText("Lager")).not.toBeInTheDocument();
    });
  });

  it("persists 'All' category selection across re-mounts", async () => {
    const { unmount } = renderMenuOrderPage();

    await waitFor(() => {
      expect(screen.getByText("Spirits")).toBeInTheDocument();
    });

    // Click "All" tab
    const allButton = screen.getByRole("button", { name: /all/i });
    fireEvent.click(allButton);

    await waitFor(() => {
      expect(screen.getByText("Whiskey")).toBeInTheDocument();
      expect(screen.getByText("Lager")).toBeInTheDocument();
    });

    // Unmount and re-mount (page reload)
    unmount();
    renderMenuOrderPage();

    // Both Whiskey (Spirits) and Lager (Beer) should be visible because 'All' persisted!
    await waitFor(() => {
      expect(screen.getByText("Whiskey")).toBeInTheDocument();
      expect(screen.getByText("Lager")).toBeInTheDocument();
    });
  });
});

