export function formatCurrency(amount: number | null | undefined, currency = "KSH"): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return `${currency} 0.00`;
  }
  const formatted = Math.abs(amount).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${currency} ${formatted}` : `${currency} ${formatted}`;
}

export function formatQty(qty: number | null | undefined): string {
  if (qty === null || qty === undefined || Number.isNaN(qty)) {
    return "0";
  }
  return Number(qty.toFixed(2)).toString();
}
