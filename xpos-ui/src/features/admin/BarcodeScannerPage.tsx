import { useRef, useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import JsBarcode from "jsbarcode";
import { ScanBarcode, Copy, Trash2, Check } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

const SAMPLE_BARCODES: { label: string; value: string }[] = [
  { label: "Product (EAN-13 style)", value: "5901234123457" },
  { label: "SKU", value: "ITEM-SAMPLE-001" },
  { label: "Short code", value: "ABC123" },
];

function SampleBarcode1D({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current || !value) return;
    try {
      JsBarcode(canvasRef.current, value, {
        format: "CODE128",
        displayValue: true,
        width: 2,
        height: 48,
        margin: 8,
      });
    } catch {
      // ignore invalid for CODE128
    }
  }, [value]);
  return (
    <canvas
      ref={canvasRef}
      className="max-w-full"
      aria-label={`1D barcode ${value}`}
    />
  );
}

export interface ScanEntry {
  id: string;
  value: string;
  at: number;
}

/** Admin-only page: test 1D/2D/QR barcode scanners (HID keyboard mode). No backend. */
export function BarcodeScannerPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scans, setScans] = useState<ScanEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCaptureFocused, setIsCaptureFocused] = useState(false);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter" && e.key !== "Tab") return;
      const input = inputRef.current;
      if (!input) return;
      const raw = input.value.trim();
      if (raw.length === 0) return;
      e.preventDefault();
      setScans((prev) => [
        {
          id: crypto.randomUUID(),
          value: raw,
          at: Date.now(),
        },
        ...prev.slice(0, 199),
      ]);
      input.value = "";
    },
    []
  );

  const handleCopy = useCallback(async (entry: ScanEntry) => {
    await navigator.clipboard.writeText(entry.value);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleClearAll = useCallback(() => {
    setScans([]);
    inputRef.current?.focus();
  }, []);

  const lastScan = scans[0];
  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <PageHeader
        title="Barcode scanner"
        subtitle="Test 1D / 2D / QR scanners (wireless or USB). No backend — scans are captured locally."
      />

      <div className="mt-4 flex flex-col gap-6">
        {/* Capture zone: input covers area so click focuses it; bg shows when focused */}
        <section
          className={`relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-10 transition-colors ${
            isCaptureFocused
              ? "border-primary-400 bg-primary-100 dark:border-primary-600 dark:bg-primary-900/40"
              : "border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50"
          }`}
        >
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Scanner input (receives barcode data)"
            className="absolute inset-0 z-10 cursor-pointer opacity-0"
            onFocus={() => setIsCaptureFocused(true)}
            onBlur={() => setIsCaptureFocused(false)}
            onKeyDown={handleKeyDown}
          />
          <ScanBarcode
            className={`h-14 w-14 transition-colors ${
              isCaptureFocused
                ? "text-primary-600 dark:text-primary-400"
                : "text-slate-400 dark:text-slate-500"
            }`}
          />
          <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400">
            {isCaptureFocused ? "Ready — scan now" : "Click here, then scan"}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
            Scanner acts as keyboard — data appears below on Enter
          </p>
        </section>

        {/* Sample barcodes to scan */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Sample barcodes to scan
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Use your scanner on these — or open on another device and scan the
            QR.
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SAMPLE_BARCODES.map((sample) => (
              <div
                key={sample.value}
                className="flex flex-col items-center rounded-lg border border-slate-100 p-4 dark:border-slate-700"
              >
                <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  {sample.label}
                </p>
                <p className="mb-3 font-mono text-sm text-slate-800 dark:text-slate-200">
                  {sample.value}
                </p>
                <div className="flex flex-col items-center gap-4">
                  <div className="rounded-lg bg-white p-2 dark:bg-slate-900">
                    <QRCodeSVG value={sample.value} size={120} level="M" />
                  </div>
                  <SampleBarcode1D value={sample.value} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Last scan */}
        {lastScan && (
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Last scan
            </h2>
            <p className="mt-2 break-all font-mono text-xl font-semibold text-slate-900 dark:text-white">
              {lastScan.value}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {formatTime(lastScan.at)}
            </p>
          </section>
        )}

        {/* Recent scans list */}
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 dark:border-slate-600">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Recent scans ({scans.length})
            </h2>
            {scans.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-700 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear all
              </button>
            )}
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-2">
            {scans.length === 0 ? (
              <li className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No scans yet. Focus the area above and scan a barcode or QR.
              </li>
            ) : (
              scans.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 py-2 pl-3 pr-2 dark:border-slate-700"
                >
                  <span className="min-w-0 flex-1 break-all font-mono text-sm text-slate-800 dark:text-slate-200">
                    {entry.value}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {formatTime(entry.at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(entry)}
                    className="shrink-0 rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-slate-200"
                    aria-label={`Copy ${entry.value}`}
                  >
                    {copiedId === entry.id ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
