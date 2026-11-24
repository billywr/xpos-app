import { Trash2, ShoppingBag, Receipt, AlertCircle, Utensils, Bike, ShoppingCart, Plus, Minus, RotateCcw, X } from "lucide-react";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import {
  updateLineQty,
  removeLine,
  clearCart,
  setOrderType,
  setTableId,
  type CartLine,
} from "@/store/slices/cartSlice";
import { formatCurrency } from "@/utils/formatCurrency";
import { SearchableSelect } from "@/components/SearchableSelect";
import { BarcodeCaptureInput } from "@/components/BarcodeCaptureInput";
import { CountBadge } from "@/components/ui/CountBadge";
import type { Item } from "@/types/catalog";

export interface PosCartTicketProps {
  showBarcode: boolean;
  handleBarcodeScan: (barcode: string) => void;
  token: string | null;
  orgId: string | null;
  barcodeScanError: string | null;
  cartLines: CartLine[];
  itemMap: Map<string, Item>;
  stockMap: Map<string, number>;
  total: number;
  showOrderType: boolean;
  orderType: string;
  showTableSelect: boolean;
  operatorTableSelectOptions: { value: string; label: string }[];
  tableId: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createSaleAndLinesMutation: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentShift: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenderTypes: any[];
  hasInsufficientStock: boolean;
  insufficientStockMessage: string;
  onProceedExtra?: () => void;
  onClose?: () => void;
}

