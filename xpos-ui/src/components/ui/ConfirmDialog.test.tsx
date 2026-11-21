import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";
import { ProgressBar } from "./ProgressBar";

describe("ConfirmDialog", () => {
  it("renders title, message, and action buttons when open", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="Reconcile inventory to closings?"
        message="POS on-hand will be updated."
        confirmLabel="Reconcile"
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    expect(screen.getByText("Reconcile inventory to closings?")).toBeInTheDocument();
    expect(screen.getByText("POS on-hand will be updated.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconcile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reconcile" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows progress bar and Processing button state when loading is true", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Reconcile inventory to closings?"
        message="POS on-hand will be updated."
        confirmLabel="Reconcile"
        loading={true}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // Progress bar label displayed in dialog body
    expect(screen.getByText("Processing request…")).toBeInTheDocument();
    expect(screen.getByText("Please wait")).toBeInTheDocument();

    // Confirm button displays Processing with spinner instead of "…"
    const confirmBtn = screen.getByRole("button", { name: /processing/i });
    expect(confirmBtn).toBeInTheDocument();
    expect(confirmBtn).toBeDisabled();

    // Cancel button is also disabled while loading
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    expect(cancelBtn).toBeDisabled();
  });

  it("updates elapsed time in progress bar sublabel when loading persists", () => {
    vi.useFakeTimers();
    render(
      <ConfirmDialog
        open={true}
        title="Delete selected items?"
        message="Are you sure you want to delete 1 selected stock item?"
        confirmLabel="Delete item"
        loading={true}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Please wait")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("Please wait (5s)")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(screen.getByText("Please wait (1m 5s)")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("renders with custom icon and side-by-side buttons in footer", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel="Log out"
        cancelLabel="Cancel"
        variant="danger"
        icon={<span data-testid="custom-icon">LOGOUT</span>}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    expect(screen.getByText("Log out?")).toBeInTheDocument();
    expect(screen.getByText("Are you sure you want to log out?")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button");
    // Action button first, Cancel button second
    expect(buttons[0]).toHaveTextContent("Log out");
    expect(buttons[1]).toHaveTextContent("Cancel");
  });
});

describe("ProgressBar", () => {
  it("renders determinate progress percentage", () => {
    render(<ProgressBar value={65} label="Uploading" sublabel="65%" />);

    expect(screen.getByText("Uploading")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "65");
  });

  it("renders indeterminate progress without valuenow", () => {
    render(<ProgressBar indeterminate={true} label="Processing" />);

    expect(screen.getByText("Processing")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar).not.toHaveAttribute("aria-valuenow");
  });
});

