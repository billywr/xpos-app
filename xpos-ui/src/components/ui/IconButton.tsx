import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";
import { iconButtonVariants } from "./styles";

export type IconButtonVariant = keyof typeof iconButtonVariants;

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  children: ReactNode;
  "aria-label": string;
}

export function IconButton({
  variant = "ghost",
  className,
  type = "button",
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(iconButtonVariants[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}
