import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Matched against search and shown as secondary text (e.g. code, SKU). */
  detail?: string;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  /** Shown in the input when open and no row is highlighted; primary hint text. */
  placeholder?: string;
  /** When the current value is missing from options, closed state shows this (default "—"). */
  unknownValueDisplay?: string;
  className?: string;
  /** Tailwind classes for the outer control (border box). */
  controlClassName?: string;
  maxSuggestions?: number;
  /** Include option `value` in text search (e.g. short codes). Default false. */
  matchOptionValue?: boolean;
  /** Denser padding (e.g. header toolbars). */
  compact?: boolean;
}

const DEFAULT_MAX = 80;

function optionMatches(
  opt: SearchableSelectOption,
  q: string,
  matchValue: boolean
): boolean {
  if (!q) {
    return true;
  }
  const ql = q.toLowerCase();
  if (opt.label.toLowerCase().includes(ql)) {
    return true;
  }
  if (opt.detail && opt.detail.toLowerCase().includes(ql)) {
    return true;
  }
  if (matchValue && opt.value.toLowerCase().includes(ql)) {
    return true;
  }
  return false;
}

/**
 * Searchable single-select with keyboard and mouse. Use everywhere instead of long &lt;select&gt; lists.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  disabled = false,
  id: idProp,
  "aria-label": ariaLabel,
  placeholder = "Search…",
  unknownValueDisplay = "—",
  className = "",
  controlClassName = "",
  maxSuggestions = DEFAULT_MAX,
  matchOptionValue = false,
  compact = false,
}: SearchableSelectProps) {
  const reactId = useId();
  const inputId = idProp ?? `searchable-select-${reactId}`;
  const listboxId = `${inputId}-listbox`;

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );

  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const emptySuggestionsRef = useRef<HTMLDivElement>(null);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = filterText.trim().toLowerCase();

  const orderedOptions = useMemo(() => {
    return [...options].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [options]);

  const suggestions = useMemo(() => {
    const matched = orderedOptions.filter((o) => optionMatches(o, q, matchOptionValue));
    return matched.slice(0, maxSuggestions);
  }, [orderedOptions, q, matchOptionValue, maxSuggestions]);

  useEffect(() => {
    if (open) {
      setHighlighted(0);
    }
  }, [open, q, suggestions.length]);

  useEffect(() => {
    return () => {
      if (blurTimeout.current) {
        clearTimeout(blurTimeout.current);
      }
    };
  }, []);

  const updateMenuPosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const r = el.getBoundingClientRect();
    setMenuPosition({
      top: r.bottom + 4,
      left: r.left,
      width: r.width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [open, updateMenuPosition, suggestions.length, q]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        containerRef.current?.contains(t)
        || listboxRef.current?.contains(t)
        || emptySuggestionsRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
      setFilterText(selected?.label ?? "");
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, selected?.label]);

  const closedDisplay = selected?.label ?? (value ? unknownValueDisplay : "");
  const displayValue = open ? filterText : closedDisplay;

  const openMenu = useCallback(() => {
    if (disabled) {
      return;
    }
    // Empty value often maps to a "Select…" placeholder row; using that label as the search
    // query would filter out every real option (nothing contains "select item").
    const isPlaceholderSelection = !selected || selected.value === "";
    setFilterText(isPlaceholderSelection ? "" : (selected.label ?? ""));
    setOpen(true);
  }, [disabled, selected]);

  const pick = useCallback(
    (opt: SearchableSelectOption) => {
      onChange(opt.value);
      setFilterText(opt.label);
      setOpen(false);
    },
    [onChange]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        openMenu();
      } else {
        setHighlighted((h) => Math.min(h + 1, Math.max(0, suggestions.length - 1)));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && suggestions[highlighted]) {
        pick(suggestions[highlighted]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setFilterText(selected?.label ?? "");
    }
  };

  const defaultControl =
    "flex rounded-lg border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-700";
  const inputPad = compact ? "px-2 py-1.5" : "px-3 py-2";

  return (
    <div ref={containerRef} className={`relative w-full min-w-0 ${className}`}>
      <div className={`${defaultControl} ${controlClassName}`}>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          disabled={disabled}
          value={displayValue}
          onChange={(e) => {
            setFilterText(e.target.value);
            if (!open) {
              setOpen(true);
            }
          }}
          onFocus={() => {
            if (blurTimeout.current) {
              clearTimeout(blurTimeout.current);
            }
            openMenu();
          }}
          onBlur={() => {
            blurTimeout.current = setTimeout(() => {
              setOpen(false);
              setFilterText(selected?.label ?? "");
            }, 180);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={`min-w-0 flex-1 rounded-l-lg border-0 bg-transparent ${inputPad} text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-white dark:placeholder:text-slate-500`}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (open ? setOpen(false) : openMenu())}
          className="flex shrink-0 items-center px-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          aria-label={open ? "Close list" : "Open list"}
        >
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && menuPosition && suggestions.length > 0
        ? createPortal(
            <ul
              ref={listboxRef}
              id={listboxId}
              role="listbox"
              style={{
                position: "fixed",
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                zIndex: 1000,
              }}
              className="max-h-60 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
            >
              {suggestions.map((opt, idx) => (
                <li key={`${opt.value}-${idx}`} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={opt.value === value}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                      idx === highlighted
                        ? "bg-primary-100 text-primary-900 dark:bg-primary-900/40 dark:text-primary-100"
                        : "text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlighted(idx)}
                    onClick={() => pick(opt)}
                  >
                    <span className="min-w-0 truncate font-medium">{opt.label}</span>
                    {opt.detail ? (
                      <span className="max-w-[100px] shrink-0 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                        {opt.detail}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>,
            document.body
          )
        : null}
      {open && menuPosition && q && suggestions.length === 0
        ? createPortal(
            <div
              ref={emptySuggestionsRef}
              style={{
                position: "fixed",
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                zIndex: 1000,
              }}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
            >
              No matches
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
