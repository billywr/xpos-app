import { Trash2, ShoppingBag, Receipt, AlertCircle, Utensils, Bike, ShoppingCart, Plus, Minus, RotateCcw } from "lucide-react";
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
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs font-extrabold text-white shadow-xs dark:bg-primary-500">
              {totalItemCount}
            </span>
          )}
        </div>
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
      </div>

      {/* Context Bar: Order Type Segmented Switcher & Table Select */}
      <div className="shrink-0 space-y-2.5 border-b border-slate-200 p-3.5 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-900/60">
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
                line.modifiers.reduce((s, m) => s + m.unitPriceDelta * m.qty, 0);

              return (
                <div
                  key={line.tempId}
                  className="group flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/90 dark:hover:border-slate-600"
                >
                  {/* Top: Item Title, Unit Price, Line Total, Trash Action */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-extrabold text-slate-900 leading-snug dark:text-white">
                        {line.itemName}
                      </h4>
                      <p className="mt-0.5 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                        {formatCurrency(line.unitPrice)} ea
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg font-black tabular-nums text-slate-900 dark:text-white tracking-tight">
                        {formatCurrency(lineTotal)}
                      </span>
                      <button
                        type="button"
                        onClick={() => dispatch(removeLine(line.tempId))}
                        className="flex h-8 w-8 touch-manipulation items-center justify-center rounded-lg text-red-500 bg-red-500/10 border border-red-500/20 transition hover:bg-red-500/20 hover:text-red-600 active:scale-95 dark:text-red-400 dark:bg-red-950/40 dark:border-red-900/40 dark:hover:bg-red-900/60 dark:hover:text-red-300"
                        aria-label={`Remove ${line.itemName}`}
                      >
                        <Trash2 className="h-4 w-4" />
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

                  {/* Bottom: Spacious Quantity Stepper with distinct background colors */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900/80">
                      <button
                        type="button"
                        onClick={() => {
                          if (line.qty <= 1) {
                            dispatch(removeLine(line.tempId));
                          } else {
                            dispatch(updateLineQty({ tempId: line.tempId, qty: line.qty - 1 }));
                          }
                        }}
                        className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-lg bg-primary-100 text-primary-900 border border-primary-200 font-bold shadow-2xs transition hover:bg-primary-200 active:scale-95 dark:bg-primary-900/40 dark:text-primary-300 dark:border dark:border-primary-500/40 dark:hover:bg-primary-900/60"
                        aria-label={`Decrease quantity of ${line.itemName}`}
                      >
                        <Minus className="h-4 w-4" />
                      </button>

                      <span className="min-w-[2.25rem] px-2 text-center text-base font-black tabular-nums text-slate-900 dark:text-white">
                        {line.qty}
                      </span>

                      <button
                        type="button"
                        disabled={!canAddMore}
                        onClick={() =>
                          canAddMore &&
                          dispatch(updateLineQty({ tempId: line.tempId, qty: line.qty + 1 }))
                        }
                        className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-lg bg-emerald-700 font-bold text-white shadow-2xs transition hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Increase quantity of ${line.itemName}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <span className="text-sm font-bold tabular-nums text-slate-500 dark:text-slate-300">
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
