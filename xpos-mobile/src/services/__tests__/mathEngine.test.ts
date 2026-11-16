import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcTotalStock,
  normalizeClosingQty,
  calcImpliedSold,
  calcQtyToRecord,
  calcLineRevenue,
  calcReconcileVariance,
  resolveSalesLineStatus,
  roundHalfUp,
  SCALE,
  MONEY_SCALE,
  isWithinBackdateWindow,
} from "../mathEngine.ts";

describe("Authoritative Math Engine Tests (StdStockCount parity)", () => {
  it("roundHalfUp matches Java BigDecimal HALF_UP rounding", () => {
    assert.equal(roundHalfUp(1.005, 2), 1.01);
    assert.equal(roundHalfUp(1.004, 2), 1.00);
    assert.equal(roundHalfUp(2.5555, 3), 2.556);
    assert.equal(roundHalfUp(2.5554, 3), 2.555);
    assert.equal(roundHalfUp(0.1 + 0.2, 2), 0.3);
  });

  it("calcTotalStock = opening + added + addedToday", () => {
    // 10 open + 5 added yesterday + 3 added today
    assert.equal(calcTotalStock(10, 5, 3), 18);
    // Decimal stock
    assert.equal(calcTotalStock(10.125, 2.5, 1.375), 14);
    // Missing / negative guards
    assert.equal(calcTotalStock(0, 0, 0), 0);
  });

  it("normalizeClosingQty clamps negatives to 0.000", () => {
    assert.equal(normalizeClosingQty(-5), 0);
    assert.equal(normalizeClosingQty(12.3456), 12.346);
    assert.equal(normalizeClosingQty(null), null);
    assert.equal(normalizeClosingQty(undefined), null);
  });

  it("calcImpliedSold = max(0, totalStock - closingStock)", () => {
    // total 20, closing 12 -> 8 sold
    assert.equal(calcImpliedSold(20, 12), 8);
    // closing exceeds total (e.g. unrecorded stock intake) -> 0 sold, not negative
    assert.equal(calcImpliedSold(10, 15), 0);
    // closing is null -> null (uncounted)
    assert.equal(calcImpliedSold(10, null), null);
  });

  it("calcQtyToRecord handles delta recording correctly", () => {
    // implied 10 sold, already recorded 4 -> 6 to record
    assert.equal(calcQtyToRecord(10, 4), 6);
    // implied 10 sold, already recorded 10 -> 0 to record (all recorded)
    assert.equal(calcQtyToRecord(10, 10), 0);
    // implied 8 sold, already recorded 10 (over-recorded) -> 0 to record
    assert.equal(calcQtyToRecord(8, 10), 0);
    // implied is null -> 0 to record
    assert.equal(calcQtyToRecord(null, 0), 0);
  });

  it("calcLineRevenue = round(qtyToRecord * unitPrice, 2)", () => {
    // 3 units at 150.50
    assert.equal(calcLineRevenue(3, 150.5), 451.5);
    // Fractional units e.g. 1.250 kg at 80.33
    assert.equal(calcLineRevenue(1.25, 80.33), 100.41);
  });

  it("calcReconcileVariance = closingStock - onHandStock", () => {
    // Closing 15, onHand 10 -> +5 surplus
    assert.equal(calcReconcileVariance(15, 10), 5);
    // Closing 8, onHand 10 -> -2 deficit
    assert.equal(calcReconcileVariance(8, 10), -2);
    // Exact match -> 0
    assert.equal(calcReconcileVariance(10, 10), 0);
  });

  it("resolveSalesLineStatus mirrors backend line status", () => {
    assert.equal(resolveSalesLineStatus(null, null, 0, 0), "SKIPPED_NO_CLOSING");
    assert.equal(resolveSalesLineStatus(10, 0, 0, 0), "SKIPPED_NO_IMPLIED_SALE");
    assert.equal(resolveSalesLineStatus(5, 5, 8, 0), "WARNING_OVER_RECORDED");
    assert.equal(resolveSalesLineStatus(5, 5, 5, 0), "SKIPPED_NO_QTY");
    assert.equal(resolveSalesLineStatus(5, 5, 2, 3), null);
  });

  it("isWithinBackdateWindow restricts to 7 days", () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    assert.equal(isWithinBackdateWindow(todayStr), true);

    const pastDate = new Date(today);
    pastDate.setDate(today.getDate() - 6);
    const pastStr = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, "0")}-${String(pastDate.getDate()).padStart(2, "0")}`;
    assert.equal(isWithinBackdateWindow(pastStr), true);

    const tooOldDate = new Date(today);
    tooOldDate.setDate(today.getDate() - 10);
    const tooOldStr = `${tooOldDate.getFullYear()}-${String(tooOldDate.getMonth() + 1).padStart(2, "0")}-${String(tooOldDate.getDate()).padStart(2, "0")}`;
    assert.equal(isWithinBackdateWindow(tooOldStr), false);
  });
});
