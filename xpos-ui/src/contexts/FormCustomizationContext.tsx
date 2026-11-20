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
  setFieldLabel: (formId: string, fieldKey: string, label: string) => void;
  setFieldShowPlaceholder: (
    formId: string,
    fieldKey: string,
    show: boolean
  ) => void;
  setFieldCustomPlaceholder: (
    formId: string,
    fieldKey: string,
    placeholder: string
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
    return formDef.fields.map(
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
    return formDef.fields.map(
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

  return {
    form: formDef,
    fields: sortedFields,
    sortedFields,
    isFieldVisible,
    isFieldRequired,
    getFieldLabel,
    getFieldPlaceholder,
    getFieldOrder,
    setFieldVisibility: (fieldKey: string, visible: boolean) =>
      ctx?.setFieldVisibility(formId, fieldKey, visible),
    setFieldRequired: (fieldKey: string, required: boolean) =>
      ctx?.setFieldRequired(formId, fieldKey, required),
    setFieldLabel: (fieldKey: string, label: string) =>
      ctx?.setFieldLabel(formId, fieldKey, label),
    setFieldShowPlaceholder: (fieldKey: string, show: boolean) =>
      ctx?.setFieldShowPlaceholder(formId, fieldKey, show),
    setFieldCustomPlaceholder: (fieldKey: string, placeholder: string) =>
      ctx?.setFieldCustomPlaceholder(formId, fieldKey, placeholder),
    moveFieldOrder: (fieldKey: string, direction: "up" | "down") =>
      ctx?.moveFieldOrder(formId, fieldKey, direction),
    resetToDefaults: () => ctx?.resetFormToDefaults(formId),
    isSaving: ctx?.isSaving ?? false,
  };
}
