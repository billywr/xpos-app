import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { toSentenceCase } from "@/utils/textCase";
import {
  statChipBase,
  statChipLabelTones,
  statChipTones,
  statChipValueTones,
} from "./styles";

export type StatChipTone = keyof typeof statChipTones;

export interface StatChipProps {
  label: string;
  value: ReactNode;
  tone?: StatChipTone;
  onClick?: () => void;
  className?: string;
}

export function StatChip({
  label,
  value,
  tone = "neutral",
  onClick,
  className,
}: StatChipProps) {
  const interactive = Boolean(onClick);
  const classes = cn(
    statChipBase,
    statChipTones[tone],
    "flex-col items-start",
    interactive && "cursor-pointer hover:shadow-md",
    className,
  );

  const content = (
    <>
      <span className={statChipLabelTones[tone]}>{toSentenceCase(label)}</span>
      <span className={statChipValueTones[tone]}>{value}</span>
    </>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }

  return (
    <div className={classes} role="status">
      {content}
    </div>
  );
}
