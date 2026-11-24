import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  PosVerticalCategoryNav,
  getCategoryIconComponent,
} from "./PosVerticalCategoryNav";
import { Beer, Wine, Coffee, GlassWater, Flame, LayoutGrid, Tag } from "lucide-react";
import type { Category } from "@/types/catalog";

const mockCategories: Category[] = [
  { id: "cat-1", orgId: "org-1", parentId: null, name: "Spirits", type: "GENERAL", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "cat-2", orgId: "org-1", parentId: null, name: "Beer", type: "GENERAL", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "cat-3", orgId: "org-1", parentId: null, name: "Beverages", type: "GENERAL", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "cat-4", orgId: "org-1", parentId: null, name: "Wine", type: "GENERAL", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "cat-5", orgId: "org-1", parentId: null, name: "Vodka", type: "GENERAL", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
];

describe("PosVerticalCategoryNav Component", () => {
  it("maps category names to appropriate Lucide icons", () => {
    expect(getCategoryIconComponent("All")).toBe(LayoutGrid);
    expect(getCategoryIconComponent("Beer")).toBe(Beer);
    expect(getCategoryIconComponent("Wine")).toBe(Wine);
    expect(getCategoryIconComponent("Coffee & Beverages")).toBe(Coffee);
    expect(getCategoryIconComponent("Vodka")).toBe(GlassWater);
    expect(getCategoryIconComponent("Whiskey")).toBe(Flame);
    expect(getCategoryIconComponent("Unknown Miscellaneous")).toBe(Tag);
  });

  it("renders categories header, all option, dynamic categories, and count badges", () => {
    const onSelect = vi.fn();
    const countMap: Record<string, number> = {
      "cat-1": 36,
      "cat-2": 11,
      "cat-3": 8,
      "cat-4": 1,
      "cat-5": 8,
    };

    render(
      <PosVerticalCategoryNav
        categories={mockCategories}
        selectedCategoryId="cat-1"
        onSelectCategory={onSelect}
        getCategoryCount={(id) => (id ? countMap[id] ?? 0 : 64)}
        totalVisibleCount={64}
      />
    );

    // Sticky header
    expect(screen.getByRole("heading", { name: "Categories" })).toBeInTheDocument();

    // All button
    expect(screen.getByRole("button", { name: /all/i })).toBeInTheDocument();
    expect(screen.getByText("64")).toBeInTheDocument();

    // Spirits active (amber styling)
    const spiritsBtn = screen.getByRole("button", { name: /spirits/i });
    expect(spiritsBtn).toHaveClass("bg-amber-500");
    expect(screen.getByText("36")).toBeInTheDocument();

    // Beer inactive
    const beerBtn = screen.getByRole("button", { name: /beer/i });
    expect(beerBtn).not.toHaveClass("bg-amber-500");
    expect(screen.getByText("11")).toBeInTheDocument();

    // Click Beer
    fireEvent.click(beerBtn);
    expect(onSelect).toHaveBeenCalledWith("cat-2");

    // Click All
    const allBtn = screen.getByRole("button", { name: /all/i });
    fireEvent.click(allBtn);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("renders loading skeletons when isLoading is true", () => {
    render(
      <PosVerticalCategoryNav
        categories={[]}
        selectedCategoryId={null}
        onSelectCategory={vi.fn()}
        getCategoryCount={() => 0}
        totalVisibleCount={0}
        isLoading={true}
      />
    );

    // In loading state, All button exists plus pulse skeletons
    expect(screen.getByRole("button", { name: /all/i })).toBeInTheDocument();
  });

  it("removes outer card styling and 'Categories' title when showCardContainer is false", () => {
    render(
      <PosVerticalCategoryNav
        categories={mockCategories}
        selectedCategoryId={null}
        onSelectCategory={vi.fn()}
        getCategoryCount={() => 10}
        totalVisibleCount={50}
        showCardContainer={false}
      />
    );

    // Title 'Categories' should NOT be in the document
    expect(screen.queryByRole("heading", { name: "Categories" })).not.toBeInTheDocument();

    // Nav container should have transparent background and border
    const nav = screen.getByRole("navigation", { name: "Product categories" });
    expect(nav).toHaveClass("bg-transparent");
    expect(nav).toHaveClass("border-transparent");
    expect(nav).not.toHaveClass("border-slate-200");

    // Menu buttons still render and work
    expect(screen.getByRole("button", { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /spirits/i })).toBeInTheDocument();
  });

  it("applies shifted top margin so first menu starts where second menu was previously located", () => {
    render(
      <PosVerticalCategoryNav
        categories={mockCategories}
        selectedCategoryId={null}
        onSelectCategory={vi.fn()}
        getCategoryCount={() => 10}
        totalVisibleCount={50}
      />
    );

    const nav = screen.getByRole("navigation", { name: "Product categories" });
    expect(nav).toHaveClass("mt-[6.375rem]");
    expect(nav).toHaveClass("sm:mt-[6.75rem]");
  });
});
