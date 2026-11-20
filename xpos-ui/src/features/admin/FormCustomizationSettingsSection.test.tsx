import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  FormCustomizationContext,
  type FormCustomizationContextValue,
} from "@/contexts/FormCustomizationContext";
import { FormCustomizationSettingsSection } from "./FormCustomizationSettingsSection";

describe("FormCustomizationSettingsSection", () => {
  let mockContext: FormCustomizationContextValue;

  beforeEach(() => {
    mockContext = {
      getFormConfig: vi.fn((_formId: string) => [
        {
          key: "amount",
          label: "Amount (KSH)",
          placeholder: "0.00",
          visible: true,
          order: 1,
          required: true,
          defaultRequired: true,
          canHide: false,
          defaultLabel: "Amount (KSH)",
          defaultPlaceholder: "0.00",
          showPlaceholder: true,
        },
        {
          key: "notes",
          label: "Notes",
          placeholder: "Optional details…",
          visible: true,
          order: 2,
          required: false,
          defaultRequired: false,
          canHide: true,
          defaultLabel: "Notes",
          defaultPlaceholder: "Optional details…",
          showPlaceholder: true,
        },
      ]),
      isFieldVisible: vi.fn(() => true),
      isFieldRequired: vi.fn((_f, key) => key === "amount"),
      setFieldRequired: vi.fn(),
      getFieldLabel: vi.fn((_f, key) => (key === "amount" ? "Amount (KSH)" : "Notes")),
      getFieldPlaceholder: vi.fn((_f, key) => (key === "amount" ? "0.00" : "Optional details…")),
      getFieldOrder: vi.fn((_f, key) => (key === "amount" ? 1 : 2)),
      setFieldVisibility: vi.fn(),
      setFieldLabel: vi.fn(),
      setFieldShowPlaceholder: vi.fn(),
      setFieldCustomPlaceholder: vi.fn(),
      moveFieldOrder: vi.fn(),
      setFormOrder: vi.fn(),
      resetFormToDefaults: vi.fn(),
      resetAllFormsToDefaults: vi.fn(),
      isSaving: false,
    };
  });

  function renderSection() {
    return render(
      <FormCustomizationContext.Provider value={mockContext}>
        <FormCustomizationSettingsSection />
      </FormCustomizationContext.Provider>
    );
  }

  it("renders section title and category selector", () => {
    renderSection();

    expect(screen.getByText("Form & Sheet Customization")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All forms" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Operations" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Catalog" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Directory" })).toBeInTheDocument();
  });

  it("displays form pill tabs and allows selecting a different form", () => {
    renderSection();

    // Default form is Miscellaneous Expenses
    expect(screen.getByRole("button", { name: /miscellaneous expenses/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /customer debts/i })).toBeInTheDocument();

    // Click on Customer Debts
    fireEvent.click(screen.getByRole("button", { name: /customer debts/i }));
    expect(mockContext.getFormConfig).toHaveBeenCalledWith("customer-debt");
  });

  it("renders field configuration cards and triggers label edit", () => {
    renderSection();

    const amountInput = screen.getByPlaceholderText("Amount (KSH)");
    expect(amountInput).toBeInTheDocument();

    // Edit the label of the amount field
    fireEvent.change(amountInput, { target: { value: "Total Expense (KES)" } });
    expect(mockContext.setFieldLabel).toHaveBeenCalledWith(
      "expense",
      "amount",
      "Total Expense (KES)"
    );
  });

  it("toggles field visibility and required status", () => {
    renderSection();

    // Toggle required status for Amount (KSH)
    const toggleReqBtn = screen.getByRole("button", {
      name: "Toggle requirement for Amount (KSH)",
    });
    expect(toggleReqBtn).toBeInTheDocument();
    fireEvent.click(toggleReqBtn);
    expect(mockContext.setFieldRequired).toHaveBeenCalledWith("expense", "amount", false);

    // Notes visibility toggle button
    const hideNotesBtn = screen.getByRole("button", { name: "Hide Notes" });
    expect(hideNotesBtn).toBeInTheDocument();

    fireEvent.click(hideNotesBtn);
    expect(mockContext.setFieldVisibility).toHaveBeenCalledWith("expense", "notes", false);
  });

  it("toggles placeholder enabled state and custom placeholder input", () => {
    const { container } = renderSection();

    // Check placeholder toggle checkbox
    const placeholderToggle = container.querySelector<HTMLInputElement>(
      "#placeholder-toggle-amount"
    );
    expect(placeholderToggle).not.toBeNull();
    fireEvent.click(placeholderToggle!);
    expect(mockContext.setFieldShowPlaceholder).toHaveBeenCalledWith("expense", "amount", false);

    // Edit custom placeholder text
    const placeholderInputs = screen.getAllByPlaceholderText("0.00");
    fireEvent.change(placeholderInputs[0], { target: { value: "Enter amount in KES" } });
    expect(mockContext.setFieldCustomPlaceholder).toHaveBeenCalledWith(
      "expense",
      "amount",
      "Enter amount in KES"
    );
  });

  it("moves field order down", () => {
    renderSection();

    const moveDownBtn = screen.getByRole("button", { name: "Move Amount (KSH) down" });
    fireEvent.click(moveDownBtn);
    expect(mockContext.moveFieldOrder).toHaveBeenCalledWith("expense", "amount", "down");
  });

  it("filters fields using the search box", () => {
    renderSection();

    const searchInput = screen.getByPlaceholderText("Search fields…");
    fireEvent.change(searchInput, { target: { value: "Notes" } });

    // Should only show Notes card in the editor list
    expect(screen.getByText("(notes)")).toBeInTheDocument();
    expect(screen.queryByText("(amount)")).not.toBeInTheDocument();
  });

  it("opens reset confirmation dialogs", () => {
    renderSection();

    // Reset this form button
    const resetThisFormBtn = screen.getByRole("button", { name: /reset this form/i });
    fireEvent.click(resetThisFormBtn);
    expect(screen.getByText(/Reset Miscellaneous Expenses\?/i)).toBeInTheDocument();

    // Reset all forms button
    const resetAllBtn = screen.getByRole("button", { name: /reset all forms/i });
    fireEvent.click(resetAllBtn);
    expect(screen.getByText(/Reset all forms to system defaults\?/i)).toBeInTheDocument();
  });
});
