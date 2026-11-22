import { Delete } from "lucide-react";

interface PosNumpadProps {
  onDigit: (digit: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  disabled?: boolean;
  className?: string;
}

export function PosNumpad({
  onDigit,
  onClear,
  onBackspace,
  disabled = false,
  className = "",
}: PosNumpadProps) {
  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [".", "0", "00"],
  ];

  return (
    <div className={`flex flex-col gap-2.5 select-none ${className}`}>
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {keys.flat().map((key) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onDigit(key)}
            className="flex h-12 sm:h-14 xl:h-16 touch-manipulation items-center justify-center rounded-xl border border-slate-200 bg-white text-xl sm:text-2xl font-bold text-slate-800 shadow-xs transition hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
          >
            {key}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
        <button
          type="button"
          disabled={disabled}
          onClick={onClear}
          className="flex h-11 sm:h-12 xl:h-14 touch-manipulation items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-sm sm:text-base font-bold text-slate-600 shadow-xs transition hover:bg-slate-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          Clear
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onBackspace}
          className="flex h-11 sm:h-12 xl:h-14 touch-manipulation items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 text-sm sm:text-base font-bold text-slate-600 shadow-xs transition hover:bg-slate-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          aria-label="Backspace"
        >
          <Delete className="h-5 w-5" />
          <span>Del</span>
        </button>
      </div>
    </div>
  );
}
