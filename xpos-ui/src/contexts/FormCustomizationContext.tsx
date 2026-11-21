import { createContext, useContext, useMemo } from "react";
import {
  FORM_REGISTRY,
  type FormDefinition,
} from "@/config/formCustomizationRegistry";

export interface ResolvedFormField {
  key: string;
  label: string;
  placeholder?: string;
  visible: boolean;
  order: number;
  required: boolean;
  defaultRequired: boolean;
  canHide: boolean;
  defaultLabel: string;
  defaultPlaceholder?: string;
  customLabel?: string;
  customPlaceholder?: string;
  showPlaceholder: boolean;
  colSpan?: string;
  isLone?: boolean;
}

/**
 * Computes dynamic 2-column grid placement:
 * If a field is alone on its row (e.g. 5 fields visible, or 1 field only, or lone before notes),
 * it expands to take the whole width (col-span-1 sm:col-span-2).
 */
export function computeFieldLayout(
  fields: { key: string; order: number; visible: boolean }[]
): Record<string, { colSpan: string; isLone: boolean }> {
  const visible = fields
    .filter((f) => f.visible)
    .sort((a, b) => a.order - b.order);
  const result: Record<string, { colSpan: string; isLone: boolean }> = {};

  for (const f of fields) {
    result[f.key] = { colSpan: "", isLone: false };
  }

  const isInherentlyFullWidth = (key: string) =>
    key === "notes" || key === "address" || key === "borrowedItems";

  let colInRow = 0; // 0 = left column, 1 = right column

  for (let i = 0; i < visible.length; i++) {
    const f = visible[i];
    const isFullWidth = isInherentlyFullWidth(f.key);

    if (isFullWidth) {
      if (colInRow === 1 && i > 0) {
        result[visible[i - 1].key] = {
          colSpan: "col-span-1 sm:col-span-2",
          isLone: true,
        };
      }
      result[f.key] = {
        colSpan: "col-span-1 sm:col-span-2",
        isLone: true,
      };
      colInRow = 0;
    } else {
      const isLast = i === visible.length - 1;
      const nextIsFullWidth =
        i < visible.length - 1 && isInherentlyFullWidth(visible[i + 1].key);

      if (colInRow === 0 && (isLast || nextIsFullWidth)) {
        result[f.key] = {
          colSpan: "col-span-1 sm:col-span-2",
          isLone: true,
        };
        colInRow = 0;
      } else if (colInRow === 0) {
        result[f.key] = {
          colSpan: "",
          isLone: false,
        };
        colInRow = 1;
      } else {
        result[f.key] = {
          colSpan: "",
          isLone: false,
        };
        colInRow = 0;
      }
    }
  }

  return result;
}

export interface FormCustomizationContextValue {
  getFormConfig: (formId: string) => ResolvedFormField[];
  isFieldVisible: (formId: string, fieldKey: string) => boolean;
  isFieldRequired: (
    formId: string,
    fieldKey: string,
    fallback?: boolean
  ) => boolean;
  getFieldLabel: (formId: string, fieldKey: string, fallback?: string) => string;
  getFieldPlaceholder: (
    formId: string,
    fieldKey: string,
    fallback?: string
  ) => string | undefined;
  getFieldOrder: (formId: string, fieldKey: string) => number;
  getFieldColSpan: (
    formId: string,
    fieldKey: string,
    activeKeys?: string[]
  ) => string;
  isFieldLone: (
    formId: string,
    fieldKey: string,
    activeKeys?: string[]
  ) => boolean;
  setFieldVisibility: (
    formId: string,
    fieldKey: string,
    visible: boolean
  ) => void;
  setFieldRequired: (
    formId: string,
    fieldKey: string,
    required: boolean
  ) => void;
  setFieldLabel: (
    formId: string,
    fieldKey: string,
    label: string,
    immediate?: boolean
  ) => void;
  setFieldShowPlaceholder: (
    formId: string,
    fieldKey: string,
    show: boolean
  ) => void;
  setFieldCustomPlaceholder: (
    formId: string,
    fieldKey: string,
    placeholder: string,
    immediate?: boolean
  ) => void;
  moveFieldOrder: (
    formId: string,
    fieldKey: string,
    direction: "up" | "down"
  ) => void;
  setFormOrder: (formId: string, orderedKeys: string[]) => void;
  resetFormToDefaults: (formId: string) => void;
  resetAllFormsToDefaults: () => void;
  isSaving: boolean;
}

