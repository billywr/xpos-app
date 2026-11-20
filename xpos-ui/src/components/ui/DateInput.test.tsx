import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateInput } from "./DateInput";
import { setupGlobalDatePicker } from "@/utils/setupGlobalDatePicker";

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

  it("does not call showPicker when readOnly", () => {
    const showPicker = vi.fn();
    render(<DateInput aria-label="Pick date" readOnly />);
    const input = screen.getByLabelText("Pick date") as HTMLInputElement;
    input.showPicker = showPicker;

    fireEvent.click(input);

    expect(showPicker).not.toHaveBeenCalled();
  });

  it("blurs input to close calendar popup upon change", () => {
    const onChange = vi.fn();
    render(<DateInput aria-label="Pick date" onChange={onChange} />);
    const input = screen.getByLabelText("Pick date") as HTMLInputElement;
    const blurSpy = vi.spyOn(input, "blur");

    fireEvent.change(input, { target: { value: "2026-11-20" } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(blurSpy).toHaveBeenCalledTimes(1);
  });

  it("displays dd/mm/yyyy formatted text when value is provided", () => {
    const { container } = render(
      <DateInput aria-label="Selected date" value="2026-12-17" readOnly />
    );
    expect(container).toHaveTextContent("17/12/2026");
  });

  it("displays placeholder dd/mm/yyyy when value is empty", () => {
    const { container } = render(<DateInput aria-label="Empty date" />);
    expect(container).toHaveTextContent("dd/mm/yyyy");
  });

  it("opens react-datepicker on trigger click and emits onChange on selection", () => {
    const onChange = vi.fn();
    const { container } = render(
      <DateInput aria-label="Order date" value="2026-11-15" onChange={onChange} />
    );
    const trigger = container.querySelector(".cursor-pointer");
    expect(trigger).toBeTruthy();
    fireEvent.click(trigger!);

    const popper = document.querySelector(".react-datepicker");
    expect(popper).toBeTruthy();

    const day = document.querySelector(".react-datepicker__day--020") as HTMLElement;
    if (day) {
      fireEvent.click(day);
      expect(onChange).toHaveBeenCalled();
      const calledEvent = onChange.mock.calls[0][0];
      expect(calledEvent.target.value).toBe("2026-11-20");
    }
  });
});

describe("setupGlobalDatePicker", () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = setupGlobalDatePicker();
  });

  afterEach(() => {
    cleanup?.();
  });

  it("triggers showPicker on raw input[type=date] on click", () => {
    const { container } = render(
      <input type="date" aria-label="Raw date" />
    );
    const input = container.querySelector("input") as HTMLInputElement;
    const showPicker = vi.fn();
    input.showPicker = showPicker;

    fireEvent.click(input);

    expect(showPicker).toHaveBeenCalledTimes(1);
  });

  it("blurs raw input[type=date] on change to close calendar", () => {
    const { container } = render(
      <input type="date" aria-label="Raw date" />
    );
    const input = container.querySelector("input") as HTMLInputElement;
    const blurSpy = vi.spyOn(input, "blur");

    fireEvent.change(input, { target: { value: "2026-11-25" } });

    expect(blurSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores non-date inputs", () => {
    const { container } = render(<input type="text" aria-label="Text input" />);
    const input = container.querySelector("input") as HTMLInputElement;
    const showPicker = vi.fn();
    input.showPicker = showPicker;

    fireEvent.click(input);

    expect(showPicker).not.toHaveBeenCalled();
  });
});

