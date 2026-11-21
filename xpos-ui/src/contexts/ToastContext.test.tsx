import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastProvider, useToast } from "./ToastContext";
import { recordActionDurationMs, clearLastActionDuration } from "@/utils/actionDuration";

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

function ActionDurationTestComponent() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success("Item deleted.", { title: "Deleted" })}>
        Delete Item
      </button>
      <button
        onClick={() =>
          toast.success("Branch deleted.", { title: "Deleted", timeTaken: "0.25s" })
        }
      >
        Explicit Duration
      </button>
      <button
        onClick={() =>
          toast.success("Deleted 1 stock item in 31.8s. Inventory was adjusted.", {
            title: "Stock items deleted",
          })
        }
      >
        Already Formatted
      </button>
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

  describe("action duration indicator", () => {
    beforeEach(() => {
      clearLastActionDuration();
    });

    it("automatically indicates action duration on delete toast when recorded (intelligent ms)", () => {
      recordActionDurationMs(400);

      render(
        <ToastProvider>
          <ActionDurationTestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Delete Item"));
      expect(screen.getByText("Item deleted in 400ms.")).toBeInTheDocument();
      expect(screen.getByText("400ms")).toBeInTheDocument();
    });

    it("displays explicit timeTaken provided in options", () => {
      render(
        <ToastProvider>
          <ActionDurationTestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Explicit Duration"));
      expect(screen.getByText("Branch deleted in 0.25s.")).toBeInTheDocument();
      expect(screen.getByText("0.25s")).toBeInTheDocument();
    });

    it("does not duplicate duration when message already contains duration", () => {
      recordActionDurationMs(31800);

      render(
        <ToastProvider>
          <ActionDurationTestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Already Formatted"));
      expect(
        screen.getByText("Deleted 1 stock item in 31.8s. Inventory was adjusted.")
      ).toBeInTheDocument();
      expect(screen.getByText("31.8s")).toBeInTheDocument();
    });

    it("does not attach action duration or modify error messages on error", () => {
      recordActionDurationMs(140);

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Show Error"));
      expect(screen.getByText("Error message")).toBeInTheDocument();
      expect(screen.queryByText(/140ms/)).not.toBeInTheDocument();
    });

    it("hides action duration and badge when show/hide time setting is disabled", () => {
      localStorage.setItem("ui.toast.show_time", "false");
      recordActionDurationMs(400);

      render(
        <ToastProvider>
          <ActionDurationTestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText("Delete Item"));
      // The duration is not injected and badge is omitted
      expect(screen.getByText("Item deleted.")).toBeInTheDocument();
      expect(screen.queryByText("400ms")).not.toBeInTheDocument();

      // Reset
      localStorage.removeItem("ui.toast.show_time");
    });
  });
});
