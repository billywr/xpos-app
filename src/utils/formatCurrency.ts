export function formatCurrency(amount: number | null | undefined, currency = ""): string {
  const prefix = currency ? `${currency} ` : "";
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return `${prefix}0.00`;
  }
  const formatted = Math.abs(amount).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${prefix}${formatted}` : `${prefix}${formatted}`;
}

export function formatQty(qty: number | null | undefined): string {
  if (qty === null || qty === undefined || Number.isNaN(qty)) {
    return "0";
  }
  return Number(qty.toFixed(2)).toString();
}
