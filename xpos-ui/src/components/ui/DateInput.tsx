import { forwardRef, type InputHTMLAttributes, type MouseEvent } from "react";

export type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

function tryShowPicker(input: HTMLInputElement) {
  if (input.disabled) {
    return;
  }
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
    } catch {
      // Already open, unsupported, or not a user gesture — ignore.
    }
  }
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  function DateInput({ className = "", onClick, ...props }, ref) {
    const handleClick = (e: MouseEvent<HTMLInputElement>) => {
      tryShowPicker(e.currentTarget);
      onClick?.(e);
    };

    return (
      <input
        ref={ref}
        type="date"
        className={`date-input cursor-pointer ${className}`.trim()}
        onClick={handleClick}
        {...props}
      />
    );
  }
);
