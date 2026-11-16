import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

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
  /** Use "as_given" to keep option order (e.g. placeholder first); default sorts by label. */
  optionsOrder?: "sort" | "as_given";
  /** Allow the user to type a custom value not in the options list (default false). */
  allowCustomValue?: boolean;
  /** Callback when user requests adding a new option value right from dropdown */
  onAddOption?: (newOptionValue: string) => void;
  /** Callback when user deletes an option value right from dropdown */
  onDeleteOption?: (optionValue: string) => void;
  /** Custom placeholder for the bottom add-new input (default: "Add new option...") */
  addOptionPlaceholder?: string;
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
  optionsOrder = "sort",
  allowCustomValue = false,
  onAddOption,
  onDeleteOption,
  addOptionPlaceholder,
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
  const [newOptionInput, setNewOptionInput] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const emptySuggestionsRef = useRef<HTMLDivElement>(null);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = filterText.trim().toLowerCase();

  const orderedOptions = useMemo(() => {
    const copy = [...options];
    if (optionsOrder === "as_given") {
      return copy;
    }
    return copy.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    );
  }, [options, optionsOrder]);

  const suggestions = useMemo(() => {
    const matched = orderedOptions.filter((o) => optionMatches(o, q, matchOptionValue));
    return matched.slice(0, maxSuggestions);
  }, [orderedOptions, q, matchOptionValue, maxSuggestions]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const idx = suggestions.findIndex((o) => o.value === value);
    setHighlighted(idx >= 0 ? idx : 0);
  }, [open, suggestions, value]);

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

  const hasExactMatch = useMemo(() => {
    const trimmed = filterText.trim();
    if (!trimmed) return true;
    const lower = trimmed.toLowerCase();
    return options.some(
      (o) => o.value.toLowerCase() === lower || o.label.toLowerCase() === lower
    );
  }, [options, filterText]);

  const handleAddOption = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      onAddOption?.(trimmed);
      onChange(trimmed);
      setFilterText(trimmed);
      setNewOptionInput("");
      setOpen(false);
    },
    [onAddOption, onChange]
  );

  const handleDeleteOption = useCallback(
    (e: React.MouseEvent, optValue: string) => {
      e.stopPropagation();
      e.preventDefault();
      onDeleteOption?.(optValue);
      if (value === optValue) {
        onChange("");
      }
    },
    [onDeleteOption, value, onChange]
  );

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
        || popupRef.current?.contains(t)
      ) {
        return;
      }
      if (allowCustomValue && filterText.trim()) {
        onChange(filterText.trim());
      }
      setOpen(false);
      setFilterText(selected?.label ?? (allowCustomValue ? value : ""));
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, selected?.label, allowCustomValue, filterText, onChange, value]);

  const closedDisplay =
    selected?.label ?? (value ? (allowCustomValue ? value : unknownValueDisplay) : "");
  const displayValue = open ? filterText : closedDisplay;

  const openMenu = useCallback(() => {
    if (disabled) {
      return;
    }
    // Always clear the filter when opening. Using the selected label as the query substring-filters
    // the list (e.g. "Outstanding (open + partial)" matches only itself, hiding Open/All/etc.).
    setFilterText("");
    setNewOptionInput("");
    setOpen(true);
  }, [disabled]);

  const handleControlMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    if (blurTimeout.current) {
      clearTimeout(blurTimeout.current);
    }
    if (!open) {
      openMenu();
    }
    inputRef.current?.focus();
  };

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
      } else if (onAddOption && filterText.trim()) {
        handleAddOption(filterText.trim());
      } else if (allowCustomValue && filterText.trim()) {
        onChange(filterText.trim());
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setFilterText(selected?.label ?? (allowCustomValue ? value : ""));
    }
  };

  const defaultControl =
    "flex rounded-lg border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-700";
  const inputPad = compact ? "px-2 py-1.5" : "px-3 py-2";

  return (
    <div ref={containerRef} className={`relative w-full min-w-0 ${className}`}>
      <div
        className={`${defaultControl} ${controlClassName}`}
        onMouseDown={handleControlMouseDown}
      >
        <input
          ref={inputRef}
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
          onClick={() => {
            if (disabled) {
              return;
            }
            if (blurTimeout.current) {
              clearTimeout(blurTimeout.current);
            }
            if (!open) {
              openMenu();
            }
          }}
          onBlur={() => {
            blurTimeout.current = setTimeout(() => {
              if (popupRef.current?.contains(document.activeElement)) {
                return;
              }
              if (allowCustomValue && filterText.trim()) {
                onChange(filterText.trim());
              }
              setOpen(false);
              setFilterText(selected?.label ?? (allowCustomValue ? value : ""));
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
      {open && menuPosition
        ? createPortal(
            <div
              ref={popupRef}
              style={{
                position: "fixed",
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                zIndex: 1000,
              }}
              className="flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
            >
              {suggestions.length > 0 ? (
                <ul
                  ref={listboxRef}
                  id={listboxId}
                  role="listbox"
                  className="max-h-56 overflow-auto py-1 divide-y divide-slate-100 dark:divide-slate-700/40"
                >
                  {suggestions.map((opt, idx) => (
                    <li
                      key={`${opt.value}-${idx}`}
                      role="presentation"
                      className={`group flex items-center justify-between transition ${
                        idx === highlighted
                          ? "bg-primary-50 text-primary-900 dark:bg-primary-950/40 dark:text-primary-100"
                          : "text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"
                      }`}
                      onMouseEnter={() => setHighlighted(idx)}
                    >
                      <button
                        type="button"
                        role="option"
                        aria-selected={opt.value === value}
                        className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(opt)}
                      >
                        <span className="min-w-0 truncate font-medium">{opt.label}</span>
                        {opt.detail ? (
                          <span className="max-w-[100px] shrink-0 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                            {opt.detail}
                          </span>
                        ) : null}
                      </button>
                      {onDeleteOption && (
                        <button
                          type="button"
                          aria-label={`Delete ${opt.label}`}
                          title={`Delete ${opt.label}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => handleDeleteOption(e, opt.value)}
                          className="mr-2 rounded p-1 text-slate-400 opacity-70 transition hover:bg-rose-50 hover:text-rose-600 hover:opacity-100 focus:opacity-100 group-hover:opacity-100 dark:text-slate-400 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div
                  ref={emptySuggestionsRef}
                  className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400"
                >
                  {q
                    ? allowCustomValue && !onAddOption
                      ? `Press Enter to use "${filterText.trim()}"`
                      : `No options matching "${filterText.trim()}"`
                    : "No options available"}
                </div>
              )}

              {/* Quick-add row when typing a custom value that does not exist */}
              {onAddOption && filterText.trim() && !hasExactMatch && (
                <div className="border-t border-slate-200 bg-slate-50/80 p-1 dark:border-slate-700 dark:bg-slate-900/40">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleAddOption(filterText.trim())}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs font-semibold text-primary-600 transition hover:bg-primary-100/60 dark:text-primary-400 dark:hover:bg-primary-950/50"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Add &ldquo;{filterText.trim()}&rdquo;</span>
                  </button>
                </div>
              )}

              {/* Dedicated add new option input at the bottom of dropdown */}
              {onAddOption && (
                <div className="border-t border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900/60">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newOptionInput}
                      onChange={(e) => setNewOptionInput(e.target.value)}
                      onFocus={() => {
                        if (blurTimeout.current) {
                          clearTimeout(blurTimeout.current);
                        }
                      }}
                      onBlur={() => {
                        blurTimeout.current = setTimeout(() => {
                          if (
                            containerRef.current?.contains(document.activeElement) ||
                            popupRef.current?.contains(document.activeElement)
                          ) {
                            return;
                          }
                          setOpen(false);
                          setFilterText(selected?.label ?? (allowCustomValue ? value : ""));
                        }, 180);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddOption(newOptionInput);
                        }
                      }}
                      placeholder={addOptionPlaceholder ?? "Add new option..."}
                      className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    />
                    <button
                      type="button"
                      disabled={!newOptionInput.trim()}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleAddOption(newOptionInput)}
                      className="flex items-center gap-1 rounded bg-primary-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500 dark:hover:bg-primary-600"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
