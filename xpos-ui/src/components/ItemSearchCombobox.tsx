import { useMemo } from "react";
import type { Item } from "@/types/catalog";
import { SearchableSelect } from "@/components/SearchableSelect";

export interface ItemSearchComboboxProps {
  items: Item[];
  value: string;
  onChange: (itemId: string) => void;
  disabled?: boolean;
  /** Optional id for label association */
  inputId?: string;
  placeholder?: string;
  unknownValueDisplay?: string;
}

export function ItemSearchCombobox({
  items,
  value,
  onChange,
  disabled = false,
  inputId,
  placeholder = "Search item name, SKU, barcode…",
  unknownValueDisplay,
}: ItemSearchComboboxProps) {
  const options = useMemo(
    () =>
      items
        .filter((it) => it.active)
        .map((it) => ({
          value: it.id,
          label: it.name,
          detail: [it.sku, it.barcode].filter(Boolean).join(" · ") || undefined,
        })),
    [items]
  );

  return (
    <SearchableSelect
      id={inputId}
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      unknownValueDisplay={unknownValueDisplay}
      controlClassName="rounded border border-slate-300 dark:border-slate-600"
      compact
    />
  );
}
