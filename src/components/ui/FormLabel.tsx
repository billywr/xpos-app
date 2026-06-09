import type { LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";
import { formLabel } from "./styles";

export interface FormLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
  required?: boolean;
}

export function FormLabel({
  children,
  required,
  className,
  ...props
}: FormLabelProps) {
  return (
    <label className={cn(formLabel, className)} {...props}>
      {children}
      {required && (
        <span className="ml-0.5 text-red-600 dark:text-red-400" aria-hidden>
          *
        </span>
      )}
    </label>
  );
}
