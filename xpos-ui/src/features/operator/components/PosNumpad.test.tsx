import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PosNumpad } from "./PosNumpad";

describe("PosNumpad Component", () => {
  it("renders all digits and handles digit clicks", () => {
    const onDigit = vi.fn();
    const onClear = vi.fn();
    const onBackspace = vi.fn();

    render(
      <PosNumpad
        onDigit={onDigit}
        onClear={onClear}
        onBackspace={onBackspace}
      />
    );

    // Click 5
    const btn5 = screen.getByRole("button", { name: "5" });
    fireEvent.click(btn5);
    expect(onDigit).toHaveBeenCalledWith("5");

    // Click 00
    const btn00 = screen.getByRole("button", { name: "00" });
    fireEvent.click(btn00);
    expect(onDigit).toHaveBeenCalledWith("00");

    // Click Backspace
    const delBtn = screen.getByRole("button", { name: /backspace/i });
    fireEvent.click(delBtn);
    expect(onBackspace).toHaveBeenCalledTimes(1);

    // Click Clear
    const clearBtn = screen.getByRole("button", { name: /clear/i });
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
