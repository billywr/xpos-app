import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  type ChangeEvent,
  type InputHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar } from "lucide-react";
import { tryShowDatePicker } from "@/utils/setupGlobalDatePicker";
import { formatDate } from "@/utils/formatDate";

export type DateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  type?: "date" | "datetime-local" | "time" | "month";
};

function parseLocalDate(valueStr: unknown): Date | null {
  if (!valueStr) return null;
  const s = String(valueStr).trim().slice(0, 10);
  const parts = s.split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d);
    }
  }
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface CustomTriggerProps {
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  onCustomClick?: (e: MouseEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  displayFormatted?: string;
  placeholder?: string;
  defaultPlaceholder?: string;
  children?: ReactNode;
}

const CustomTrigger = forwardRef<HTMLDivElement, CustomTriggerProps>(
  function CustomTrigger(
    {
      onClick,
      onCustomClick,
      className = "",
      disabled,
      readOnly,
      displayFormatted,
      placeholder,
      defaultPlaceholder = "dd/mm/yyyy",
      children,
    },
    triggerRef
  ) {
    const textToShow = displayFormatted || placeholder || defaultPlaceholder;

    return (
      <div
        ref={triggerRef}
        onClick={(e) => {
          if (disabled || readOnly) return;
          onClick?.(e);
          onCustomClick?.(e as unknown as MouseEvent<HTMLInputElement>);
        }}
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
          {textToShow}
        </span>
        <Calendar
          className="pointer-events-none ml-2 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        />
        {children}
      </div>
    );
  }
);

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
    const hiddenInputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => hiddenInputRef.current!);

    const handleClick = (e: MouseEvent<HTMLInputElement>) => {
      e.stopPropagation();
      tryShowDatePicker(e.currentTarget);
      onClick?.(e);
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
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
    const selectedDate = useMemo(() => parseLocalDate(stringValue), [stringValue]);
    const minDate = useMemo(() => parseLocalDate(props.min), [props.min]);
    const maxDate = useMemo(() => parseLocalDate(props.max), [props.max]);

    const handleDatePickerChange = (d: Date | null) => {
      const nextStr = d ? toLocalDateString(d) : "";
      if (hiddenInputRef.current) {
        hiddenInputRef.current.value = nextStr;
      }
      const targetObj = {
        value: nextStr,
        name: props.name ?? "",
        id: props.id ?? "",
      };
      const syntheticEvent = {
        target: targetObj,
        currentTarget: targetObj,
        type: "change",
      } as unknown as ChangeEvent<HTMLInputElement>;
      onChange?.(syntheticEvent);
    };

    return (
      <DatePicker
        selected={selectedDate}
        onChange={handleDatePickerChange}
        minDate={minDate ?? undefined}
        maxDate={maxDate ?? undefined}
        disabled={disabled}
        readOnly={readOnly}
        dateFormat="dd/MM/yyyy"
        placeholderText={placeholder}
        showPopperArrow={false}
        popperPlacement="bottom-start"
        popperProps={{ strategy: "fixed" }}
        wrapperClassName={className.includes("w-full") ? "w-full block" : "inline-block"}
        customInput={
          <CustomTrigger
            className={className}
            disabled={disabled}
            readOnly={readOnly}
            displayFormatted={displayFormatted}
            placeholder={placeholder}
            defaultPlaceholder={placeholder}
            onCustomClick={onClick}
          >
            <input
              ref={hiddenInputRef}
              type="date"
              value={value}
              disabled={disabled}
              readOnly={readOnly}
              className="date-input sr-only pointer-events-none"
              tabIndex={-1}
              onClick={handleClick}
              onChange={handleChange}
              {...props}
            />
          </CustomTrigger>
        }
      />
    );
  }
);
