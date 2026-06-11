import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getMpesaStkPhoneSuggestions } from "@/utils/mpesaPhoneHistory";

type MpesaStkPhoneInputProps = {
  orgId: string;
  branchId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: "default" | "large";
};

export function MpesaStkPhoneInput({
  orgId,
  branchId,
  value,
  onChange,
  disabled = false,
  size = "default",
}: MpesaStkPhoneInputProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [refreshToken, setRefreshToken] = useState(0);

  const suggestions = useMemo(
    () => getMpesaStkPhoneSuggestions(orgId, branchId, value),
    [orgId, branchId, value, refreshToken]
  );

  const showSuggestions = open && !disabled && suggestions.length > 0;

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const selectSuggestion = (phone: string) => {
    onChange(phone);
    setOpen(false);
    setActiveIndex(-1);
    setRefreshToken((n) => n + 1);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      if (event.key === "ArrowDown" && suggestions.length > 0) {
        setOpen(true);
        setActiveIndex(0);
        event.preventDefault();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]!);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const large = size === "large";

  return (
    <div ref={containerRef} className={large ? "mb-3" : "mb-3 space-y-2"}>
      <div className="relative">
        <input
          type="tel"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Customer phone (07… or 254…)"
          disabled={disabled}
          className={
            large
              ? "min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-lg font-semibold tabular-nums text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 sm:min-h-[52px] sm:text-xl dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              : "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          }
          aria-label="M-PESA phone number"
          aria-autocomplete="list"
          aria-controls={showSuggestions ? listboxId : undefined}
          aria-expanded={showSuggestions}
          role="combobox"
        />
        {showSuggestions && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
          >
            {suggestions.map((phone, index) => (
              <li key={phone} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`block w-full px-3 py-2 text-left tabular-nums ${
                    large ? "text-base font-semibold sm:text-lg" : "text-sm"
                  } ${
                    index === activeIndex
                      ? "bg-primary-50 text-primary-900 dark:bg-primary-900/30 dark:text-primary-100"
                      : "text-slate-800 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-700"
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(phone)}
                >
                  {phone}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
