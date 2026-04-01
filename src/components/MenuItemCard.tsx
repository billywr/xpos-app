import { Plus, Minus } from "lucide-react";
import { formatCurrency } from "@/utils/formatCurrency";
import { getItemImageUrl } from "@/utils/itemImage";
import { FLOATING_CARD } from "@/utils/floatingCardClasses";

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
 * Reusable menu item card with image, name, price, stock label, and quantity controls.
 * Used on POS and other catalog displays.
 */
export function MenuItemCard({
  name,
  itemId: _itemId,
  primaryImageUrl,
  trackInventory,
  active,
  stockOnHand,
  price,
  quantityInCart,
  onReduce,
  onAdd,
}: MenuItemCardProps) {
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
      ? `${Math.floor(stockOnHand)} in stock`
      : "Out of stock"
    : available
      ? "Available"
      : "—";

  return (
    <div className={`flex flex-col overflow-hidden ${FLOATING_CARD}`}>
      <div className="relative h-[84px] w-full shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-700">
        {primaryImageUrl ? (
          <img
            src={getItemImageUrl(primaryImageUrl) ?? primaryImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-slate-400 dark:text-slate-500">
            🍽
          </div>
        )}
        <span className="absolute right-1.5 top-1.5 rounded-full bg-slate-900 px-2 py-1 text-xs font-bold text-white dark:bg-black">
          {stockLabel}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 border-t border-slate-100 p-1.5 dark:border-slate-700">
        <h3 className="truncate text-xs font-semibold text-slate-900 dark:text-white">
          {name}
        </h3>
        <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400">
          {formatCurrency(price)}
        </span>
        <div className="mt-1 w-full">
          {available ? (
            quantityInCart > 0 ? (
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-end sm:gap-2 md:gap-3">
                <button
                  type="button"
                  onClick={onReduce}
                  className="flex min-h-[40px] w-full shrink-0 touch-manipulation items-center justify-center rounded-lg bg-primary-600 transition hover:bg-primary-500 active:scale-[0.98] sm:min-h-[44px] sm:min-w-[44px] sm:w-auto dark:bg-primary-600 dark:hover:bg-primary-500"
                  aria-label={`Reduce ${name} quantity`}
                >
                  <Minus className="h-4 w-4 text-white sm:h-5 sm:w-5" />
                </button>
                <button
                  type="button"
                  onClick={onAdd}
                  disabled={addDisabled}
                  title={addTooltip}
                  className="flex min-h-[40px] w-full shrink-0 touch-manipulation items-center justify-center rounded-lg bg-emerald-600 transition hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-600 sm:min-h-[44px] sm:min-w-[44px] sm:w-auto dark:bg-emerald-600 dark:hover:bg-emerald-500"
                  aria-label={addTooltip ?? `Add more ${name}`}
                >
                  <Plus className="h-4 w-4 text-white sm:h-5 sm:w-5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onAdd}
                disabled={addDisabled}
                title={addTooltip}
                className="flex w-full min-h-[40px] touch-manipulation items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-2 text-xs font-medium text-white transition hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-600 sm:min-h-[44px] sm:text-sm sm:px-3 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                aria-label={addTooltip ?? `Add ${name} to cart`}
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                Add
              </button>
            )
          ) : (
            <span className="inline-block rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-600 dark:text-slate-400">
              Not available
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
