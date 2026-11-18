import {
  forwardRef,
  type ChangeEvent,
  type InputHTMLAttributes,
  type MouseEvent,
} from "react";
import { Calendar } from "lucide-react";
import { tryShowDatePicker } from "@/utils/setupGlobalDatePicker";
import { formatDate } from "@/utils/formatDate";

export type DateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  type?: "date" | "datetime-local" | "time" | "month";
};

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  function DateInput(
    {
      className = "",
      type = "date",
      value,
      placeholder = "dd/mm/yyyy",
      disabled,
      readOnly,
      onClick,
      onChange,
      ...props
    },
    ref
  ) {
    const handleClick = (e: MouseEvent<HTMLInputElement>) => {
      tryShowDatePicker(e.currentTarget);
      onClick?.(e);
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      // Auto-close calendar and clear segment highlight upon selection
      try {
        e.currentTarget.blur();
      } catch {
        // Ignored in headless/test environments
      }
    };

    if (type !== "date") {
      return (
        <input
          ref={ref}
          type={type}
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          className={`date-input cursor-pointer ${className}`.trim()}
          onClick={handleClick}
          onChange={handleChange}
          {...props}
        />
      );
    }

    const stringValue =
      typeof value === "string" ? value : value != null ? String(value) : "";
    const displayFormatted = stringValue ? formatDate(stringValue, "") : "";

    return (
      <div
        className={`relative inline-flex items-center select-none focus-within:ring-1 focus-within:ring-primary-500 focus-within:border-primary-500 ${
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
        } ${className}`.trim()}
      >
        <span
          className={`truncate flex-1 pointer-events-none ${
            displayFormatted
              ? ""
              : "text-slate-400 dark:text-slate-500 font-normal"
          }`}
        >
          {displayFormatted || placeholder}
        </span>
        <Calendar
          className="pointer-events-none ml-2 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        />
        <input
          ref={ref}
          type="date"
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          className="date-input absolute inset-0 h-full w-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          onClick={handleClick}
          onChange={handleChange}
          {...props}
        />
      </div>
    );
  }
);
