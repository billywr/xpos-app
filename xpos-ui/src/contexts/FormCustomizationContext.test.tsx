import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import {
  FormCustomizationContext,
  useFormCustomization,
  type FormCustomizationContextValue,
} from "./FormCustomizationContext";
import { FORM_REGISTRY } from "@/config/formCustomizationRegistry";

describe("FormCustomizationContext & useFormCustomization", () => {
  it("provides fallback behavior when outside of FormCustomizationProvider", () => {
    const { result } = renderHook(() => useFormCustomization("expense"));

    expect(result.current.form?.id).toBe("expense");
    expect(result.current.fields.length).toBeGreaterThan(0);

    // Default label and placeholder
    expect(result.current.getFieldLabel("amount")).toBe("Amount (KSH)");
    expect(result.current.getFieldPlaceholder("amount")).toBe("0.00");
    expect(result.current.isFieldVisible("amount")).toBe(true);

    // Fallback if field doesn't exist
    expect(result.current.getFieldLabel("unknownField", "Custom Fallback")).toBe("Custom Fallback");
  });

  it("reads customized labels, placeholders, and visibility from context", () => {
    const mockContext: FormCustomizationContextValue = {
      getFormConfig: vi.fn().mockReturnValue([
        {
          key: "amount",
          label: "Custom Expense Amount",
          placeholder: "Enter KES here",
          visible: true,
          order: 2,
          required: true,
          defaultRequired: true,
          canHide: false,
          defaultLabel: "Amount (KSH)",
          defaultPlaceholder: "0.00",
          showPlaceholder: true,
        },
        {
          key: "notes",
          label: "Special Notes",
          placeholder: undefined,
          visible: false,
          order: 1,
          required: false,
          defaultRequired: false,
          canHide: true,
          defaultLabel: "Notes",
          defaultPlaceholder: "Optional details…",
          showPlaceholder: false,
        },
      ]),
      isFieldVisible: vi.fn((_formId: string, key: string) => key !== "notes"),
      isFieldRequired: vi.fn((_formId: string, key: string) => key === "amount"),
      setFieldRequired: vi.fn(),
      getFieldLabel: vi.fn((_formId: string, key: string) =>
        key === "amount" ? "Custom Expense Amount" : "Special Notes"
      ),
      getFieldPlaceholder: vi.fn((_formId: string, key: string) =>
        key === "amount" ? "Enter KES here" : undefined
      ),
      getFieldOrder: vi.fn((_formId: string, key: string) => (key === "amount" ? 2 : 1)),
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

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FormCustomizationContext.Provider value={mockContext}>
        {children}
      </FormCustomizationContext.Provider>
    );

    const { result } = renderHook(() => useFormCustomization("expense"), { wrapper });

    expect(result.current.getFieldLabel("amount")).toBe("Custom Expense Amount");
    expect(result.current.getFieldPlaceholder("amount")).toBe("Enter KES here");
    expect(result.current.isFieldVisible("notes")).toBe(false);
    expect(result.current.isFieldRequired("amount")).toBe(true);
    expect(result.current.getFieldOrder("notes")).toBe(1);
    expect(result.current.getFieldOrder("amount")).toBe(2);

    // Test calling mutators
    act(() => {
      result.current.setFieldVisibility("notes", true);
      result.current.setFieldRequired("amount", false);
      result.current.setFieldLabel("amount", "Updated Label");
      result.current.setFieldShowPlaceholder("amount", false);
      result.current.setFieldCustomPlaceholder("amount", "New placeholder");
      result.current.moveFieldOrder("amount", "up");
      result.current.resetToDefaults();
    });

    expect(mockContext.setFieldVisibility).toHaveBeenCalledWith("expense", "notes", true);
    expect(mockContext.setFieldRequired).toHaveBeenCalledWith("expense", "amount", false);
    expect(mockContext.setFieldLabel).toHaveBeenCalledWith("expense", "amount", "Updated Label");
    expect(mockContext.setFieldShowPlaceholder).toHaveBeenCalledWith("expense", "amount", false);
    expect(mockContext.setFieldCustomPlaceholder).toHaveBeenCalledWith("expense", "amount", "New placeholder");
    expect(mockContext.moveFieldOrder).toHaveBeenCalledWith("expense", "amount", "up");
    expect(mockContext.resetFormToDefaults).toHaveBeenCalledWith("expense");
  });

  it("ensures all registered forms have unique field keys and positive order", () => {
    Object.values(FORM_REGISTRY).forEach((form) => {
      const keys = form.fields.map((f) => f.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);

      form.fields.forEach((field) => {
        expect(field.defaultOrder).toBeGreaterThan(0);
        expect(field.defaultLabel).toBeTruthy();
        if (field.required) {
          expect(field.canHide).toBe(false);
        }
      });
    });
  });
});