export const FormCustomizationContext =
  createContext<FormCustomizationContextValue | null>(null);

const fallbackContextValue: FormCustomizationContextValue = {
  getFormConfig: (formId: string): ResolvedFormField[] => {
    const formDef = FORM_REGISTRY[formId];
    if (!formDef) return [];
    const raw = formDef.fields.map(
      (f): ResolvedFormField => ({
        key: f.key,
        label: f.defaultLabel,
        placeholder: f.defaultPlaceholder,
        visible: true,
        order: f.defaultOrder,
        required: Boolean(f.required),
        defaultRequired: Boolean(f.required),
        canHide: true,
        defaultLabel: f.defaultLabel,
        defaultPlaceholder: f.defaultPlaceholder,
        showPlaceholder: true,
      })
    );
    const layout = computeFieldLayout(raw);
    return raw
      .map((f) => ({
        ...f,
        colSpan: layout[f.key]?.colSpan ?? "",
        isLone: layout[f.key]?.isLone ?? false,
      }))
      .sort((a, b) => a.order - b.order);
  },
  isFieldVisible: () => true,
  isFieldRequired: (formId, fieldKey, fallback) => {
    const formDef = FORM_REGISTRY[formId];
    const def = formDef?.fields.find((f) => f.key === fieldKey);
    return fallback !== undefined ? fallback : Boolean(def?.required);
  },
  getFieldLabel: (formId, fieldKey, fallback) => {
    const formDef = FORM_REGISTRY[formId];
    const def = formDef?.fields.find((f) => f.key === fieldKey);
    return fallback || def?.defaultLabel || fieldKey;
  },
  getFieldPlaceholder: (formId, fieldKey, fallback) => {
    const formDef = FORM_REGISTRY[formId];
    const def = formDef?.fields.find((f) => f.key === fieldKey);
    return fallback !== undefined ? fallback : def?.defaultPlaceholder;
  },
  getFieldOrder: (formId, fieldKey) => {
    const formDef = FORM_REGISTRY[formId];
    const def = formDef?.fields.find((f) => f.key === fieldKey);
    return def?.defaultOrder ?? 99;
  },
  getFieldColSpan: (formId, fieldKey, activeKeys) => {
    const config = fallbackContextValue.getFormConfig(formId);
    if (activeKeys) {
      const filtered = config.filter((f) => activeKeys.includes(f.key));
      const layout = computeFieldLayout(filtered);
      return layout[fieldKey]?.colSpan ?? "";
    }
    const found = config.find((f) => f.key === fieldKey);
    return found?.colSpan ?? "";
  },
  isFieldLone: (formId, fieldKey, activeKeys) => {
    return Boolean(
      fallbackContextValue
        .getFieldColSpan(formId, fieldKey, activeKeys)
        .includes("sm:col-span-2")
    );
  },
  setFieldVisibility: () => {},
  setFieldRequired: () => {},
  setFieldLabel: () => {},
  setFieldShowPlaceholder: () => {},
  setFieldCustomPlaceholder: () => {},
  moveFieldOrder: () => {},
  setFormOrder: () => {},
  resetFormToDefaults: () => {},
  resetAllFormsToDefaults: () => {},
  isSaving: false,
};

export function useFormCustomizationContext(): FormCustomizationContextValue {
  const ctx = useContext(FormCustomizationContext);
  return ctx || fallbackContextValue;
}

export function useFormCustomizationContextOrNull(): FormCustomizationContextValue | null {
  return useContext(FormCustomizationContext);
}

/**
 * Pre-binds formId for a specific form/sheet component.
 */
