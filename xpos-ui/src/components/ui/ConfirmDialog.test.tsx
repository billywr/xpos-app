import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfirmDialog } from "./ConfirmDialog";
import { ProgressBar } from "./ProgressBar";
import { TopProgressBar } from "./TopProgressBar";
import {
  incrementNetworkActivity,
  decrementNetworkActivity,
} from "@/utils/networkActivity";

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

describe("TopProgressBar & Network Activity", () => {
  it("activates top progress bar when network activity is triggered", async () => {
    const queryClient = new QueryClient();

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <TopProgressBar />
      </QueryClientProvider>
    );

    // Initially idle (hidden)
    expect(document.querySelector("[aria-hidden='true']")).toBeNull();

    // Trigger in-flight network activity
    act(() => {
      incrementNetworkActivity();
    });

    // Progress bar should appear
    await waitFor(() => {
      expect(document.querySelector("[aria-hidden='true']")).toBeInTheDocument();
    });

    // Finish network activity
    act(() => {
      decrementNetworkActivity();
    });

    unmount();
  });
});

