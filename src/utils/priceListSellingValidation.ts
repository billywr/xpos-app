import { formatCurrency } from "@/utils/formatCurrency";

/**
 * Client-side check against catalog buying price. The server may use a higher cost floor
 * (e.g. max GRN unit cost); this catches the common case early with a clear message.
 *
 * @returns User-facing error message, or null if this check passes or cannot be applied.
 */
export function messageIfSellingAtOrBelowBuyingPrice(
  sellingPrice: number,
  buyingPrice: number | null | undefined
): string | null {
  if (buyingPrice == null || Number.isNaN(buyingPrice)) {
    return null;
  }
  if (sellingPrice <= buyingPrice) {
    return (
      `Selling price must be higher than the buying price (${formatCurrency(buyingPrice)}). ` +
      `You entered ${formatCurrency(sellingPrice)}. Increase the selling price or lower the buying price under Catalog → Items.`
    );
  }
  return null;
}
