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
}

export function ItemSearchCombobox({
  items,
  value,
  onChange,
  disabled = false,
  inputId,
}: ItemSearchComboboxProps) {
  const options = useMemo(
    () =>
      items.map((it) => ({
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
      placeholder="Search item name, SKU, barcode…"
      controlClassName="rounded border border-slate-300 dark:border-slate-600"
      compact
    />
  );
}
