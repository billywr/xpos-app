import React from "react";
import {
  LayoutGrid,
  Beer,
  Wine,
  Coffee,
  GlassWater,
  Flame,
  Sparkles,
  CupSoda,
  UtensilsCrossed,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { CountBadge } from "@/components/ui";
import type { Category } from "@/types/catalog";
import { cn } from "@/utils/cn";

interface PosVerticalCategoryNavProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  getCategoryCount: (categoryId: string | null) => number;
  totalVisibleCount: number;
  isLoading?: boolean;
  showCardContainer?: boolean;
  className?: string;
}

/**
 * Maps category names to prominent, recognizable icons.
 */
export function getCategoryIconComponent(name: string): LucideIcon {
  const n = name.toLowerCase().trim();
  if (n === "all" || n === "everything") return LayoutGrid;
  if (
    n.includes("beer") ||
    n.includes("lager") ||
    n.includes("ale") ||
    n.includes("cider") ||
    n.includes("draught")
  ) {
    return Beer;
  }
  if (
    n.includes("wine") ||
    n.includes("champagne") ||
    n.includes("prosecco")
  ) {
    return Wine;
  }
  if (
    n.includes("coffee") ||
    n.includes("tea") ||
    n.includes("beverage") ||
    n.includes("drink") ||
    n.includes("soft drink") ||
    n.includes("soda") ||
    n.includes("juice") ||
    n.includes("water")
  ) {
    return Coffee;
  }
  if (n.includes("vodka")) return GlassWater;
  if (n.includes("whiskey") || n.includes("whisky") || n.includes("bourbon") || n.includes("scotch")) {
    return Flame;
  }
  if (n.includes("tequila")) return Sparkles;
  if (n.includes("liqueur") || n.includes("cocktail")) return CupSoda;
  if (
    n.includes("spirit") ||
    n.includes("gin") ||
    n.includes("rum") ||
    n.includes("brandy") ||
    n.includes("liquor") ||
    n.includes("cognac")
  ) {
    return Wine;
  }
  if (
    n.includes("food") ||
    n.includes("meal") ||
    n.includes("snack") ||
    n.includes("kitchen") ||
    n.includes("dish") ||
    n.includes("meat") ||
    n.includes("platter")
  ) {
    return UtensilsCrossed;
  }
  return Tag;
}

/**
 * Dedicated touch-friendly vertical category navigation panel with distinct outlines,
 * large icons, bold readability, and compact count badges.
 */
export const PosVerticalCategoryNav: React.FC<PosVerticalCategoryNavProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  getCategoryCount,
  totalVisibleCount,
  isLoading = false,
  showCardContainer = true,
  className,
}) => {
  const isAllSelected = selectedCategoryId === null;

  return (
    <nav
      aria-label="Product categories"
      className={cn(
        "flex h-full max-h-[calc(100%-6.375rem)] sm:max-h-[calc(100%-6.75rem)] mt-[6.375rem] sm:mt-[6.75rem] min-h-0 w-44 sm:w-48 lg:w-52 xl:w-56 shrink-0 flex-col transition-all duration-150",
        showCardContainer
          ? "rounded-2xl border border-slate-200 bg-white p-2 sm:p-2.5 shadow-xs dark:border-slate-700/80 dark:bg-slate-800/90"
          : "border-transparent bg-transparent p-0 shadow-none",
        className
      )}
    >
      {/* Category Heading (Sticky) */}
      {showCardContainer && (
        <div className="shrink-0 pb-2 px-1">
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
            Categories
          </h2>
        </div>
      )}

      {/* Scrollable Category List with Independent Scrolling */}
      <div className="min-h-0 overflow-y-auto space-y-2.5 sm:space-y-3 pr-0.5 scrollbar-thin">
        {/* 'All' Category Item */}
        <button
          type="button"
          onClick={() => onSelectCategory(null)}
          className={`flex min-h-[48px] sm:min-h-[52px] w-full touch-manipulation items-center justify-between gap-2 rounded-xl border px-2 sm:px-2.5 py-1.5 sm:py-2 text-left transition select-none ${
            isAllSelected
              ? "border-amber-400 bg-amber-500 text-slate-950 font-black shadow-xs ring-1 ring-amber-400/50"
              : "border-slate-200 bg-slate-100 text-slate-800 shadow-2xs hover:border-slate-300 hover:bg-slate-200 active:scale-[0.98] dark:border-slate-700/70 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/60"
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <LayoutGrid
              className={`h-6 w-6 shrink-0 stroke-[2.3] ${
                isAllSelected
                  ? "text-slate-950"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            />
            <span className="truncate text-lg sm:text-xl font-extrabold tracking-tight">All</span>
          </div>
          <CountBadge
            count={totalVisibleCount}
            variant={isAllSelected ? "primary" : "neutral"}
            active={isAllSelected}
            size="lg"
            className="font-black"
          />
        </button>

        {/* Dynamic Category Items */}
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-[48px] sm:h-[52px] w-full animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700/60 dark:bg-slate-700/40"
              />
            ))
          : categories
              .filter((cat) => getCategoryCount(cat.id) > 0)
              .map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              const IconComponent = getCategoryIconComponent(cat.name);
              const count = getCategoryCount(cat.id);

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCategory(cat.id)}
                  className={`flex min-h-[48px] sm:min-h-[52px] w-full touch-manipulation items-center justify-between gap-2 rounded-xl border px-2 sm:px-2.5 py-1.5 sm:py-2 text-left transition select-none ${
                    isSelected
                      ? "border-amber-400 bg-amber-500 text-slate-950 font-black shadow-xs ring-1 ring-amber-400/50"
                      : "border-slate-200 bg-slate-100 text-slate-800 shadow-2xs hover:border-slate-300 hover:bg-slate-200 active:scale-[0.98] dark:border-slate-700/70 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700/60"
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                    <IconComponent
                      className={`h-6 w-6 shrink-0 stroke-[2.3] ${
                        isSelected
                          ? "text-slate-950"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    />
                    <span className="truncate text-lg sm:text-xl font-extrabold tracking-tight">
                      {cat.name}
                    </span>
                  </div>
                  <CountBadge
                    count={count}
                    variant={isSelected ? "primary" : "neutral"}
                    active={isSelected}
                    size="lg"
                    className="font-black"
                  />
                </button>
              );
            })}
      </div>
    </nav>
  );
};