export function PosCartTicket({
  showBarcode,
  handleBarcodeScan,
  token,
  orgId,
  barcodeScanError,
  cartLines,
  itemMap,
  stockMap,
  total,
  showOrderType,
  orderType,
  showTableSelect,
  operatorTableSelectOptions,
  tableId,
  createSaleAndLinesMutation,
  currentShift,
  tenderTypes,
  hasInsufficientStock,
  insufficientStockMessage,
  onProceedExtra,
  onClose,
}: PosCartTicketProps) {
  const dispatch = useAppDispatch();
  const totalItemCount = cartLines.reduce((sum, l) => sum + l.qty, 0);

  const isCheckoutDisabled =
    cartLines.length === 0 ||
    createSaleAndLinesMutation.isPending ||
    !currentShift ||
    tenderTypes.length === 0 ||
    hasInsufficientStock;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-slate-800">
      {/* Ticket Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            Current order
          </h2>
          {totalItemCount > 0 && (
            <CountBadge
              count={totalItemCount}
              variant="primary"
              active
              size="md"
              className="bg-primary-600 text-white dark:bg-primary-500 font-extrabold shadow-xs"
            />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {cartLines.length > 0 && (
            <button
              type="button"
              onClick={() => dispatch(clearCart())}
              className="flex h-8 w-8 touch-manipulation items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-90 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-red-900/40 dark:hover:bg-red-950/40 dark:hover:text-red-400 shadow-2xs"
              title="Reset order"
              aria-label="Reset order"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 touch-manipulation items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 active:scale-90 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700 dark:hover:text-white shadow-2xs"
              title="Close cart"
              aria-label="Close cart"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Context Bar: Order Type Segmented Switcher & Table Select */}
      {(showOrderType || showTableSelect || showBarcode) && (
        <div className="shrink-0 space-y-2.5 border-b border-slate-200 p-3.5 dark:border-slate-700">
          {showOrderType && (
            <div className="flex rounded-xl bg-slate-200/80 p-0.5 dark:bg-slate-800/80">
              <button
                type="button"
                onClick={() => dispatch(setOrderType("DINE_IN"))}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs sm:text-sm font-bold transition ${
                  orderType === "DINE_IN"
                    ? "bg-primary-600 text-white font-extrabold shadow-xs dark:bg-primary-500"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <Utensils className="h-3.5 w-3.5" />
                <span>Dine in</span>
              </button>
              <button
                type="button"
                onClick={() => dispatch(setOrderType("TAKEAWAY"))}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs sm:text-sm font-bold transition ${
                  orderType === "TAKEAWAY"
                    ? "bg-primary-600 text-white font-extrabold shadow-xs dark:bg-primary-500"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>Takeaway</span>
              </button>
              <button
                type="button"
                onClick={() => dispatch(setOrderType("DELIVERY"))}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs sm:text-sm font-bold transition ${
                  orderType === "DELIVERY"
                    ? "bg-primary-600 text-white font-extrabold shadow-xs dark:bg-primary-500"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                }`}
              >
                <Bike className="h-3.5 w-3.5" />
                <span>Delivery</span>
              </button>
            </div>
          )}

          {showTableSelect && (
            <SearchableSelect
              options={operatorTableSelectOptions}
              value={tableId ?? ""}
              onChange={(v: string) => dispatch(setTableId(v || null))}
              placeholder="Select table..."
              className="min-h-[38px] touch-manipulation"
              controlClassName="min-h-[38px] rounded-lg border-slate-300 bg-white text-xs font-semibold focus-within:border-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              aria-label="Select table"
            />
          )}

          {showBarcode && (
            <div>
              <BarcodeCaptureInput
                onScan={handleBarcodeScan}
                placeholder="Scan barcode to add..."
                compact
                disabled={!token || !orgId}
              />
              {barcodeScanError && (
                <p className="mt-1 text-xs text-red-500" role="alert">
                  {barcodeScanError}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Ticket Line Items List */}
      <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100 p-3 dark:divide-slate-700">
        {cartLines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
              Order is empty
            </h3>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-400 max-w-[200px]">
              Tap items from the menu grid to add them to this sale
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {cartLines.map((line) => {
              const item = itemMap.get(line.itemId);
              const trackInventory = item?.trackInventory ?? false;
              const stockOnHand = trackInventory ? (stockMap.get(line.itemId) ?? 0) : undefined;
              const maxQty = trackInventory && typeof stockOnHand === "number" ? Math.max(0, stockOnHand) : undefined;
              const canAddMore = maxQty === undefined || line.qty < maxQty;

              const lineTotal =
                line.unitPrice * line.qty +
                (line.modifiers?.reduce((s, m) => s + m.unitPriceDelta * m.qty, 0) ?? 0);

              return (
                <div
                  key={line.tempId}
                  className="group flex flex-col gap-1 sm:gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 shadow-2xs transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/90 dark:hover:border-slate-600"
                >
                  {/* Top: Item Title, Line Total, Trash Action */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug dark:text-white">
                        {line.itemName}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg sm:text-xl font-black tabular-nums text-emerald-600 dark:text-emerald-400 tracking-tight">
                        {formatCurrency(lineTotal)}
                      </span>
                      <button
                        type="button"
                        onClick={() => dispatch(removeLine(line.tempId))}
                        className="flex h-8.5 w-8.5 sm:h-9 sm:w-9 shrink-0 touch-manipulation items-center justify-center rounded-full bg-red-600/80 text-white shadow-2xs transition hover:bg-red-600 active:scale-95 dark:bg-red-600/80 dark:hover:bg-red-500"
                        aria-label={`Remove ${line.itemName}`}
                      >
                        <Trash2 className="h-4 w-4 sm:h-4.5 sm:w-4.5 stroke-[2.2]" />
                      </button>
                    </div>
                  </div>

                  {/* Modifiers if present */}
                  {line.modifiers.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {line.modifiers.map((m) => (
                        <span
                          key={m.modifierOptionId}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-primary-300"
                        >
                          +{m.modifierOptionName} ({m.qty})
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Bottom: Stepper and Unit Breakdown */}
                  <div className="flex items-end justify-between">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (line.qty <= 1) {
                            dispatch(removeLine(line.tempId));
                          } else {
                            dispatch(updateLineQty({ tempId: line.tempId, qty: line.qty - 1 }));
                          }
                        }}
                        className="flex h-10 w-10 sm:h-11 sm:w-11 touch-manipulation items-center justify-center rounded-lg bg-red-600 text-white shadow-2xs transition hover:bg-red-700 active:scale-95 dark:bg-red-600 dark:hover:bg-red-500"
                        aria-label={`Decrease quantity of ${line.itemName}`}
                      >
                        <Minus className="h-4.5 w-4.5 sm:h-5 sm:w-5 stroke-[2.5]" />
                      </button>

                      <span
                        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-amber-500 text-slate-950 font-black tabular-nums text-sm sm:text-base leading-none pt-[1px] shadow-xs ring-1 ring-amber-400/50 dark:bg-amber-400 dark:text-slate-950 dark:ring-amber-300/40 select-none ${
                          String(line.qty).length === 1
                            ? "h-7 w-7 sm:h-8 sm:w-8 aspect-square px-0"
                            : "h-7 sm:h-8 min-w-[1.75rem] sm:min-w-[2rem] px-1.5"
                        }`}
                        aria-label={`${line.qty} in order`}
                      >
                        {line.qty}
                      </span>

                      <button
                        type="button"
                        disabled={!canAddMore}
                        onClick={() =>
                          canAddMore &&
                          dispatch(updateLineQty({ tempId: line.tempId, qty: line.qty + 1 }))
                        }
                        className="flex h-10 w-10 sm:h-11 sm:w-11 touch-manipulation items-center justify-center rounded-lg bg-emerald-700 font-bold text-white shadow-2xs transition hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                        aria-label={`Increase quantity of ${line.itemName}`}
                      >
                        <Plus className="h-4.5 w-4.5 sm:h-5 sm:w-5 stroke-[2.5]" />
                      </button>
                    </div>

                    <span className="text-sm sm:text-base font-bold tabular-nums text-slate-500 dark:text-slate-300 pb-0.5 sm:pb-0.5">
                      {line.qty} × {formatCurrency(line.unitPrice)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ticket Footer: Warnings & Proceed Button */}
      <div className="shrink-0 border-t border-slate-200 p-4 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/60">
        {/* Warnings */}
        {!currentShift && (
          <div className="mb-2.5 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Open a shift on Dashboard first to accept payments.</span>
          </div>
        )}
        {currentShift && tenderTypes.length === 0 && (
          <div className="mb-2.5 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>No payment methods configured. Add Cash in Admin.</span>
          </div>
        )}
        {hasInsufficientStock && (
          <div className="mb-2.5 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{insufficientStockMessage}</span>
          </div>
        )}
        {createSaleAndLinesMutation.isError && (
          <div className="mb-2.5 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {createSaleAndLinesMutation.error?.message ?? "Error creating sale"}
          </div>
        )}

        {/* Checkout Button */}
        <button
          type="button"
          disabled={isCheckoutDisabled}
          onClick={() => {
            createSaleAndLinesMutation.mutate();
            onProceedExtra?.();
          }}
          className="flex min-h-[56px] w-full touch-manipulation items-center justify-between rounded-xl bg-primary-600 px-5 py-3.5 text-base sm:text-lg font-black text-white shadow-md transition hover:bg-primary-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-primary-600 dark:hover:bg-primary-500"
        >
          <span>
            {createSaleAndLinesMutation.isPending
              ? "Processing order..."
              : "Proceed to payment"}
          </span>
          <span className="tabular-nums font-black text-lg sm:text-xl">
            {formatCurrency(total)}
          </span>
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-2 min-h-[40px] w-full touch-manipulation rounded-xl border border-slate-300 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 active:scale-95 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Back to menu
          </button>
        )}
      </div>
    </div>
  );
}
