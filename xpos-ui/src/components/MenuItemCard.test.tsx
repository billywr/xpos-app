import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MenuItemCard } from "./MenuItemCard";

describe("MenuItemCard Component", () => {
  const defaultProps = {
    name: "Tusker Lager 500ml",
    itemId: "item-123",
    primaryImageUrl: "https://example.com/tusker.jpg",
    trackInventory: true,
    active: true,
    stockOnHand: 25,
    price: 300,
    quantityInCart: 0,
    onReduce: vi.fn(),
    onAdd: vi.fn(),
  };

  it("renders product name, price in KSH, and stock on hand with name and price on the same level", () => {
    render(<MenuItemCard {...defaultProps} />);

    const nameEl = screen.getByText("Tusker Lager 500ml");
    const priceEl = screen.getByText("Ksh 300");
    expect(nameEl).toBeInTheDocument();
    expect(priceEl).toBeInTheDocument();
    expect(screen.getByText("25 in stock")).toBeInTheDocument();

    // Verify name and price are in the same row flex container
    expect(nameEl.parentElement).toBe(priceEl.parentElement);
    expect(nameEl.parentElement?.className).toContain("justify-between");
  });

  it("triggers onAdd when clicking the card or the Add button", () => {
    const onAdd = vi.fn();
    render(<MenuItemCard {...defaultProps} onAdd={onAdd} />);

    const card = screen.getByRole("button", { name: /Tusker Lager 500ml/i });
    fireEvent.click(card);
    expect(onAdd).toHaveBeenCalledTimes(1);

    const addBtn = screen.getByRole("button", { name: /Add/i });
    fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledTimes(2);
  });

  it("renders quantity stepper when item is already in cart", () => {
    const onAdd = vi.fn();
    const onReduce = vi.fn();

    render(
      <MenuItemCard
        {...defaultProps}
        quantityInCart={3}
        onAdd={onAdd}
        onReduce={onReduce}
      />
    );

    // Quantity badge in header and stepper count
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);

    const plusBtn = screen.getByRole("button", { name: /Add more Tusker Lager 500ml/i });
    const minusBtn = screen.getByRole("button", { name: /Reduce quantity of Tusker Lager 500ml/i });

    fireEvent.click(plusBtn);
    expect(onAdd).toHaveBeenCalledTimes(1);

    fireEvent.click(minusBtn);
    expect(onReduce).toHaveBeenCalledTimes(1);
  });

  it("handles missing image or image load failure gracefully by showing placeholder image", () => {
    // 1. Missing image uses placeholder
    const { rerender } = render(<MenuItemCard {...defaultProps} primaryImageUrl={null} />);
    let img = screen.getByRole("img", { hidden: true });
    expect(img).toHaveAttribute("src", "/placeholder-product.svg");

    // 2. Broken image switches to placeholder on error
    rerender(<MenuItemCard {...defaultProps} primaryImageUrl="https://example.com/broken.jpg" />);
    img = screen.getByRole("img", { hidden: true });
    expect(img).toHaveAttribute("src", "https://example.com/broken.jpg");

    fireEvent.error(img);
    expect(img).toHaveAttribute("src", "/placeholder-product.svg");
  });

  it("disables interaction when item is out of stock", () => {
    const onAdd = vi.fn();
    render(
      <MenuItemCard
        {...defaultProps}
        stockOnHand={0}
        onAdd={onAdd}
      />
    );

    expect(screen.getByText("Out of stock")).toBeInTheDocument();
    expect(screen.getByText("Not available")).toBeInTheDocument();

    // Card should not have button role
    const card = screen.getByText("Tusker Lager 500ml").closest("div[id='pos-item-item-123']");
    if (card) {
      fireEvent.click(card);
    }
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("ensures Add button is at least 44px high for comfortable POS touch interaction", () => {
    render(<MenuItemCard {...defaultProps} />);
    const addBtn = screen.getByRole("button", { name: /Add/i });
    expect(addBtn.className).toContain("min-h-[44px]");
  });

  it("renders separated stock and cart badges without visual overlap", () => {
    render(
      <MenuItemCard
        {...defaultProps}
        stockOnHand={12}
        quantityInCart={2}
      />
    );
    expect(screen.getByText("12 in stock")).toBeInTheDocument();
    expect(screen.getByLabelText("2 in order")).toBeInTheDocument();
  });

  it("renders price with a badge background on the right side on one level with the title text", () => {
    const { rerender } = render(<MenuItemCard {...defaultProps} variant="standard" />);
    let nameEl = screen.getByText("Tusker Lager 500ml");
    let priceEl = screen.getByText("Ksh 300");
    expect(nameEl).toBeInTheDocument();
    expect(priceEl).toBeInTheDocument();
    expect(nameEl.parentElement).toBe(priceEl.parentElement);
    expect(nameEl.parentElement?.className).toContain("justify-between");
    expect(priceEl.className).toContain("bg-emerald-50");
    expect(priceEl.className).toContain("rounded-lg");

    rerender(<MenuItemCard {...defaultProps} variant="compact-stacked" />);
    nameEl = screen.getByText("Tusker Lager 500ml");
    priceEl = screen.getByText("Ksh 300");
    expect(nameEl.parentElement).toBe(priceEl.parentElement);
    expect(nameEl.parentElement?.className).toContain("justify-between");
    expect(priceEl.className).toContain("bg-emerald-50");
  });

  it("renders product image with object-contain to wrap cleanly without clipping or stretching", () => {
    const { rerender } = render(<MenuItemCard {...defaultProps} primaryImageUrl="https://example.com/orijin.jpg" />);
    let img = screen.getByRole("img", { hidden: true });
    expect(img.className).toContain("object-contain");
    expect(img.className).not.toContain("object-cover");

    // Placeholder image should use object-cover
    rerender(<MenuItemCard {...defaultProps} primaryImageUrl={null} />);
    img = screen.getByRole("img", { hidden: true });
    expect(img.className).toContain("object-cover");
    expect(img.className).not.toContain("object-contain");
  });

  it("keeps minus button active and card without opacity-60 when maximum stock is reached in cart", () => {
    const onReduce = vi.fn();
    const onAdd = vi.fn();

    render(
      <MenuItemCard
        {...defaultProps}
        stockOnHand={2}
        quantityInCart={2}
        onReduce={onReduce}
        onAdd={onAdd}
      />
    );

    // Card should NOT have opacity-60
    const card = screen.getByText("Tusker Lager 500ml").closest("div[id='pos-item-item-123']");
    expect(card?.className).not.toContain("opacity-60");

    // Minus button must be enabled and active
    const minusBtn = screen.getByRole("button", { name: /Reduce quantity of Tusker Lager 500ml/i });
    expect(minusBtn).toBeEnabled();
    expect(minusBtn.className).toContain("bg-rose-600");
    fireEvent.click(minusBtn);
    expect(onReduce).toHaveBeenCalledTimes(1);

    // Plus button should be disabled because max stock (2 of 2) is reached
    const plusBtn = screen.getByRole("button", { name: /Add more Tusker Lager 500ml/i });
    expect(plusBtn).toBeDisabled();
  });
});

