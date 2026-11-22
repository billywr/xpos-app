import { useState, useEffect } from "react";
import { Plus, Minus } from "lucide-react";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatQty } from "@/utils/formatQuantity";
import { getItemImageUrl, DEFAULT_PRODUCT_PLACEHOLDER } from "@/utils/itemImage";

export interface MenuItemCardProps {
  /** Item name */
  name: string;
  /** Item id (for aria-labels) */
  itemId: string;
  /** Primary image URL or null */
  primaryImageUrl: string | null;
  /** Whether inventory is tracked */
  trackInventory: boolean;
  /** Whether item is active */
  active: boolean;
  /** Stock on hand (use Infinity for non-tracked items) */
  stockOnHand: number;
  /** Unit price */
  price: number;
  /** Current quantity in cart */
  quantityInCart: number;
  /** Called when user clicks reduce/minus */
  onReduce: () => void;
  /** Called when user clicks add/plus */
  onAdd: () => void;
}

/**
 * Enterprise POS product card.
 * Touch-friendly, high-contrast, graceful image fallback, inline quantity stepper.
 */
export function MenuItemCard({
  name,
  itemId,
  primaryImageUrl,
  trackInventory,
  active,
  stockOnHand,
  price,
  quantityInCart,
  onReduce,
  onAdd,
}: MenuItemCardProps) {
  const [imgFailed, setImgFailed] = useState(false);

  // Reset image failure state if URL changes
  useEffect(() => {
    setImgFailed(false);
  }, [primaryImageUrl]);

  const available = active && stockOnHand > 0;
  const priceNotSet = price <= 0;
  const addDisabled =
    (trackInventory && quantityInCart >= stockOnHand) || priceNotSet;
  const addTooltip =
    priceNotSet && available
      ? "Price should be set before selling (Admin → Catalog → Price list items)"
      : undefined;

  const stockLabel = trackInventory
    ? available
      ? `${formatQty(stockOnHand)} in stock`
      : "Out of stock"
    : available
      ? "In stock"
      : "—";

  const isLowStock = trackInventory && available && stockOnHand <= 5;
  const canTapToAdd = available && !addDisabled;
  const inCart = quantityInCart > 0;

  const hasValidImage = Boolean(primaryImageUrl && !imgFailed);
  const imageUrl = primaryImageUrl ? getItemImageUrl(primaryImageUrl) ?? primaryImageUrl : null;
  const displayImageUrl = hasValidImage && imageUrl ? imageUrl : DEFAULT_PRODUCT_PLACEHOLDER;

  function handleCardClick() {
    if (canTapToAdd) {
      onAdd();
    }
  }

  return (
    <div
      role={canTapToAdd ? "button" : undefined}
      tabIndex={canTapToAdd ? 0 : undefined}
      id={`pos-item-${itemId}`}
      onClick={handleCardClick}
      onKeyDown={
        canTapToAdd
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onAdd();
              }
            }
          : undefined
      }
      aria-label={`${name}, ${formatCurrency(price)}${inCart ? `, ${quantityInCart} in order` : ""}`}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border text-left transition-all duration-150 select-none ${
        inCart
          ? "border-amber-500 bg-amber-50/15 ring-[2.5px] ring-amber-400 shadow-md shadow-amber-500/15 dark:border-amber-400 dark:bg-amber-950/15 dark:ring-amber-400 dark:shadow-amber-950/30"
          : "border-slate-200/90 bg-white shadow-xs hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
      } ${
        canTapToAdd
          ? "cursor-pointer active:scale-[0.98]"
          : "cursor-not-allowed opacity-60"
      }`}
    >
      {/* Top Header / Image Area */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
        <img
          src={displayImageUrl}
          alt={name}
          loading="lazy"
          onError={() => setImgFailed(true)}
          draggable={false}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        />

        {/* Subtle Bottom Shadow on Image for text transition */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />

        {/* Stock Badge on Top Left */}
        {trackInventory && (
          <div className="absolute top-2.5 left-2.5">
            <span
              className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold tracking-tight shadow-xs backdrop-blur-xs ${
                !available
                  ? "bg-rose-600 text-white"
                  : isLowStock
                    ? "bg-amber-400 text-slate-950 font-black shadow-amber-900/10"
                    : "bg-emerald-600/95 text-white border border-emerald-400/30"
              }`}
            >
              {stockLabel}
            </span>
          </div>
        )}

      </div>

      {/* Middle: Item Details */}
      <div className="flex flex-1 flex-col justify-between p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <h3
            title={name}
            className="line-clamp-2 min-w-0 flex-1 text-base sm:text-lg font-bold text-slate-900 leading-snug group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400"
          >
            {name}
          </h3>
          <p className="shrink-0 text-right text-base sm:text-lg font-black tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400 leading-snug whitespace-nowrap">
            {formatCurrency(price)}
          </p>
        </div>

        {/* Bottom: 44px+ Action Stepper / Add button */}
        <div className="mt-3.5 -mx-1 sm:-mx-1.5 w-[calc(100%+0.5rem)] sm:w-[calc(100%+0.75rem)]">
          {available ? (
            inCart ? (
              <div
                className="flex h-11 sm:h-12 min-h-[44px] items-center justify-between rounded-xl border border-amber-500/30 bg-amber-50/30 p-1 dark:border-amber-400/30 dark:bg-slate-900/90 shadow-2xs"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={onReduce}
                  className="flex h-9 sm:h-10 w-11 sm:w-12 shrink-0 touch-manipulation items-center justify-center rounded-lg bg-white text-slate-700 border border-slate-200 font-bold transition hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 shadow-2xs"
                  aria-label={`Reduce quantity of ${name}`}
                >
                  <Minus className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
                </button>
                <div className="flex flex-1 items-center justify-center">
                  <span
                    className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-amber-500 text-slate-950 font-black tabular-nums text-sm sm:text-base shadow-xs ring-1 ring-amber-400/50 dark:bg-amber-400 dark:text-slate-950 dark:ring-amber-300/40"
                    aria-label={`${quantityInCart} in order`}
                  >
                    {quantityInCart}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onAdd}
                  disabled={addDisabled}
                  title={addTooltip}
                  className="flex h-9 sm:h-10 w-11 sm:w-12 shrink-0 touch-manipulation items-center justify-center rounded-lg bg-emerald-700 font-bold text-white shadow-2xs transition hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  aria-label={addTooltip ?? `Add more ${name}`}
                >
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5]" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd();
                }}
                disabled={addDisabled}
                title={addTooltip}
                className="flex h-11 sm:h-12 min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm sm:text-base font-extrabold text-white shadow-xs transition hover:bg-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <Plus className="h-5 w-5 stroke-[2.5]" />
                <span>Add</span>
              </button>
            )
          ) : (
            <div className="flex h-11 sm:h-12 min-h-[44px] w-full items-center justify-center rounded-xl bg-slate-100 px-3 text-xs sm:text-sm font-semibold text-slate-400 dark:bg-slate-800/80 dark:text-slate-500 border border-slate-200/60 dark:border-slate-700/60">
              Not available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
