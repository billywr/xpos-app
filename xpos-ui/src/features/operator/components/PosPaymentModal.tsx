import {
  useState,
  useEffect,
  useMemo,
} from "react";
import {
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  UserCheck,
} from "lucide-react";
import { formatCurrency, formatAmount, formatAmountWithCommas } from "@/utils/formatCurrency";
import {
  fetchMpesaStkStatus,
  initiateMpesaStk,
  type MpesaStkStatus,
} from "@/api/mpesa";
import { fetchSale } from "@/api/sales";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  getLastMpesaStkPhone,
  rememberMpesaStkPhone,
} from "@/utils/mpesaPhoneHistory";
import { MpesaStkPhoneInput } from "@/components/MpesaStkPhoneInput";
import { DateInput } from "@/components/ui";
import { PosNumpad } from "./PosNumpad";
import type { Sale, Tender } from "@/types/sales";

const TERMINAL_STK_STATUSES: MpesaStkStatus[] = [
  "SUCCESS",
  "FAILED",
  "CANCELLED",
  "TIMEOUT",
];

export interface PosPaymentModalProps {
  sale: Sale;
  token: string | null;
  orgId: string;
  branchId: string;
  terminalId: string;
  tenderTypes: { id: string; code: string; name: string }[];
  mpesaStkEnabled: boolean;
  totalTendered: number;
  canComplete: boolean;
  addTenderAmount: string;
  setAddTenderAmount: (v: string) => void;
  addTenderTypeId: string;
  setAddTenderTypeId: (v: string) => void;
  onAddTender: () => void;
  onRemoveTender: (tenderId: string) => void;
  onComplete: () => void;
  onCompleteWithDebt?: (body: {
    customerName: string;
    customerPhone?: string;
    dueDate?: string;
  }) => void;
  onSaleUpdated: (sale: Sale) => void;
  onStkAutoCompleted: () => void;
  onClose: () => void;
  isAddingTender: boolean;
  isRemovingTender: boolean;
  isCompleting: boolean;
  isCompletingWithDebt?: boolean;
  addTenderError: string | null;
  removeTenderError: string | null;
  completeError: string | null;
  completeWithDebtError?: string | null;
}

