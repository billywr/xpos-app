import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastProvider, useToast } from "./ToastContext";

function TestComponent() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success("First message")}>Show First</button>
      <button onClick={() => toast.success("Second message")}>Show Second</button>
      <button onClick={() => toast.error("Error message")}>Show Error</button>
    </div>
  );
}

describe("ToastContext", () => {
  it("throws error when useToast is used outside ToastProvider", () => {
    // Suppress console.error during expected throw
    const originalError = console.error;
    console.error = () => {};
    try {
      expect(() => render(<TestComponent />)).toThrow(
        "useToast must be used within ToastProvider"
      );
    } finally {
      console.error = originalError;
    }
  });

  it("does not stack toasts and closes previous before displaying current", () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    // Trigger first toast
    fireEvent.click(screen.getByText("Show First"));
    expect(screen.getByText("First message")).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);

    // Trigger second toast
    fireEvent.click(screen.getByText("Show Second"));
    expect(screen.queryByText("First message")).not.toBeInTheDocument();
    expect(screen.getByText("Second message")).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);

    // Trigger error toast
    fireEvent.click(screen.getByText("Show Error"));
    expect(screen.queryByText("Second message")).not.toBeInTheDocument();
    expect(screen.getByText("Error message")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("allows dismissing the current toast", () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("Show First"));
    expect(screen.getByText("First message")).toBeInTheDocument();

    const dismissBtn = screen.getByRole("button", { name: /dismiss|close/i });
    fireEvent.click(dismissBtn);

    // Toast triggers exit animation
    act(() => {
      // advance timers if any or wait for exit timeout
    });
  });
});
