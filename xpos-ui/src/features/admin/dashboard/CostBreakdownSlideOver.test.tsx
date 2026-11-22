import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CostBreakdownSlideOver } from "./CostBreakdownSlideOver";
import type { MiscExpenseResponse } from "@/api/miscExpenses";
import type { RecurringUtility } from "@/api/recurringUtilities";

const mockExpenses: MiscExpenseResponse[] = [
  {
    id: "exp-1",
    amount: 3500,
    category: "Police",
    description: "Evening patrol fee",
    incurredBy: "Sgt. Mwangi",
    receiptRef: "POL-99",
    terminalId: "term-1",
    shiftId: "shift-1",
    createdByStaffUserId: "user-1",
    createdAt: "2026-11-15T18:00:00Z",
  },
  {
    id: "exp-2",
    amount: 7200,
    category: "Maintenance",
    description: "Replaced freezer gasket",
    incurredBy: "Cooltech Services",
    receiptRef: "INV-401",
    terminalId: "term-1",
    shiftId: "shift-1",
    createdByStaffUserId: "user-1",
    createdAt: "2026-11-18T11:20:00Z",
  },
];

const mockUtilities: RecurringUtility[] = [
  {
    id: "util-1",
    orgId: "org-1",
    branchId: "branch-1",
    name: "Nairobi Water",
    amount: 4500,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    applyTiming: "END_OF_MONTH",
    dueDayOfMonth: 10,
    payee: "NCWSC",
    accountNumber: "WATER-0012",
    incurredBy: "Facility Manager",
    notes: "Main branch meter",
    active: true,
    createdByStaffUserId: "user-1",
    createdByStaffUserName: "Admin",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "util-2",
    orgId: "org-1",
    branchId: "branch-1",
    name: "Kenya Power (Postpaid)",
    amount: 12000,
    effectiveFrom: "2026-01-01",
    effectiveTo: "2026-06-30",
    applyTiming: "BEGINNING_OF_MONTH",
    dueDayOfMonth: 1,
    payee: "KPLC",
    accountNumber: "KPLC-9988",
    incurredBy: null,
    notes: "Previous electricity contract",
    active: true,
    createdByStaffUserId: "user-1",
    createdByStaffUserName: "Admin",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-06-30T00:00:00Z",
  },
];

describe("CostBreakdownSlideOver", () => {
  it("does not render when open is false", () => {
    const { container } = render(
      <CostBreakdownSlideOver
        open={false}
        onClose={vi.fn()}
        startDate="2026-11-01"
        endDate="2026-11-22"
        expenseTotal={10700}
        utilitiesTotal={16500}
        expenses={mockExpenses}
        utilities={mockUtilities}
        isLoading={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders fine-grained breakdown when open", () => {
    render(
      <CostBreakdownSlideOver
        open={true}
        onClose={vi.fn()}
        startDate="2026-11-01"
        endDate="2026-11-22"
        expenseTotal={10700}
        utilitiesTotal={16500}
        expenses={mockExpenses}
        utilities={mockUtilities}
        isLoading={false}
      />
    );

    expect(screen.getByText("Cost & expense breakdown")).toBeInTheDocument();
    expect(screen.getByText("Excluding cost of goods purchased")).toBeInTheDocument();
    expect(screen.getByText("Evening patrol fee")).toBeInTheDocument();
    expect(screen.getByText("Replaced freezer gasket")).toBeInTheDocument();
    expect(screen.getByText("Nairobi Water")).toBeInTheDocument();
    expect(screen.getByText(/WATER-0012/)).toBeInTheDocument();

    // Verify effective from/to dates show when they apply
    expect(screen.getByText("From Jan 2026")).toBeInTheDocument();
    expect(screen.getByText(/Effective from 01\/01\/2026 \(Ongoing\)/)).toBeInTheDocument();
    expect(screen.getByText("Jan 2026 – Jun 2026")).toBeInTheDocument();
    expect(screen.getByText(/01\/01\/2026 to 30\/06\/2026/)).toBeInTheDocument();
  });

  it("filters by category pill", () => {
    render(
      <CostBreakdownSlideOver
        open={true}
        onClose={vi.fn()}
        startDate="2026-11-01"
        endDate="2026-11-22"
        expenseTotal={10700}
        utilitiesTotal={4500}
        expenses={mockExpenses}
        utilities={mockUtilities}
        isLoading={false}
      />
    );

    // Filter to Police category
    const policeCategoryBtn = screen.getByRole("button", { name: /Police/i });
    fireEvent.click(policeCategoryBtn);

    expect(screen.getByText("Evening patrol fee")).toBeInTheDocument();
    expect(screen.queryByText("Replaced freezer gasket")).not.toBeInTheDocument();

    // Clicking All categories resets
    const allCategoriesBtn = screen.getByRole("button", { name: "All categories" });
    fireEvent.click(allCategoriesBtn);

    expect(screen.getByText("Evening patrol fee")).toBeInTheDocument();
    expect(screen.getByText("Replaced freezer gasket")).toBeInTheDocument();
  });

  it("renders empty state when no costs match", () => {
    render(
      <CostBreakdownSlideOver
        open={true}
        onClose={vi.fn()}
        startDate="2026-11-01"
        endDate="2026-11-22"
        expenseTotal={0}
        utilitiesTotal={0}
        expenses={[]}
        utilities={[]}
        isLoading={false}
      />
    );

    expect(screen.getByText("No matching costs or expenses")).toBeInTheDocument();
  });
});