export function PosPaymentModal({
  sale,
  token,
  orgId,
  branchId,
  terminalId,
  tenderTypes,
  mpesaStkEnabled,
  totalTendered,
  canComplete,
  addTenderAmount,
  setAddTenderAmount,
  addTenderTypeId,
  setAddTenderTypeId,
  onAddTender,
  onRemoveTender,
  onComplete,
  onCompleteWithDebt,
  onSaleUpdated,
  onStkAutoCompleted,
  onClose,
  isAddingTender,
  isRemovingTender,
  isCompleting,
  isCompletingWithDebt = false,
  addTenderError,
  removeTenderError,
  completeError,
  completeWithDebtError,
}: PosPaymentModalProps) {
  const total = Number(sale.total) || 0;
  const remainder = total - totalTendered;

  const [paymentMode, setPaymentMode] = useState<"cash" | "mpesa" | "other">("cash");
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [debtCustomerName, setDebtCustomerName] = useState("");
  const [debtCustomerPhone, setDebtCustomerPhone] = useState("");
  const [debtDueDate, setDebtDueDate] = useState("");

  const [stkPhone, setStkPhone] = useState("");
  const [stkRequestId, setStkRequestId] = useState<string | null>(null);
  const [stkStatus, setStkStatus] = useState<MpesaStkStatus | null>(null);
  const [stkMessage, setStkMessage] = useState<string | null>(null);
  const [stkError, setStkError] = useState<string | null>(null);
  const [isSendingStk, setIsSendingStk] = useState(false);
  const stkPolling = stkRequestId != null && stkStatus === "PENDING";

  const cashTenderType = tenderTypes.find((t) => t.code === "CASH") ?? tenderTypes[0];
  const cashTenderTypeId = cashTenderType?.id ?? "";

  const otherTenders = useMemo(
    () => tenderTypes.filter((t) => t.code !== "CASH"),
    [tenderTypes]
  );
  const totalTabs = 1 + (mpesaStkEnabled ? 1 : 0) + otherTenders.length;

  const tabsGridColsClass = useMemo(() => {
    if (totalTabs <= 1) return "grid-cols-1";
    if (totalTabs === 2) return "grid-cols-2";
    if (totalTabs === 3) return "grid-cols-3";
    if (totalTabs === 4) return "grid-cols-2 sm:grid-cols-4";
    return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
  }, [totalTabs]);

  // Preset default tender type
  useEffect(() => {
    if (!addTenderTypeId && cashTenderTypeId) {
      setAddTenderTypeId(cashTenderTypeId);
    }
  }, [addTenderTypeId, cashTenderTypeId, setAddTenderTypeId]);

  // Load last M-Pesa phone
  useEffect(() => {
    const last = getLastMpesaStkPhone(orgId, branchId);
    if (last) {
      setStkPhone(last);
    }
  }, [orgId, branchId]);

  // M-Pesa STK polling
  useEffect(() => {
    if (!stkPolling || !token) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const status = await fetchMpesaStkStatus(
          token,
          orgId,
          branchId,
          terminalId,
          sale.id,
          stkRequestId!
        );
        if (cancelled) return;
        setStkStatus(status.status);
        setStkMessage(status.resultDesc);
        if (status.status === "SUCCESS") {
          const refreshed = await fetchSale(
            token,
            orgId,
            branchId,
            terminalId,
            sale.id
          );
          if (!cancelled) {
            onSaleUpdated(refreshed);
            const tendered = (refreshed.tenders ?? []).reduce(
              (sum, t) => sum + (Number(t.amount) || 0),
              0
            );
            const saleTotal = Number(refreshed.total) || 0;
            if (tendered >= saleTotal) {
              setStkMessage("M-Pesa payment received. Tap complete sale below.");
              setPaymentMode("cash");
            }
            if (status.saleCompleted) {
              onStkAutoCompleted();
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setStkError(getApiErrorMessage(err));
        }
      }
    };

    poll();
    const id = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    stkPolling,
    token,
    orgId,
    branchId,
    terminalId,
    sale.id,
    stkRequestId,
    onSaleUpdated,
    onStkAutoCompleted,
  ]);

  const handleSendStk = async () => {
    if (!token || remainder <= 0) return;
    setIsSendingStk(true);
    setStkError(null);
    setStkMessage(null);
    try {
      const res = await initiateMpesaStk(
        token,
        orgId,
        branchId,
        terminalId,
        sale.id,
        { phoneNumber: stkPhone.trim(), amount: remainder }
      );
      setStkRequestId(res.id);
      setStkStatus(res.status);
      setStkMessage("M-Pesa request sent. Waiting for customer PIN...");
      rememberMpesaStkPhone(orgId, branchId, stkPhone.trim());
    } catch (err) {
      setStkError(getApiErrorMessage(err));
    } finally {
      setIsSendingStk(false);
    }
  };

  // Numpad handler
  const handleNumpadDigit = (digit: string) => {
    const raw = addTenderAmount.replace(/,/g, "");
    if (digit === ".") {
      if (raw.includes(".")) return;
      const next = raw ? `${raw}.` : "0.";
      setAddTenderAmount(formatAmountWithCommas(next));
      return;
    }
    if (digit === "00") {
      if (!raw || raw === "0") return;
      const next = `${raw}00`;
      setAddTenderAmount(formatAmountWithCommas(next));
      return;
    }
    if (raw === "0") {
      setAddTenderAmount(digit);
      return;
    }
    // Limit decimal places to 2
    if (raw.includes(".")) {
      const [, dec] = raw.split(".");
      if (dec && dec.length >= 2) return;
    }
    const next = `${raw}${digit}`;
    setAddTenderAmount(formatAmountWithCommas(next));
  };

  const handleNumpadBackspace = () => {
    const raw = addTenderAmount.replace(/,/g, "");
    const next = raw.slice(0, -1);
    setAddTenderAmount(formatAmountWithCommas(next));
  };

  const handleNumpadClear = () => {
    setAddTenderAmount("");
  };

  // Quick Preset buttons
  const quickPresets = useMemo(() => {
    const list: { label: string; amount: number }[] = [];
    if (remainder > 0) {
      list.push({ label: "Exact", amount: remainder });
      // Common round denominations higher than remainder
      const denominations = [50, 100, 200, 500, 1000, 2000];
      for (const d of denominations) {
        if (d >= remainder && list.length < 5) {
          list.push({ label: `${formatAmount(d)}`, amount: d });
        }
      }
      // If remainder is large, offer round increments
      if (list.length < 5) {
        const nextHundred = Math.ceil(remainder / 100) * 100;
        const nextFiveHundred = Math.ceil(remainder / 500) * 500;
        const nextThousand = Math.ceil(remainder / 1000) * 1000;
        if (nextHundred > remainder && !list.some((l) => l.amount === nextHundred)) {
          list.push({ label: `${formatAmount(nextHundred)}`, amount: nextHundred });
        }
        if (nextFiveHundred > remainder && !list.some((l) => l.amount === nextFiveHundred)) {
          list.push({ label: `${formatAmount(nextFiveHundred)}`, amount: nextFiveHundred });
        }
        if (nextThousand > remainder && !list.some((l) => l.amount === nextThousand)) {
          list.push({ label: `${formatAmount(nextThousand)}`, amount: nextThousand });
        }
      }
    }
    return list;
  }, [remainder]);

  const showDebtSection =
    remainder > 0 && totalTendered > 0 && onCompleteWithDebt != null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-2 sm:p-3 md:p-5 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-payment-modal-title"
    >
      <div className="flex h-[94vh] max-h-[96vh] w-[95vw] max-w-[1800px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <h2
                id="pos-payment-modal-title"
                className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white"
              >
                Checkout & payment
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
                Order total: <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(total)}</span> • {sale.lines?.length ?? 0} item{sale.lines?.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body: 38-40% Left Order Summary / 60-62% Right Payment Workspace */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[38%_62%] xl:grid-cols-[40%_60%] lg:divide-x lg:divide-slate-200 dark:lg:divide-slate-700">
          {/* Left Column: Financial Balance, Tendered lines & Independently Scrollable Order Lines */}
          <div className="flex flex-col min-h-0 p-5 sm:p-6 bg-slate-50/70 dark:bg-slate-900/60 overflow-hidden gap-4">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-700 dark:bg-slate-800">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                  Total due
                </span>
                <p className="mt-1 text-2xl sm:text-3xl font-black tabular-nums text-slate-900 dark:text-white">
                  {formatCurrency(total)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-700 dark:bg-slate-800">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                  Tendered
                </span>
                <p className="mt-1 text-2xl sm:text-3xl font-black tabular-nums text-slate-900 dark:text-white">
                  {formatCurrency(totalTendered)}
                </p>
              </div>
            </div>

            {/* Remaining or Change Banner */}
            {remainder > 0 ? (
              <div className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200 shadow-xs shrink-0">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <span className="font-bold text-sm sm:text-base">Remaining balance:</span>
                </div>
                <span className="text-xl sm:text-2xl font-black tabular-nums">
                  {formatCurrency(remainder)}
                </span>
              </div>
            ) : totalTendered > 0 ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-200 shadow-xs shrink-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-sm sm:text-base">Change due:</span>
                </div>
                <span className="text-2xl sm:text-3xl font-black tabular-nums">
                  {formatCurrency(-remainder)}
                </span>
              </div>
            ) : null}

            {/* Tendered Payments List (if any) */}
            {sale.tenders && sale.tenders.length > 0 && (
              <div className="shrink-0 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Payments added ({sale.tenders.length})
                </h3>
                <ul className="max-h-36 overflow-y-auto space-y-2 pr-1">
                  {sale.tenders.map((t: Tender) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-700 dark:bg-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold uppercase text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          {t.tenderTypeCode ?? "TENDER"}
                        </span>
                        <span className="text-base font-bold tabular-nums text-slate-900 dark:text-white">
                          {formatCurrency(t.amount)}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={isRemovingTender}
                        onClick={() => onRemoveTender(t.id)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 active:scale-95 disabled:opacity-40 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        aria-label={`Remove payment ${formatCurrency(t.amount)}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                {removeTenderError && (
                  <p className="mt-1 text-xs text-red-500" role="alert">
                    {removeTenderError}
                  </p>
                )}
              </div>
            )}

            {/* Order Lines Check (Independently Scrollable with Full Room for Product Names) */}
            <div className="flex flex-col min-h-0 flex-1 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="mb-2 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                  Order lines ({sale.lines?.length ?? 0})
                </span>
              </div>
              <div className="flex-1 min-h-[160px] overflow-y-auto pr-1 space-y-2">
                {(sale.lines ?? []).map((line) => (
                  <div
                    key={line.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="flex h-6 min-w-[1.75rem] items-center justify-center rounded-lg bg-primary-100 text-primary-900 dark:bg-primary-900/40 dark:text-primary-300 dark:border dark:border-primary-500/40 px-1.5 text-xs font-extrabold shadow-2xs">
                        {line.qty}×
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug break-words">
                          {line.itemName}
                        </h4>
                        <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                          {formatCurrency(line.unitPrice)} ea
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm sm:text-base font-black tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(line.lineTotal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Payment Input & Tenders (60-62%) */}
          <div className="flex flex-col min-h-0 p-5 sm:p-6 lg:p-7 space-y-6 overflow-y-auto bg-white dark:bg-slate-800">
            {/* Payment Method Selector Tabs */}
            <div className={`grid ${tabsGridColsClass} gap-3 shrink-0`}>
              <button
                type="button"
                onClick={() => {
                  setPaymentMode("cash");
                  if (cashTenderTypeId) setAddTenderTypeId(cashTenderTypeId);
                }}
                className={`flex min-h-[52px] sm:min-h-[56px] touch-manipulation items-center justify-center gap-2.5 rounded-xl border px-4 py-3 text-base font-bold transition active:scale-[0.98] ${
                  paymentMode === "cash"
                    ? "border-primary-500 bg-primary-600 text-white font-extrabold shadow-xs dark:border-primary-400 dark:bg-primary-500 dark:text-white"
                    : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-700/60 dark:text-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <Banknote className="h-5 w-5" />
                <span>Cash</span>
              </button>

              {mpesaStkEnabled && (
                <button
                  type="button"
                  onClick={() => setPaymentMode("mpesa")}
                  className={`flex min-h-[52px] sm:min-h-[56px] touch-manipulation items-center justify-center gap-2.5 rounded-xl border px-4 py-3 text-base font-bold transition active:scale-[0.98] ${
                  paymentMode === "mpesa"
                    ? "border-emerald-700 bg-emerald-700 text-white shadow-xs"
                    : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-700/60 dark:text-slate-200 dark:hover:bg-slate-700"
                }`}
                >
                  <Smartphone className="h-5 w-5" />
                  <span>M-Pesa STK</span>
                </button>
              )}

              {otherTenders.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setPaymentMode("other");
                    setAddTenderTypeId(t.id);
                  }}
                  className={`flex min-h-[52px] sm:min-h-[56px] touch-manipulation items-center justify-center gap-2.5 rounded-xl border px-4 py-3 text-base font-bold transition active:scale-[0.98] ${
                    paymentMode === "other" && addTenderTypeId === t.id
                      ? "border-primary-500 bg-primary-600 text-white font-extrabold shadow-xs dark:border-primary-400 dark:bg-primary-500 dark:text-white"
                      : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-700/60 dark:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <CreditCard className="h-5 w-5" />
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </div>

            {/* Mode: Cash Payment (Intelligent Side-by-Side Flow on wide screens) */}
            {paymentMode === "cash" && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Left Sub-Column: Amount Input + Quick Denominations + Debt (xl:col-span-6) */}
                <div className="flex flex-col gap-5 xl:col-span-6">
                  {/* Amount Input with Add Button */}
                  <div className="flex h-14 sm:h-16 items-stretch gap-2.5">
                    <div className="relative flex-1 h-full">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-extrabold text-slate-400">
                        KSH
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={addTenderAmount}
                        onChange={(e) => setAddTenderAmount(formatAmountWithCommas(e.target.value))}
                        placeholder="0.00"
                        className="h-full w-full rounded-xl border border-slate-300 bg-white pl-16 pr-4 text-right text-2xl sm:text-3xl font-black tabular-nums text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        aria-label="Tender amount"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={
                        isAddingTender ||
                        !addTenderTypeId ||
                        !addTenderAmount ||
                        parseFloat(addTenderAmount.replace(/,/g, "")) <= 0
                      }
                      onClick={onAddTender}
                      className="flex h-full min-w-[130px] touch-manipulation items-center justify-center rounded-xl bg-primary-600 px-6 text-base sm:text-lg font-black text-white shadow-xs transition hover:bg-primary-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-primary-600 dark:hover:bg-primary-500"
                    >
                      {isAddingTender ? "Adding..." : "Add cash"}
                    </button>
                  </div>

                  {addTenderError && (
                    <p className="text-xs text-red-500" role="alert">
                      {addTenderError}
                    </p>
                  )}

                  {/* Quick Cash Presets */}
                  {quickPresets.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                        Quick cash presets
                      </span>
                      <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {quickPresets.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setAddTenderAmount(formatAmountWithCommas(String(preset.amount)))}
                            className="min-h-[48px] sm:min-h-[52px] touch-manipulation rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm sm:text-base font-bold text-slate-800 shadow-2xs transition hover:border-primary-500 hover:bg-primary-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:hover:border-primary-500"
                          >
                            {preset.label === "Exact" ? "Exact (" : "KSH "}
                            {preset.label}
                            {preset.label === "Exact" ? ")" : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Balance as Debt Collapsible */}
                  {showDebtSection && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-slate-900/60">
                      <button
                        type="button"
                        onClick={() => setShowDebtForm(!showDebtForm)}
                        className="flex w-full items-center justify-between text-left text-sm font-bold text-amber-900 dark:text-amber-200"
                      >
                        <span className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          Record balance ({formatCurrency(remainder)}) as debt
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${showDebtForm ? "rotate-180" : ""}`}
                        />
                      </button>

                      {showDebtForm && (
                        <div className="mt-3 space-y-3 pt-2">
                          <input
                            type="text"
                            required
                            value={debtCustomerName}
                            onChange={(e) => setDebtCustomerName(e.target.value)}
                            placeholder="Customer name *"
                            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            aria-label="Customer name"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="tel"
                              value={debtCustomerPhone}
                              onChange={(e) => setDebtCustomerPhone(e.target.value)}
                              placeholder="Customer phone"
                              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              aria-label="Customer phone"
                            />
                            <DateInput
                              value={debtDueDate}
                              onChange={(e) => setDebtDueDate(e.target.value)}
                              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              aria-label="Due date"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={
                              !debtCustomerName.trim() || isCompletingWithDebt || isCompleting
                            }
                            onClick={() =>
                              onCompleteWithDebt?.({
                                customerName: debtCustomerName.trim(),
                                customerPhone: debtCustomerPhone.trim() || undefined,
                                dueDate: debtDueDate || undefined,
                              })
                            }
                            className="min-h-[46px] w-full touch-manipulation rounded-xl bg-primary-600 py-2.5 text-sm font-bold text-white transition hover:bg-primary-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-500"
                          >
                            {isCompletingWithDebt ? "Recording debt..." : "Complete with balance as debt"}
                          </button>
                          {completeWithDebtError && (
                            <p className="text-xs text-red-500" role="alert">
                              {completeWithDebtError}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Sub-Column: Full-Size Touch Keypad (xl:col-span-6) */}
                <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/60 xl:col-span-6">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                    Touch numpad
                  </span>
                  <PosNumpad
                    onDigit={handleNumpadDigit}
                    onClear={handleNumpadClear}
                    onBackspace={handleNumpadBackspace}
                    disabled={isAddingTender}
                  />
                </div>
              </div>
            )}

            {/* Mode: M-Pesa STK */}
            {paymentMode === "mpesa" && mpesaStkEnabled && (
              <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-6 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    M-Pesa STK Push
                  </h3>
                </div>
                {remainder <= 0 ? (
                  <p className="text-base font-semibold text-slate-500 dark:text-slate-300">
                    Order is fully tendered. Tap complete sale below.
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Amount to prompt: <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(remainder)}</span>
                    </p>
                    <MpesaStkPhoneInput
                      orgId={orgId}
                      branchId={branchId}
                      value={stkPhone}
                      onChange={setStkPhone}
                      disabled={stkPolling || isSendingStk}
                      size="large"
                    />
                    <button
                      type="button"
                      disabled={
                        stkPolling ||
                        isSendingStk ||
                        !stkPhone.trim() ||
                        remainder <= 0
                      }
                      onClick={handleSendStk}
                      className="flex min-h-[54px] w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 text-base sm:text-lg font-bold text-white shadow-xs transition hover:bg-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSendingStk ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Sending request...</span>
                        </>
                      ) : (
                        <span>Send M-Pesa request ({formatCurrency(remainder)})</span>
                      )}
                    </button>

                    {stkPolling && (
                      <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
                        <span>Prompt sent. Customer should enter PIN on phone...</span>
                      </div>
                    )}

                    {stkStatus && TERMINAL_STK_STATUSES.includes(stkStatus) && (
                      <div
                        className={`rounded-xl p-4 text-sm font-semibold ${
                          stkStatus === "SUCCESS"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                        }`}
                      >
                        {stkStatus === "SUCCESS"
                          ? "M-Pesa payment received successfully!"
                          : stkMessage ?? `M-Pesa ${stkStatus.toLowerCase()}`}
                      </div>
                    )}

                    {stkError && (
                      <p className="text-xs text-red-500" role="alert">
                        {stkError}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Mode: Other Tender Type (Card, Bank, etc.) */}
            {paymentMode === "other" && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <div className="flex flex-col gap-5 xl:col-span-6">
                  <div className="flex h-14 sm:h-16 items-stretch gap-2.5">
                    <div className="relative flex-1 h-full">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-extrabold text-slate-400">
                        KSH
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={addTenderAmount}
                        onChange={(e) => setAddTenderAmount(formatAmountWithCommas(e.target.value))}
                        placeholder={remainder > 0 ? formatAmountWithCommas(String(remainder)) : "0.00"}
                        className="h-full w-full rounded-xl border border-slate-300 bg-white pl-16 pr-4 text-right text-2xl sm:text-3xl font-black tabular-nums text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        aria-label="Tender amount"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={
                        isAddingTender ||
                        !addTenderTypeId ||
                        !addTenderAmount ||
                        parseFloat(addTenderAmount.replace(/,/g, "")) <= 0
                      }
                      onClick={onAddTender}
                      className="flex h-full min-w-[130px] touch-manipulation items-center justify-center rounded-xl bg-primary-600 px-6 text-base sm:text-lg font-black text-white shadow-xs transition hover:bg-primary-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-primary-600 dark:hover:bg-primary-500"
                    >
                      {isAddingTender ? "Adding..." : "Add tender"}
                    </button>
                  </div>

                  {addTenderError && (
                    <p className="text-xs text-red-500" role="alert">
                      {addTenderError}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/60 xl:col-span-6">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                    Touch numpad
                  </span>
                  <PosNumpad
                    onDigit={handleNumpadDigit}
                    onClear={handleNumpadClear}
                    onBackspace={handleNumpadBackspace}
                    disabled={isAddingTender}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer: Complete Sale CTA */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <span className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-300">
              {canComplete
                ? "Payment complete. Ready to finalize."
                : `Remaining balance: ${formatCurrency(Math.max(0, remainder))}`}
            </span>
          </div>

          <div className="flex items-stretch gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[52px] sm:min-h-[56px] touch-manipulation items-center justify-center rounded-xl border border-slate-300 px-6 text-base sm:text-lg font-bold text-slate-700 transition hover:bg-slate-100 active:scale-95 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canComplete || isCompleting}
              onClick={onComplete}
              className="flex min-h-[52px] sm:min-h-[56px] min-w-[180px] sm:min-w-[220px] touch-manipulation items-center justify-center gap-2.5 rounded-xl bg-emerald-700 px-6 text-base sm:text-lg font-extrabold text-white shadow-md transition hover:bg-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isCompleting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Completing...</span>
                </>
              ) : (
                <span>Complete sale</span>
              )}
            </button>
          </div>
        </div>
        {completeError && (
          <div className="border-t border-red-200 bg-red-50 px-6 py-2 text-xs font-semibold text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {completeError}
          </div>
        )}
      </div>
    </div>
  );
}
