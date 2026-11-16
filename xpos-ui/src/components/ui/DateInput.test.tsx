import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateInput } from "./DateInput";

describe("DateInput", () => {
  it("renders a native date input", () => {
    render(<DateInput aria-label="Test date" value="2026-06-10" readOnly />);
    const input = screen.getByLabelText("Test date");
    expect(input).toHaveAttribute("type", "date");
    expect(input).toHaveClass("date-input");
  });

  it("calls showPicker on click when supported", () => {
    const showPicker = vi.fn();
    render(<DateInput aria-label="Pick date" />);
    const input = screen.getByLabelText("Pick date") as HTMLInputElement;
    input.showPicker = showPicker;

    fireEvent.click(input);

    expect(showPicker).toHaveBeenCalledTimes(1);
  });

  it("forwards onClick after showPicker", () => {
    const onClick = vi.fn();
    render(<DateInput aria-label="Pick date" onClick={onClick} />);
    const input = screen.getByLabelText("Pick date") as HTMLInputElement;
    input.showPicker = vi.fn();

    fireEvent.click(input);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call showPicker when disabled", () => {
    const showPicker = vi.fn();
    render(<DateInput aria-label="Pick date" disabled />);
    const input = screen.getByLabelText("Pick date") as HTMLInputElement;
    input.showPicker = showPicker;

    fireEvent.click(input);

    expect(showPicker).not.toHaveBeenCalled();
  });
});
