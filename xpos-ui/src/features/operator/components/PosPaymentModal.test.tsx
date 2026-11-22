import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PosPaymentModal } from "./PosPaymentModal";
import type { Sale } from "@/types/sales";

const mockSale = {
  id: "sale-1",
  receiptNumber: "REC-001",
  total: 500,
  subtotal: 500,
  taxTotal: 0,
  discountTotal: 0,
  status: "OPEN",
  orderType: "DINE_IN",
  createdAt: "2026-11-22T10:00:00Z",
  lines: [
    {
      id: "line-1",
      saleId: "sale-1",
      itemId: "item-1",
      itemName: "Burger",
      qty: 2,
      unitPrice: 250,
      lineSubtotal: 500,
      lineTotal: 500,
      createdAt: "2026-11-22T10:00:00Z",
      modifiers: [],
    },
  ],
  tenders: [],
} as unknown as Sale;

const mockTenderTypes = [
  { id: "tender-cash", code: "CASH", name: "Cash" },
  { id: "tender-card", code: "CARD", name: "Credit Card" },
];

describe("PosPaymentModal Component", () => {
  it("renders Add cash button and cash amount input with equal height layout classes", () => {
    const onAddTender = vi.fn();
    const onClose = vi.fn();
    const onComplete = vi.fn();
    const setAddTenderAmount = vi.fn();
    const setAddTenderTypeId = vi.fn();

    render(
      <PosPaymentModal
        sale={mockSale}
        token="test-token"
        orgId="org-1"
        branchId="branch-1"
        terminalId="term-1"
        tenderTypes={mockTenderTypes}
        mpesaStkEnabled={false}
        totalTendered={0}
        canComplete={false}
        addTenderAmount="500"
        setAddTenderAmount={setAddTenderAmount}
        addTenderTypeId="tender-cash"
        setAddTenderTypeId={setAddTenderTypeId}
        onAddTender={onAddTender}
        onRemoveTender={vi.fn()}
        onComplete={onComplete}
        onSaleUpdated={vi.fn()}
        onStkAutoCompleted={vi.fn()}
        onClose={onClose}
        isAddingTender={false}
        isRemovingTender={false}
        isCompleting={false}
        addTenderError={null}
        removeTenderError={null}
        completeError={null}
      />
    );

    const amountInput = screen.getByLabelText("Tender amount");
    const addCashButton = screen.getByRole("button", { name: "Add cash" });

    expect(amountInput).toBeInTheDocument();
    expect(addCashButton).toBeInTheDocument();

    // Verify parent container has items-stretch and defined height
    const inputRow = amountInput.closest(".flex");
    expect(inputRow).toHaveClass("items-stretch");
    expect(inputRow).toHaveClass("h-14");
    expect(inputRow).toHaveClass("sm:h-16");

    // Both input and button fill the container height (h-full)
    expect(amountInput).toHaveClass("h-full");
    expect(addCashButton).toHaveClass("h-full");

    // Click Add cash
    fireEvent.click(addCashButton);
    expect(onAddTender).toHaveBeenCalledTimes(1);
  });

  it("renders Cancel and Complete sale buttons with equal height styling in footer", () => {
    const onClose = vi.fn();
    const onComplete = vi.fn();

    render(
      <PosPaymentModal
        sale={mockSale}
        token="test-token"
        orgId="org-1"
        branchId="branch-1"
        terminalId="term-1"
        tenderTypes={mockTenderTypes}
        mpesaStkEnabled={false}
        totalTendered={500}
        canComplete={true}
        addTenderAmount=""
        setAddTenderAmount={vi.fn()}
        addTenderTypeId="tender-cash"
        setAddTenderTypeId={vi.fn()}
        onAddTender={vi.fn()}
        onRemoveTender={vi.fn()}
        onComplete={onComplete}
        onSaleUpdated={vi.fn()}
        onStkAutoCompleted={vi.fn()}
        onClose={onClose}
        isAddingTender={false}
        isRemovingTender={false}
        isCompleting={false}
        addTenderError={null}
        removeTenderError={null}
        completeError={null}
      />
    );

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    const completeButton = screen.getByRole("button", { name: "Complete sale" });

    expect(cancelButton).toBeInTheDocument();
    expect(completeButton).toBeInTheDocument();

    // Both share matching min-height classes
    expect(cancelButton).toHaveClass("min-h-[52px]");
    expect(cancelButton).toHaveClass("sm:min-h-[56px]");
    expect(completeButton).toHaveClass("min-h-[52px]");
    expect(completeButton).toHaveClass("sm:min-h-[56px]");

    // Parent footer action group has items-stretch
    const footerActionGroup = cancelButton.parentElement;
    expect(footerActionGroup).toHaveClass("items-stretch");

    // Interactivity
    fireEvent.click(completeButton);
    expect(onComplete).toHaveBeenCalledTimes(1);

    fireEvent.click(cancelButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders Cash and M-Pesa STK tabs occupying top row end-to-end with grid-cols-2", () => {
    // Only Cash and M-Pesa STK enabled (no other manual tenders)
    const cashOnlyTender = [{ id: "tender-cash", code: "CASH", name: "Cash" }];

    render(
      <PosPaymentModal
        sale={mockSale}
        token="test-token"
        orgId="org-1"
        branchId="branch-1"
        terminalId="term-1"
        tenderTypes={cashOnlyTender}
        mpesaStkEnabled={true}
        totalTendered={0}
        canComplete={false}
        addTenderAmount="500"
        setAddTenderAmount={vi.fn()}
        addTenderTypeId="tender-cash"
        setAddTenderTypeId={vi.fn()}
        onAddTender={vi.fn()}
        onRemoveTender={vi.fn()}
        onComplete={vi.fn()}
        onSaleUpdated={vi.fn()}
        onStkAutoCompleted={vi.fn()}
        onClose={vi.fn()}
        isAddingTender={false}
        isRemovingTender={false}
        isCompleting={false}
        addTenderError={null}
        removeTenderError={null}
        completeError={null}
      />
    );

    const cashTab = screen.getByRole("button", { name: /^cash$/i });
    const mpesaTab = screen.getByRole("button", { name: /^m-pesa stk$/i });

    expect(cashTab).toBeInTheDocument();
    expect(mpesaTab).toBeInTheDocument();

    // Verify parent container is grid-cols-2 so Cash & M-Pesa STK fill end to end with no empty 3rd column
    const tabsContainer = cashTab.parentElement;
    expect(tabsContainer).toHaveClass("grid");
    expect(tabsContainer).toHaveClass("grid-cols-2");
    expect(tabsContainer).not.toHaveClass("sm:grid-cols-3");
  });
});