export function useFormCustomization(formId: string) {
  const ctx = useFormCustomizationContextOrNull();
  const formDef: FormDefinition | undefined = FORM_REGISTRY[formId];

  const sortedFields = useMemo(() => {
    if (ctx) {
      return ctx.getFormConfig(formId);
    }
    // Fallback when context is missing (e.g. standalone test)
    if (!formDef) return [];
    const raw = formDef.fields.map(
      (f): ResolvedFormField => ({
        key: f.key,
        label: f.defaultLabel,
        placeholder: f.defaultPlaceholder,
        visible: true,
        order: f.defaultOrder,
        required: Boolean(f.required),
        defaultRequired: Boolean(f.required),
        canHide: true,
        defaultLabel: f.defaultLabel,
        defaultPlaceholder: f.defaultPlaceholder,
        showPlaceholder: true,
      })
    );
    const layout = computeFieldLayout(raw);
    return raw
      .map((f) => ({
        ...f,
        colSpan: layout[f.key]?.colSpan ?? "",
        isLone: layout[f.key]?.isLone ?? false,
      }))
      .sort((a, b) => a.order - b.order);
  }, [ctx, formId, formDef]);

  const isFieldVisible = (fieldKey: string): boolean => {
    if (ctx) return ctx.isFieldVisible(formId, fieldKey);
    return true;
  };

  const isFieldRequired = (fieldKey: string, fallback?: boolean): boolean => {
    if (ctx) return ctx.isFieldRequired(formId, fieldKey, fallback);
    const def = formDef?.fields.find((f) => f.key === fieldKey);
    return fallback !== undefined ? fallback : Boolean(def?.required);
  };

  const getFieldLabel = (fieldKey: string, fallback?: string): string => {
    if (ctx) return ctx.getFieldLabel(formId, fieldKey, fallback);
    const def = formDef?.fields.find((f) => f.key === fieldKey);
    return fallback || def?.defaultLabel || fieldKey;
  };

  const getFieldPlaceholder = (
    fieldKey: string,
    fallback?: string
  ): string | undefined => {
    if (ctx) return ctx.getFieldPlaceholder(formId, fieldKey, fallback);
    const def = formDef?.fields.find((f) => f.key === fieldKey);
    return fallback !== undefined ? fallback : def?.defaultPlaceholder;
  };

  const getFieldOrder = (fieldKey: string): number => {
    if (ctx) return ctx.getFieldOrder(formId, fieldKey);
    const def = formDef?.fields.find((f) => f.key === fieldKey);
    return def?.defaultOrder ?? 99;
  };

  const getFieldColSpan = (fieldKey: string, activeKeys?: string[]): string => {
    if (ctx) return ctx.getFieldColSpan(formId, fieldKey, activeKeys);
    if (activeKeys) {
      const filtered = sortedFields.filter((f) => activeKeys.includes(f.key));
      const layout = computeFieldLayout(filtered);
      return layout[fieldKey]?.colSpan ?? "";
    }
    const found = sortedFields.find((f) => f.key === fieldKey);
    return found?.colSpan ?? "";
  };

  const isFieldLone = (fieldKey: string, activeKeys?: string[]): boolean => {
    if (ctx) return ctx.isFieldLone(formId, fieldKey, activeKeys);
    return Boolean(getFieldColSpan(fieldKey, activeKeys).includes("sm:col-span-2"));
  };

  return {
    form: formDef,
    fields: sortedFields,
    sortedFields,
    isFieldVisible,
    isFieldRequired,
    getFieldLabel,
    getFieldPlaceholder,
    getFieldOrder,
    getFieldColSpan,
    isFieldLone,
    setFieldVisibility: (fieldKey: string, visible: boolean) =>
      ctx?.setFieldVisibility(formId, fieldKey, visible),
    setFieldRequired: (fieldKey: string, required: boolean) =>
      ctx?.setFieldRequired(formId, fieldKey, required),
    setFieldLabel: (fieldKey: string, label: string, immediate?: boolean) => {
      if (immediate !== undefined) {
        ctx?.setFieldLabel(formId, fieldKey, label, immediate);
      } else {
        ctx?.setFieldLabel(formId, fieldKey, label);
      }
    },
    setFieldShowPlaceholder: (fieldKey: string, show: boolean) =>
      ctx?.setFieldShowPlaceholder(formId, fieldKey, show),
    setFieldCustomPlaceholder: (
      fieldKey: string,
      placeholder: string,
      immediate?: boolean
    ) => {
      if (immediate !== undefined) {
        ctx?.setFieldCustomPlaceholder(formId, fieldKey, placeholder, immediate);
      } else {
        ctx?.setFieldCustomPlaceholder(formId, fieldKey, placeholder);
      }
    },
    moveFieldOrder: (fieldKey: string, direction: "up" | "down") =>
      ctx?.moveFieldOrder(formId, fieldKey, direction),
    resetToDefaults: () => ctx?.resetFormToDefaults(formId),
    isSaving: ctx?.isSaving ?? false,
  };
}
