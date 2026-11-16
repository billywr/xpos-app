import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlideOver } from "./SlideOver";

describe("SlideOver", () => {
  it("renders when open with default ~50% width classes", () => {
    render(
      <SlideOver open={true} onClose={vi.fn()} title="Test Sheet">
        <p>Sheet Content</p>
      </SlideOver>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Sheet")).toBeInTheDocument();
    expect(screen.getByText("Sheet Content")).toBeInTheDocument();

    const panel = screen.getByRole("dialog").querySelector(".fixed.inset-y-0.right-0");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveClass("md:w-1/2");
    expect(panel).toHaveClass("md:max-w-[50vw]");
    expect(panel).toHaveClass("md:min-w-[480px]");
  });

  it("does not render when closed", () => {
    const { container } = render(
      <SlideOver open={false} onClose={vi.fn()} title="Test Sheet">
        <p>Sheet Content</p>
      </SlideOver>
    );

    expect(container.firstChild).toBeNull();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <SlideOver open={true} onClose={onClose} title="Test Sheet">
        <p>Sheet Content</p>
      </SlideOver>
    );

    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <SlideOver open={true} onClose={onClose} title="Test Sheet">
        <p>Sheet Content</p>
      </SlideOver>
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("allows overriding maxWidth if explicitly provided", () => {
    render(
      <SlideOver
        open={true}
        onClose={vi.fn()}
        title="Custom Sheet"
        maxWidth="max-w-4xl"
      >
        <p>Custom Width Content</p>
      </SlideOver>
    );

    const panel = screen.getByRole("dialog").querySelector(".fixed.inset-y-0.right-0");
    expect(panel).toHaveClass("max-w-4xl");
    expect(panel).not.toHaveClass("md:w-1/2");
  });

  it("renders headerAction when provided", () => {
    render(
      <SlideOver
        open={true}
        onClose={vi.fn()}
        title="Sheet with Action"
        headerAction={<button type="button">Extra Action</button>}
      >
        <p>Content</p>
      </SlideOver>
    );

    expect(screen.getByText("Extra Action")).toBeInTheDocument();
  });
});
