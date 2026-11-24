import { useRef } from "react";
import { Printer, RotateCcw, X } from "lucide-react";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/utils/formatDate";
import type { ReceiptDetailResponse } from "@/types/sales";

const RECEIPT_SEPARATOR = "********************";

interface ReceiptModalProps {
  receipt: ReceiptDetailResponse;
  onClose: () => void;
  /** Optional shop header (business name). */
  shopName?: string;
  /** Optional address. */
  address?: string;
  /** Optional phone (e.g. "Telp. 11223344"). */
  phone?: string;
  /** Called when user clicks Print (before opening print dialog). Use for reprint logging. */
  onPrintComplete?: () => void;
  /** Sale ID for this receipt. When provided with onRefund, shows Refund button. */
  saleId?: string;
  /** Called when user clicks Refund. Parent should call refund API. */
  onRefund?: (saleId: string) => void;
  /** Whether refund is in progress. */
  isRefunding?: boolean;
}

function toNum(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

/** Simple barcode-style placeholder from receipt number. */
function BarcodePlaceholder({ value }: { value: string }) {
  const bars = value.split("").flatMap((d) => {
    const n = parseInt(d, 10) || 0;
    return [1, 1 + (n % 3), 1, 1 + ((n * 2) % 3), 1];
  });
  return (
    <div className="flex gap-0.5" style={{ height: 36 }}>
      {bars.map((w, i) => (
        <div
          key={i}
          className="bg-black"
          style={{ width: w, minWidth: w }}
          aria-hidden
        />
      ))}
    </div>
  );
}

function ReceiptBody({
  receipt,
  shopName,
  address,
  phone,
}: {
  receipt: ReceiptDetailResponse;
  shopName: string;
  address: string;
  phone: string;
}) {
  const taxTotal = toNum(receipt.taxTotal);
  const discountTotal = toNum(receipt.discountTotal);
  const total = toNum(receipt.total);
  const amountTendered = toNum(receipt.amountTendered);
  const changeDue = toNum(receipt.changeDue);
  const primaryTender = (receipt.tenders ?? [])[0];
  const primaryTenderName = primaryTender?.tenderTypeName ?? "Cash";

  return (
    <div className="receipt-body">
      {/* Header */}
      <div className="r-header">
        <div className="r-shop">{shopName || "SHOP NAME"}</div>
        {address ? <div className="r-sub">{address}</div> : null}
        {phone ? <div className="r-sub">{phone}</div> : null}
      </div>

      <div className="r-sep">{RECEIPT_SEPARATOR}</div>

      {/* Title */}
      <div className="r-title">CASH RECEIPT</div>
      <div className="r-sep">{RECEIPT_SEPARATOR}</div>

      {/* Item list */}
      <div className="r-row r-col">
        <span>Description</span>
        <span>Price</span>
      </div>
      {(receipt.lines ?? []).map((line) => {
        const qty = toNum(line.qty);
        const lineTotal = toNum(line.lineTotal);
        const mods = line.modifiers ?? [];
        const desc = qty > 1 ? `${line.itemName} × ${qty}` : line.itemName;
        return (
          <div key={line.id} className="r-item">
            <div className="r-row">
              <span className="r-desc">{desc}</span>
              <span className="r-num">{formatCurrency(lineTotal)}</span>
            </div>
            {mods.length > 0 &&
              mods.map((m) => (
                <div key={m.id} className="r-row r-mod">
                  <span className="r-desc">
                    + {m.modifierOptionName} ×{toNum(m.qty)}
                  </span>
                  <span className="r-num">
                    {formatCurrency(toNum(m.priceDelta) * toNum(m.qty))}
                  </span>
                </div>
              ))}
          </div>
        );
      })}

      <div className="r-sep">{RECEIPT_SEPARATOR}</div>

      {/* Summary */}
      <div className="r-row r-total">
        <span>Total</span>
        <span className="r-num">{formatCurrency(total)}</span>
      </div>
      <div className="r-row">
        <span>{primaryTenderName}</span>
        <span className="r-num">{formatCurrency(amountTendered)}</span>
      </div>
      {changeDue > 0 && (
        <div className="r-row">
          <span>Change</span>
          <span className="r-num">{formatCurrency(changeDue)}</span>
        </div>
      )}
      {receipt.debtAmount != null && receipt.debtAmount > 0 && (
        <>
          <div className="r-row">
            <span>Balance (debt)</span>
            <span className="r-num">{formatCurrency(receipt.debtAmount)}</span>
          </div>
          {receipt.debtDueDate && (
            <div className="r-row r-sub">
              <span>Due date</span>
              <span className="r-num">{formatDate(receipt.debtDueDate)}</span>
            </div>
          )}
        </>
      )}

      {(receipt.tenders ?? []).slice(1).map((t) => (
        <div key={t.id} className="r-row r-sub">
          <span>{t.tenderTypeName}</span>
          <span className="r-num">{formatCurrency(toNum(t.amount))}</span>
        </div>
      ))}
      {taxTotal > 0 && (
        <div className="r-row r-sub">
          <span>Tax</span>
          <span className="r-num">{formatCurrency(taxTotal)}</span>
        </div>
      )}
      {discountTotal > 0 && (
        <div className="r-row r-sub">
          <span>Discount</span>
          <span className="r-num">-{formatCurrency(discountTotal)}</span>
        </div>
      )}

      <div className="r-sep">{RECEIPT_SEPARATOR}</div>

      {/* Footer */}
      <div className="r-footer">Thank you!</div>
      <div className="r-barcode" aria-hidden>
        <BarcodePlaceholder value={String(receipt.receiptNumber)} />
      </div>
    </div>
  );
}

export function ReceiptModal({
  receipt,
  onClose,
  shopName = "",
  address = "",
  phone = "",
  onPrintComplete,
  saleId,
  onRefund,
  isRefunding = false,
}: ReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    onPrintComplete?.();
    const el = printRef.current;
    if (!el) return;
    const win = window.open("", "_blank", "width=320,height=600");
    if (!win) {
      window.print();
      return;
    }
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Receipt #${receipt.receiptNumber}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: ui-monospace, monospace; font-size: 12px; padding: 12px; max-width: 72mm; color: #000; background: #fff; }
            .receipt-body { width: 72mm; max-width: 100%; font-size: 12px; }
            .r-header { text-align: center; }
            .r-shop { font-weight: bold; font-size: 14px; text-transform: uppercase; }
            .r-sub { font-size: 11px; }
            .r-sep { text-align: center; font-size: 11px; margin: 8px 0; }
            .r-title { text-align: center; font-weight: bold; }
            .r-row { display: flex; justify-content: space-between; gap: 16px; margin: 2px 0; }
            .r-col { font-size: 11px; margin-bottom: 4px; }
            .r-desc { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .r-num { flex-shrink: 0; font-variant-numeric: tabular-nums; }
            .r-item { margin: 2px 0; }
            .r-mod { font-size: 11px; color: #4b5563; margin-left: 8px; }
            .r-total { font-weight: bold; }
            .r-footer { text-align: center; font-weight: bold; text-transform: uppercase; margin-top: 12px; }
            .r-barcode { display: flex; justify-content: center; margin-top: 12px; }
            .r-barcode > div { display: flex; gap: 2px; height: 36px; align-items: stretch; }
            .r-barcode > div > div {
              background: #000 !important;
              min-width: 1px;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          </style>
        </head>
        <body><div id="receipt-content"></div></body>
      </html>
    `);
    const container = win.document.getElementById("receipt-content")!;
    container.innerHTML = el.innerHTML;
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <h2
            id="receipt-modal-title"
            className="text-lg font-semibold text-slate-900 dark:text-white"
          >
            Receipt #{receipt.receiptNumber}
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-base font-medium text-white transition hover:bg-emerald-500"
              aria-label="Print receipt"
            >
              <Printer className="h-5 w-5" />
              Print
            </button>
            {saleId && onRefund && (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Refund this sale? Items will be returned to stock. This cannot be undone."
                    )
                  ) {
                    onRefund(saleId);
                  }
                }}
                disabled={isRefunding}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-base font-medium text-white transition hover:bg-amber-500 disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-600"
                aria-label="Refund sale"
              >
                <RotateCcw className="h-5 w-5" />
                {isRefunding ? "Refunding…" : "Refund"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-base font-medium text-white transition hover:bg-primary-500"
              aria-label="Close receipt"
            >
              <X className="h-5 w-5" />
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div
            ref={printRef}
            className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800"
          >
            <ReceiptBody
              receipt={receipt}
              shopName={shopName}
              address={address}
              phone={phone}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
