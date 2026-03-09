import { useRef, useCallback } from "react";
import { ScanBarcode } from "lucide-react";

export interface BarcodeCaptureInputProps {
  onScan: (barcode: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Optional: when true, show a compact inline style. */
  compact?: boolean;
  className?: string;
}

/**
 * Invisible input that captures barcode scanner input (HID keyboard mode).
 * Scanner sends characters then Enter/Tab; we treat that as one scan and call onScan(value).
 */
export function BarcodeCaptureInput({
  onScan,
  placeholder = "Scan barcode…",
  disabled = false,
  compact = false,
  className = "",
}: BarcodeCaptureInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter" && e.key !== "Tab") return;
      const input = inputRef.current;
      if (!input) return;
      const raw = input.value.trim();
      if (raw.length === 0) return;
      e.preventDefault();
      onScan(raw);
      input.value = "";
    },
    [onScan]
  );

  return (
    <div
      className={`relative ${compact ? "inline-block" : ""} ${className}`}
      onClick={() => inputRef.current?.focus()}
      role="button"
      tabIndex={-1}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.focus()}
      aria-label={placeholder}
    >
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={placeholder}
        className={
          compact
            ? "w-full min-w-[140px] rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-500"
            : "w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800/50 dark:text-white dark:placeholder:text-slate-400"
        }
        onKeyDown={handleKeyDown}
      />
      <ScanBarcode
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
        aria-hidden
      />
    </div>
  );
}
