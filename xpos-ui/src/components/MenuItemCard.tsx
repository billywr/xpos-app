import { useState, useEffect } from "react";
import { Plus, Minus } from "lucide-react";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatQty } from "@/utils/formatQuantity";
import { getItemImageUrl, DEFAULT_PRODUCT_PLACEHOLDER } from "@/utils/itemImage";
import { ItemDummyBackground } from "@/components/ItemDummyBackground";

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
  /** Card presentation variant: 'standard' (side-by-side) or 'compact-stacked' (stacked name & price for 4-col grid) */
  variant?: "standard" | "compact-stacked";
  /** Whether to use the dummy item dark ambient glow background behind uploaded images */
  useDummyImageBg?: boolean;
  /** Whether to show the brand stamp badge on the dummy image background */
  showBrandBadge?: boolean;
  /** Brand or organization name to display on the stamp badge */
  brandName?: string;
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
  variant: _variant = "standard",
  useDummyImageBg = false,
  showBrandBadge = true,
  brandName = "STONE PUB",
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
  const maxStock = trackInventory
    ? Math.max(0, Math.floor(stockOnHand))
    : Infinity;
  const addDisabled =
    (trackInventory && quantityInCart >= maxStock) || priceNotSet;
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
          ? "border-amber-500 bg-amber-50/15 ring-[2.5px] ring-amber-400 shadow-md shadow-amber-500/15 dark:border-amber-400 dark:bg-amber-950/15 dark:ring-amber-400 dark:shadow-amber-950/30 cursor-default"
          : canTapToAdd
          ? "border-slate-200/90 bg-white shadow-xs hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 cursor-pointer active:scale-[0.98]"
          : "border-slate-200/90 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-800 cursor-not-allowed opacity-60"
      }`}
    >
      {/* Top Header / Image Area */}
      <div
        className={`relative aspect-[16/9] w-full overflow-hidden flex items-center justify-center ${
          hasValidImage
            ? useDummyImageBg
              ? "bg-[#0f172a]"
              : "bg-white dark:bg-white"
            : "bg-slate-100 dark:bg-slate-900"
        }`}
      >
        {hasValidImage && useDummyImageBg && (
          <ItemDummyBackground
            showBadge={showBrandBadge}
            brandName={brandName}
          />
        )}
        <img
          src={displayImageUrl}
          alt={name}
          loading="lazy"
          onError={() => setImgFailed(true)}
          draggable={false}
          className={`h-full w-full transition-transform duration-200 group-hover:scale-105 ${
            hasValidImage
              ? useDummyImageBg
                ? "relative z-10 object-contain p-2"
                : "object-contain p-1.5"
              : "object-cover"
          }`}
        />

        {/* Stock Badge on Top Left */}
        {trackInventory && (
          <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 z-10">
            <span
              className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] sm:text-[11px] font-bold tracking-tight shadow-xs backdrop-blur-xs ${
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
      <div className="flex flex-1 flex-col justify-between px-2 pt-1.5 pb-2 sm:px-2.5 sm:pt-2 sm:pb-2">
        {/* Title on left, price badge on right on the same level */}
        <div className="flex items-start justify-between gap-1.5 sm:gap-2 min-w-0">
          <h3
            title={name}
            className="line-clamp-2 min-w-0 flex-1 text-base sm:text-lg font-black text-slate-900 leading-tight group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400"
          >
            {name}
          </h3>
          <span className="inline-flex shrink-0 items-center rounded-lg bg-emerald-50 px-2 py-0.5 text-xs sm:text-sm font-black tabular-nums tracking-tight text-emerald-700 border border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30 whitespace-nowrap shadow-2xs">
            {formatCurrency(price)}
          </span>
        </div>

        {/* Bottom: 44px+ Action Stepper / Add button */}
        <div className="mt-1.5 sm:mt-2 w-full">
          {available ? (
            inCart ? (
              <div
                className="flex h-11 min-h-[44px] items-center justify-between gap-1.5 sm:gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={onReduce}
                  className="flex h-9.5 sm:h-10 flex-1 max-w-[4.25rem] sm:max-w-[4.5rem] touch-manipulation items-center justify-center rounded-xl bg-rose-600 text-white shadow-2xs transition hover:bg-rose-700 active:scale-95 dark:bg-rose-600 dark:hover:bg-rose-500"
                  aria-label={`Reduce quantity of ${name}`}
                >
                  <Minus className="h-5.5 w-5.5 sm:h-6 sm:w-6 stroke-[3.5]" />
                </button>
                <div className="flex shrink-0 items-center justify-center px-0.5">
                  <span
                    className={`inline-flex shrink-0 items-center justify-center rounded-full bg-amber-500 text-slate-950 font-black tabular-nums text-sm sm:text-base leading-none pt-[1px] shadow-xs ring-1 ring-amber-400/50 dark:bg-amber-400 dark:text-slate-950 dark:ring-amber-300/40 select-none ${
                      String(quantityInCart).length === 1
                        ? "h-6.5 w-6.5 sm:h-7 sm:w-7 aspect-square px-0"
                        : "h-6.5 sm:h-7 min-w-[1.625rem] sm:min-w-[1.75rem] px-1.5"
                    }`}
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
                  className="flex h-9.5 sm:h-10 flex-1 max-w-[4.25rem] sm:max-w-[4.5rem] touch-manipulation items-center justify-center rounded-xl bg-emerald-700 font-bold text-white shadow-2xs transition hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  aria-label={addTooltip ?? `Add more ${name}`}
                >
                  <Plus className="h-5.5 w-5.5 sm:h-6 sm:w-6 stroke-[3.5]" />
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
