import { useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { fetchItemModifierGroups } from "@/api/items";
import { fetchModifierGroups, fetchModifierOptions } from "@/api/modifierGroups";
import { formatCurrency } from "@/utils/formatCurrency";
import type { Item } from "@/types/catalog";
import type { CartModifier } from "@/store/slices/cartSlice";
import { Plus, Minus, X } from "lucide-react";

interface ModifierModalProps {
  item: Item;
  unitPrice: number;
  orgId: string;
  token: string | null;
  onConfirm: (modifiers: CartModifier[]) => void;
  onClose: () => void;
}

interface GroupWithOptions {
  groupId: string;
  groupName: string;
  minSelect: number;
  maxSelect: number;
  required: boolean;
  options: { id: string; name: string; priceDelta: number }[];
}

export function ModifierModal({
  item,
  unitPrice,
  orgId,
  token,
  onConfirm,
  onClose,
}: ModifierModalProps) {
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});

  const { data: links = [], isLoading: linksLoading } = useQuery({
    queryKey: ["item-modifier-groups", orgId, item.id],
    queryFn: () => fetchItemModifierGroups(token, orgId, item.id),
    enabled: Boolean(orgId && token && item.id),
  });

  const { data: allGroupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["modifier-groups", orgId],
    queryFn: () => fetchModifierGroups(token, orgId, { size: 200 }),
    enabled: Boolean(orgId && token && links.length > 0),
  });

  const allGroups = allGroupsData?.content ?? [];
  const groupIds = links.map((l) => l.modifierGroupId);

  const optionsQueries = useQueries({
    queries: groupIds.map((gid) => ({
      queryKey: ["modifier-options", orgId, gid],
      queryFn: () => fetchModifierOptions(token, orgId, gid),
      enabled: Boolean(orgId && token && gid),
    })),
  });
  const optionsLoading = optionsQueries.some((q) => q.isLoading);
  const isLoading = linksLoading || groupsLoading || optionsLoading;

  const groupsWithOptions: GroupWithOptions[] = groupIds
    .map((gid, idx) => {
      const group = allGroups.find((g) => g.id === gid);
      if (!group) return null;
      const optsRes = optionsQueries[idx]?.data ?? [];
      const options = optsRes.map((o) => ({
        id: o.id,
        name: o.name,
        priceDelta: typeof o.priceDelta === "number" ? o.priceDelta : Number(o.priceDelta) || 0,
      }));
      return {
        groupId: group.id,
        groupName: group.name,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        required: group.required,
        options,
      };
    })
    .filter((g): g is GroupWithOptions => g !== null);

  const handleOptionQty = (optionId: string, delta: number) => {
    setSelectedQty((prev) => {
      const current = prev[optionId] ?? 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[optionId];
        return copy;
      }
      return { ...prev, [optionId]: next };
    });
  };

  const getTotalWithModifiers = () => {
    let total = unitPrice;
    for (const g of groupsWithOptions) {
      for (const opt of g.options) {
        const qty = selectedQty[opt.id] ?? 0;
        total += opt.priceDelta * qty;
      }
    }
    return total;
  };

  const isValid = () => {
    for (const g of groupsWithOptions) {
      const selected = g.options.reduce((s, o) => s + (selectedQty[o.id] ?? 0), 0);
      if (g.required && selected < g.minSelect) return false;
      if (selected > g.maxSelect) return false;
    }
    return true;
  };

  const handleAddToCart = () => {
    const modifiers: CartModifier[] = [];
    for (const g of groupsWithOptions) {
      for (const opt of g.options) {
        const qty = selectedQty[opt.id] ?? 0;
        if (qty > 0) {
          modifiers.push({
            modifierOptionId: opt.id,
            modifierOptionName: opt.name,
            qty,
            unitPriceDelta: opt.priceDelta,
          });
        }
      }
    }
    onConfirm(modifiers);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modifier-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <h2
            id="modifier-modal-title"
            className="text-lg font-semibold text-slate-900 dark:text-white"
          >
            {item.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600 dark:hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex min-h-[120px] items-center justify-center text-slate-500 dark:text-slate-400">
              Loading options…
            </div>
          ) : (
          groupsWithOptions.map((g) => (
            <div
              key={g.groupId}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700/30"
            >
              <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                {g.groupName}
                {g.required && (
                  <span className="ml-1 text-amber-600 dark:text-amber-400">*</span>
                )}
                {g.minSelect > 0 && (
                  <span className="ml-1 text-xs text-slate-500">
                    (min {g.minSelect}, max {g.maxSelect})
                  </span>
                )}
              </h3>
              <div className="space-y-2">
                {g.options.map((opt) => {
                  const qty = selectedQty[opt.id] ?? 0;
                  return (
                    <div
                      key={opt.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-700"
                    >
                      <div>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {opt.name}
                        </span>
                        {opt.priceDelta !== 0 && (
                          <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                            {opt.priceDelta > 0 ? "+" : ""}
                            {formatCurrency(opt.priceDelta)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOptionQty(opt.id, -1)}
                          disabled={qty <= 0}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-[2rem] text-center font-medium tabular-nums">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOptionQty(opt.id, 1)}
                          disabled={qty >= g.maxSelect}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-600"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
          )}
          <div className="rounded-xl bg-primary-50 p-4 dark:bg-primary-900/20">
            <div className="flex justify-between font-semibold text-slate-900 dark:text-white">
              <span>Total</span>
              <span>{formatCurrency(getTotalWithModifiers())}</span>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 p-4 dark:border-slate-600">
          <button
            type="button"
            disabled={!isValid()}
            onClick={handleAddToCart}
            className="min-h-[48px] w-full rounded-xl bg-primary-600 py-3 text-lg font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}
