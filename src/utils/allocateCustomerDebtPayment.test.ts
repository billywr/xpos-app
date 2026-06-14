import { describe, expect, it } from "vitest";
import { allocateCustomerDebtPayment, customerTotalOutstanding } from "@/utils/allocateCustomerDebtPayment";
import type { CustomerDebtResponse } from "@/api/debts";

describe("allocateCustomerDebtPayment", () => {
  const base = (overrides: Partial<CustomerDebtResponse>): CustomerDebtResponse => ({
    id: "d1",
    customerId: "c1",
    customerName: "John",
    customerPhone: null,
    saleId: null,
    amount: 100,
    amountSettled: 0,
    outstanding: 100,
    currency: "KES",
    dueDate: null,
    status: "OPEN",
    notes: null,
    issuedBy: null,
    createdByStaffUserId: "s1",
    createdAt: "2025-01-01T10:00:00Z",
    ...overrides,
  });

  it("allocates oldest first with partial on last debt", () => {
    const debts = [
      base({ id: "d1", amount: 10, outstanding: 10, createdAt: "2025-01-01T10:00:00Z" }),
      base({ id: "d2", amount: 50, outstanding: 50, createdAt: "2025-01-02T10:00:00Z" }),
      base({ id: "d3", amount: 100, outstanding: 100, createdAt: "2025-01-03T10:00:00Z" }),
    ];
    const preview = allocateCustomerDebtPayment(debts, 90);
    expect(preview?.allocations).toHaveLength(3);
    expect(preview?.allocations[0]).toMatchObject({
      debtId: "d1",
      appliedAmount: 10,
      outstandingAfter: 0,
      status: "CLOSED",
    });
    expect(preview?.allocations[1]).toMatchObject({
      debtId: "d2",
      appliedAmount: 50,
      outstandingAfter: 0,
    });
    expect(preview?.allocations[2]).toMatchObject({
      debtId: "d3",
      appliedAmount: 30,
      outstandingAfter: 70,
      status: "PARTIAL",
    });
    expect(preview?.totalApplied).toBe(90);
    expect(preview?.unallocated).toBe(0);
  });

  it("sums customer outstanding", () => {
    const debts = [
      base({ outstanding: 10, status: "OPEN" }),
      base({ id: "d2", outstanding: 20, status: "PARTIAL" }),
      base({ id: "d3", outstanding: 0, status: "CLOSED" }),
    ];
    expect(customerTotalOutstanding(debts)).toBe(30);
  });
});
