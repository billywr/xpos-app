import {
  forwardRef,
  type ChangeEvent,
  type InputHTMLAttributes,
  type MouseEvent,
} from "react";
import { tryShowDatePicker } from "@/utils/setupGlobalDatePicker";

export type DateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  type?: "date" | "datetime-local" | "time" | "month";
};

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  function DateInput(
    { className = "", type = "date", onClick, onChange, ...props },
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

    return (
      <input
        ref={ref}
        type={type}
        className={`date-input cursor-pointer ${className}`.trim()}
        onClick={handleClick}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
