import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { selectOrgId } from "@/store/selectors/orgContextSelectors";
import { useNavVisibilityContextOrNull } from "@/contexts/NavVisibilityContext";
import {
  FormCustomizationContext,
  type ResolvedFormField,
  type FormCustomizationContextValue,
} from "@/contexts/FormCustomizationContext";
import {
  FORM_REGISTRY,
  type FormDefinition,
} from "@/config/formCustomizationRegistry";

interface LocalFormCustomizationState {
  visibility: Record<string, boolean>;
  labels: Record<string, string>;
}

function getLocalStorageKey(orgId: string | null): string {
  return `xpos_form_customization_${orgId || "global"}`;
}

function loadLocalState(orgId: string | null): LocalFormCustomizationState {
  try {
    const raw = localStorage.getItem(getLocalStorageKey(orgId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        visibility: parsed.visibility ?? {},
        labels: parsed.labels ?? {},
      };
    }
  } catch {
    /* ignore */
  }
  return { visibility: {}, labels: {} };
}

function saveLocalState(
  orgId: string | null,
  state: LocalFormCustomizationState
) {
  try {
    localStorage.setItem(getLocalStorageKey(orgId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function FormCustomizationProvider({ children }: { children: ReactNode }) {
  const orgId = useAppSelector(selectOrgId);
  const navCtx = useNavVisibilityContextOrNull();

  // Local state as fast cache / offline fallback
  const [localCustomization, setLocalCustomization] =
    useState<LocalFormCustomizationState>(() => loadLocalState(orgId));

  // Reload local state when orgId changes
  useEffect(() => {
    setLocalCustomization(loadLocalState(orgId));
  }, [orgId]);

  const pendingLabelUpdatesRef = useRef<Record<string, string>>({});
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (
        debounceTimerRef.current &&
        Object.keys(pendingLabelUpdatesRef.current).length > 0
      ) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        const updates = { ...pendingLabelUpdatesRef.current };
        pendingLabelUpdatesRef.current = {};
        (Object.entries(updates) as [string, string][]).forEach(([k, v]) => {
          navCtx?.setAdminLabel(k, v);
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [navCtx]);

  // Combined visibility: local customization takes precedence for the active session, else backend
  const combinedVisibility = useMemo(() => {
    const backendVis = navCtx?.adminVisibility ?? {};
    return { ...backendVis, ...localCustomization.visibility };
  }, [navCtx?.adminVisibility, localCustomization.visibility]);

  // Combined labels: local customization takes precedence for the active session, else backend
  const combinedLabels = useMemo(() => {
    const backendLabels = navCtx?.adminLabels ?? {};
    return { ...backendLabels, ...localCustomization.labels };
  }, [navCtx?.adminLabels, localCustomization.labels]);

  const persistChange = useCallback(
    (
      newVisDelta?: Record<string, boolean>,
      newLabelsDelta?: Record<string, string>,
      immediateRemoteSync = false
    ) => {
      // 1. Update local cache immediately
      setLocalCustomization((prev) => {
        const nextVis = { ...prev.visibility, ...newVisDelta };
        const nextLabels = { ...prev.labels, ...newLabelsDelta };
        saveLocalState(orgId, { visibility: nextVis, labels: nextLabels });
        return { visibility: nextVis, labels: nextLabels };
      });

      // 2. Persist to backend if nav context is available
      if (navCtx) {
        if (newVisDelta) {
          Object.entries(newVisDelta).forEach(([k, v]) => {
            navCtx.setAdminVisible(k, v);
          });
        }
        if (newLabelsDelta) {
          Object.assign(pendingLabelUpdatesRef.current, newLabelsDelta);

          const flushLabels = () => {
            const updates = { ...pendingLabelUpdatesRef.current };
            pendingLabelUpdatesRef.current = {};
            (Object.entries(updates) as [string, string][]).forEach(([k, v]) => {
              navCtx.setAdminLabel(k, v);
            });
          };

          if (immediateRemoteSync) {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
              debounceTimerRef.current = null;
            }
            flushLabels();
          } else {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            debounceTimerRef.current = setTimeout(flushLabels, 1500);
          }
        }
      }
    },
    [navCtx, orgId]
  );

  const getFormConfig = useCallback(
    (formId: string): ResolvedFormField[] => {
      const def: FormDefinition | undefined = FORM_REGISTRY[formId];
      if (!def) return [];

      // Check if there is a custom ordering stored in labels
      const orderKey = `form.${formId}.order`;
      const orderString = combinedLabels[orderKey];
      const customOrderedKeys = orderString
        ? orderString.split(",").map((k) => k.trim()).filter(Boolean)
        : null;

      const resolved = def.fields.map((f) => {
        const visKey = `form.${formId}.${f.key}.visible`;
        const requiredKey = `form.${formId}.${f.key}.required`;
        const labelKey = `form.${formId}.${f.key}.label`;
        const placeholderKey = `form.${formId}.${f.key}.placeholder`;
        const customPlaceholderKey = `form.${formId}.${f.key}.customPlaceholder`;

        // Visibility
        let visible = true;
        if (visKey in combinedVisibility) {
          visible = combinedVisibility[visKey];
        }

        // Required (customizable by admin, even for fields required by default)
        let required = Boolean(f.required);
        if (requiredKey in combinedVisibility) {
          required = combinedVisibility[requiredKey];
        }

        // Show Placeholder
        let showPlaceholder = true;
        if (placeholderKey in combinedVisibility) {
          showPlaceholder = combinedVisibility[placeholderKey];
        }

        // Custom Label
        const customLabel =
          labelKey in combinedLabels && combinedLabels[labelKey] !== ""
            ? combinedLabels[labelKey]
            : undefined;
        const label = customLabel?.trim() || f.defaultLabel;

        // Custom Placeholder
        const customPlaceholder =
          customPlaceholderKey in combinedLabels &&
          combinedLabels[customPlaceholderKey] !== ""
            ? combinedLabels[customPlaceholderKey]
            : undefined;
        let placeholder: string | undefined = undefined;
        if (showPlaceholder) {
          placeholder = customPlaceholder?.trim() || f.defaultPlaceholder;
        }

        // Order
        let order = f.defaultOrder;
        if (customOrderedKeys) {
          const idx = customOrderedKeys.indexOf(f.key);
          if (idx !== -1) {
            order = idx + 1;
          } else {
            order = customOrderedKeys.length + f.defaultOrder;
          }
        }

        return {
          key: f.key,
          label,
          placeholder,
          visible,
          order,
          required,
          defaultRequired: Boolean(f.required),
          canHide: true,
          defaultLabel: f.defaultLabel,
          defaultPlaceholder: f.defaultPlaceholder,
          customLabel,
          customPlaceholder,
          showPlaceholder,
        };
      });

      // Sort by order ascending
      return resolved.sort((a, b) => a.order - b.order);
    },
    [combinedVisibility, combinedLabels]
  );

  const isFieldVisible = useCallback(
    (formId: string, fieldKey: string): boolean => {
      const visKey = `form.${formId}.${fieldKey}.visible`;
      if (visKey in combinedVisibility) {
        return combinedVisibility[visKey];
      }
      return true;
    },
    [combinedVisibility]
  );

  const isFieldRequired = useCallback(
    (formId: string, fieldKey: string, fallback?: boolean): boolean => {
      const requiredKey = `form.${formId}.${fieldKey}.required`;
      if (requiredKey in combinedVisibility) {
        return combinedVisibility[requiredKey];
      }
      if (fallback !== undefined) return fallback;
      const def = FORM_REGISTRY[formId]?.fields.find((f) => f.key === fieldKey);
      return Boolean(def?.required);
    },
    [combinedVisibility]
  );

  const getFieldLabel = useCallback(
    (formId: string, fieldKey: string, fallback?: string): string => {
      const labelKey = `form.${formId}.${fieldKey}.label`;
      const custom = combinedLabels[labelKey]?.trim();
      if (custom) return custom;
      if (fallback) return fallback;
      const def = FORM_REGISTRY[formId]?.fields.find((f) => f.key === fieldKey);
      return def?.defaultLabel || fieldKey;
    },
    [combinedLabels]
  );

  const getFieldPlaceholder = useCallback(
    (
      formId: string,
      fieldKey: string,
      fallback?: string
    ): string | undefined => {
      const placeholderKey = `form.${formId}.${fieldKey}.placeholder`;
      const showPlaceholder =
        placeholderKey in combinedVisibility
          ? combinedVisibility[placeholderKey]
          : true;

      if (!showPlaceholder) {
        return undefined;
      }

      const customPlaceholderKey = `form.${formId}.${fieldKey}.customPlaceholder`;
      const custom = combinedLabels[customPlaceholderKey]?.trim();
      if (custom) return custom;
      if (fallback !== undefined) return fallback;
      const def = FORM_REGISTRY[formId]?.fields.find((f) => f.key === fieldKey);
      return def?.defaultPlaceholder;
    },
    [combinedVisibility, combinedLabels]
  );

  const getFieldOrder = useCallback(
    (formId: string, fieldKey: string): number => {
      const config = getFormConfig(formId);
      const found = config.find((f) => f.key === fieldKey);
      return found?.order ?? 99;
    },
    [getFormConfig]
  );

  const setFieldVisibility = useCallback(
    (formId: string, fieldKey: string, visible: boolean) => {
      const visKey = `form.${formId}.${fieldKey}.visible`;
      const delta: Record<string, boolean> = { [visKey]: visible };
      if (!visible) {
        // If hidden, field cannot be required to fill
        delta[`form.${formId}.${fieldKey}.required`] = false;
      }
      persistChange(delta);
    },
    [persistChange]
  );

  const setFieldRequired = useCallback(
    (formId: string, fieldKey: string, required: boolean) => {
      const requiredKey = `form.${formId}.${fieldKey}.required`;
      const delta: Record<string, boolean> = { [requiredKey]: required };
      if (required) {
        // If marked required, it must be visible
        delta[`form.${formId}.${fieldKey}.visible`] = true;
      }
      persistChange(delta);
    },
    [persistChange]
  );

  const setFieldLabel = useCallback(
    (formId: string, fieldKey: string, label: string, immediate = false) => {
      const labelKey = `form.${formId}.${fieldKey}.label`;
      persistChange(undefined, { [labelKey]: label }, immediate);
    },
    [persistChange]
  );

  const setFieldShowPlaceholder = useCallback(
    (formId: string, fieldKey: string, show: boolean) => {
      const placeholderKey = `form.${formId}.${fieldKey}.placeholder`;
      persistChange({ [placeholderKey]: show });
    },
    [persistChange]
  );

  const setFieldCustomPlaceholder = useCallback(
    (
      formId: string,
      fieldKey: string,
      placeholder: string,
      immediate = false
    ) => {
      const customPlaceholderKey = `form.${formId}.${fieldKey}.customPlaceholder`;
      persistChange(undefined, { [customPlaceholderKey]: placeholder }, immediate);
    },
    [persistChange]
  );

  const setFormOrder = useCallback(
    (formId: string, orderedKeys: string[]) => {
      const orderKey = `form.${formId}.order`;
      persistChange(undefined, { [orderKey]: orderedKeys.join(",") }, true);
    },
    [persistChange]
  );

  const moveFieldOrder = useCallback(
    (formId: string, fieldKey: string, direction: "up" | "down") => {
      const fields = getFormConfig(formId);
      const keys = fields.map((f) => f.key);
      const idx = keys.indexOf(fieldKey);
      if (idx === -1) return;

      if (direction === "up" && idx > 0) {
        const temp = keys[idx - 1];
        keys[idx - 1] = keys[idx];
        keys[idx] = temp;
        setFormOrder(formId, keys);
      } else if (direction === "down" && idx < keys.length - 1) {
        const temp = keys[idx + 1];
        keys[idx + 1] = keys[idx];
        keys[idx] = temp;
        setFormOrder(formId, keys);
      }
    },
    [getFormConfig, setFormOrder]
  );

  const resetFormToDefaults = useCallback(
    (formId: string) => {
      const def = FORM_REGISTRY[formId];
      if (!def) return;

      const newVis: Record<string, boolean> = {};
      const newLabels: Record<string, string> = {};

      // Reset all field keys for this form
      def.fields.forEach((f) => {
        newVis[`form.${formId}.${f.key}.visible`] = true;
        newVis[`form.${formId}.${f.key}.required`] = Boolean(f.required);
        newVis[`form.${formId}.${f.key}.placeholder`] = true;
        newLabels[`form.${formId}.${f.key}.label`] = "";
        newLabels[`form.${formId}.${f.key}.customPlaceholder`] = "";
      });
      newLabels[`form.${formId}.order`] = "";

      persistChange(newVis, newLabels, true);
    },
    [persistChange]
  );

  const resetAllFormsToDefaults = useCallback(() => {
    const newVis: Record<string, boolean> = {};
    const newLabels: Record<string, string> = {};

    Object.values(FORM_REGISTRY).forEach((def) => {
      def.fields.forEach((f) => {
        newVis[`form.${def.id}.${f.key}.visible`] = true;
        newVis[`form.${def.id}.${f.key}.required`] = Boolean(f.required);
        newVis[`form.${def.id}.${f.key}.placeholder`] = true;
        newLabels[`form.${def.id}.${f.key}.label`] = "";
        newLabels[`form.${def.id}.${f.key}.customPlaceholder`] = "";
      });
      newLabels[`form.${def.id}.order`] = "";
    });

    persistChange(newVis, newLabels, true);
  }, [persistChange]);

  const value: FormCustomizationContextValue = useMemo(
    () => ({
      getFormConfig,
      isFieldVisible,
      isFieldRequired,
      getFieldLabel,
      getFieldPlaceholder,
      getFieldOrder,
      setFieldVisibility,
      setFieldRequired,
      setFieldLabel,
      setFieldShowPlaceholder,
      setFieldCustomPlaceholder,
      moveFieldOrder,
      setFormOrder,
      resetFormToDefaults,
      resetAllFormsToDefaults,
      isSaving: navCtx?.isSaving ?? false,
    }),
    [
      getFormConfig,
      isFieldVisible,
      isFieldRequired,
      getFieldLabel,
      getFieldPlaceholder,
      getFieldOrder,
      setFieldVisibility,
      setFieldRequired,
      setFieldLabel,
      setFieldShowPlaceholder,
      setFieldCustomPlaceholder,
      moveFieldOrder,
      setFormOrder,
      resetFormToDefaults,
      resetAllFormsToDefaults,
      navCtx?.isSaving,
    ]
  );

  return (
    <FormCustomizationContext.Provider value={value}>
      {children}
    </FormCustomizationContext.Provider>
  );
}
