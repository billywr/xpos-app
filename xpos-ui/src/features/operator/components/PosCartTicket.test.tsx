import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import cartReducer from "@/store/slices/cartSlice";
import { PosCartTicket, type PosCartTicketProps } from "./PosCartTicket";
import type { Item } from "@/types/catalog";

function renderTicket(props: Partial<PosCartTicketProps> = {}) {
  const store = configureStore({
    reducer: {
      cart: cartReducer,
    },
  });

  const defaultItem = {
    id: "item-1",
    orgId: "org-1",
    categoryId: "cat-1",
    name: "T. ace 250",
    sku: "TACE-250",
    itemType: "STOCK" as const,
    baseUomId: "uom-1",
    taxProfileId: "tax-1",
    buyingPrice: 200,
    primaryImageUrl: null,
    defaultSellingPrice: 300,
    active: true,
    trackInventory: false,
    visibleInPos: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  } as Item;

  const itemMap = new Map<string, Item>([["item-1", defaultItem]]);
  const stockMap = new Map<string, number>([["item-1", 10]]);

  const fullProps: PosCartTicketProps = {
    showBarcode: false,
    handleBarcodeScan: vi.fn(),
    token: "test-token",
    orgId: "org-1",
    barcodeScanError: null,
    cartLines: [
      {
        tempId: "line-1",
        itemId: "item-1",
        itemName: "T. ace 250",
        primaryImageUrl: null,
        qty: 1,
        unitPrice: 300,
        modifiers: [],
      },
    ],
    itemMap,
    stockMap,
    total: 300,
    showOrderType: false,
    orderType: "DINE_IN",
    showTableSelect: false,
    operatorTableSelectOptions: [],
    tableId: null,
    createSaleAndLinesMutation: { isPending: false } as any,
    currentShift: { id: "shift-1" } as any,
    tenderTypes: [{ id: "cash", code: "CASH", name: "Cash" }] as any[],
    hasInsufficientStock: false,
    insufficientStockMessage: "",
    ...props,
  };

  return render(
    <Provider store={store}>
      <PosCartTicket {...fullProps} />
    </Provider>
  );
}

describe("PosCartTicket Component", () => {
  it("does not render context bar strip or different background color when orderType, tableSelect, and barcode are disabled", () => {
    const { container } = renderTicket({
      showOrderType: false,
      showTableSelect: false,
      showBarcode: false,
    });

    // Current order header exists
    expect(screen.getByRole("heading", { name: /current order/i })).toBeInTheDocument();

    // Order type buttons do not exist
    expect(screen.queryByRole("button", { name: /dine in/i })).not.toBeInTheDocument();

    // Context bar container should NOT be in the DOM
    expect(container.querySelector(".p-3\\.5")).toBeNull();

    // Line item card exists immediately under ticket header
    expect(screen.getByText("T. ace 250")).toBeInTheDocument();
  });

  it("renders context bar without different background color when showOrderType is enabled", () => {
    const { container } = renderTicket({
      showOrderType: true,
      showTableSelect: false,
      showBarcode: false,
    });

    expect(screen.getByRole("button", { name: /dine in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /takeaway/i })).toBeInTheDocument();

    // Context bar exists with p-3.5 but without contrasting strip background
    const contextBar = container.querySelector(".p-3\\.5");
    expect(contextBar).not.toBeNull();
    expect(contextBar).not.toHaveClass("bg-slate-50/60");
    expect(contextBar).not.toHaveClass("dark:bg-slate-900/60");
  });

  it("renders decrease quantity (-) button with red background matching delete button", () => {
    renderTicket();

    const decreaseBtn = screen.getByRole("button", { name: /decrease quantity of t\. ace 250/i });
    expect(decreaseBtn).toBeInTheDocument();
    expect(decreaseBtn).toHaveClass("bg-red-600");
    expect(decreaseBtn).toHaveClass("text-white");
    expect(decreaseBtn).toHaveClass("dark:bg-red-600");

    const deleteBtn = screen.getByRole("button", { name: /remove t\. ace 250/i });
    expect(deleteBtn).toBeInTheDocument();
    expect(deleteBtn).toHaveClass("bg-red-600/80");
    expect(deleteBtn).toHaveClass("text-white");
    expect(deleteBtn).toHaveClass("rounded-full");
    expect(deleteBtn).toHaveClass("dark:bg-red-600/80");
  });

  it("aligns unit price breakdown text to bottom level of stepper buttons", () => {
    renderTicket();

    const unitPriceEl = screen.getByText(/1 × Ksh 300/i);
    expect(unitPriceEl).toBeInTheDocument();
    expect(unitPriceEl).toHaveClass("pb-0.5");

    // The parent row container must be items-end
    expect(unitPriceEl.parentElement).toHaveClass("items-end");
    expect(unitPriceEl.parentElement).toHaveClass("justify-between");
  });

  it("renders larger font sizes for item title, total, and line total unit breakdown without increasing card size", () => {
    renderTicket();

    const titleEl = screen.getByText("T. ace 250");
    expect(titleEl).toHaveClass("text-base");
    expect(titleEl).toHaveClass("sm:text-lg");
    expect(titleEl).toHaveClass("font-extrabold");

    // Line total price
    const totalEl = screen.getAllByText(/Ksh\s*300/)[0];
    expect(totalEl).toHaveClass("text-lg");
    expect(totalEl).toHaveClass("sm:text-xl");
    expect(totalEl).toHaveClass("font-black");

    // Unit breakdown line total
    const unitPriceEl = screen.getByText(/1 × Ksh 300/i);
    expect(unitPriceEl).toHaveClass("text-sm");
    expect(unitPriceEl).toHaveClass("sm:text-base");
    expect(unitPriceEl).toHaveClass("font-bold");
  });
});
