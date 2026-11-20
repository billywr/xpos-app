import { useState, useMemo } from "react";
import {
  useFormCustomizationContext,
  type ResolvedFormField,
} from "@/contexts/FormCustomizationContext";
import {
  FORM_REGISTRY,
  FORM_LIST,
  FORM_CATEGORIES,
  type FormDefinition,
} from "@/config/formCustomizationRegistry";
import {
  FormLabel,
  ConfirmDialog,
} from "@/components/ui";
import {
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";

export function FormCustomizationSettingsSection() {
  const {
    getFormConfig,
    setFieldVisibility,
    setFieldRequired,
    setFieldLabel,
    setFieldShowPlaceholder,
    setFieldCustomPlaceholder,
    moveFieldOrder,
    resetFormToDefaults,
    resetAllFormsToDefaults,
    isSaving,
  } = useFormCustomizationContext();

  const [selectedFormId, setSelectedFormId] = useState<string>("expense");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [confirmResetFormOpen, setConfirmResetFormOpen] = useState(false);
  const [confirmResetAllOpen, setConfirmResetAllOpen] = useState(false);

  const activeFormDef: FormDefinition =
    FORM_REGISTRY[selectedFormId] || FORM_REGISTRY.expense;

  // Filter forms by category
  const filteredForms = useMemo(() => {
    return FORM_LIST.filter((form) => {
      if (selectedCategory === "All") return true;
      return form.category === selectedCategory;
    });
  }, [selectedCategory]);

  // Current form's resolved fields
  const currentFields: ResolvedFormField[] = useMemo(() => {
    return getFormConfig(activeFormDef.id);
  }, [getFormConfig, activeFormDef.id]);

  // Filter fields by search
  const visibleFields = useMemo(() => {
    if (!searchQuery.trim()) return currentFields;
    const q = searchQuery.toLowerCase();
    return currentFields.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        f.defaultLabel.toLowerCase().includes(q) ||
        (f.placeholder && f.placeholder.toLowerCase().includes(q))
    );
  }, [currentFields, searchQuery]);

  return (
    <section className="space-y-6">
      {/* Header description */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            Form & Sheet Customization
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Configure data capture sheets across the system. Hide or reveal optional fields, rename field labels, rearrange field order, and toggle or customize input placeholders.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setConfirmResetAllOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            Reset all forms
          </button>
        </div>
      </div>

      {/* Category selector & Form selection */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-700/60">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory("All")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                selectedCategory === "All"
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              All forms
            </button>
            {FORM_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  selectedCategory === cat
                    ? "bg-primary-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search fields…"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 pl-8 pr-3 py-1 text-xs text-slate-900 focus:border-primary-500 focus:bg-white focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
        </div>

        {/* Form pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {filteredForms.map((form) => {
            const isSelected = form.id === activeFormDef.id;
            return (
              <button
                key={form.id}
                type="button"
                onClick={() => {
                  setSelectedFormId(form.id);
                  setSearchQuery("");
                }}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  isSelected
                    ? "border-primary-500 bg-primary-50 text-primary-900 ring-1 ring-primary-500 dark:border-primary-400 dark:bg-primary-950/40 dark:text-primary-100"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <span>{form.title}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    isSelected
                      ? "bg-primary-200/60 text-primary-800 dark:bg-primary-900/60 dark:text-primary-200"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                  }`}
                >
                  {form.fields.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Form Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {activeFormDef.title}
            </h3>
            <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              Sheet: {activeFormDef.sheetTitle}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {activeFormDef.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-xs text-primary-600 dark:text-primary-400 animate-pulse">
              Saving changes…
            </span>
          )}
          <button
            type="button"
            onClick={() => setConfirmResetFormOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
            Reset this form
          </button>
        </div>
      </div>

      {/* Main Grid: Field Configuration List (Left) & Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Field Editor List (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            <span>Fields & Order</span>
            <span>Controls</span>
          </div>

          {visibleFields.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No fields match your search filter.
            </div>
          ) : (
            visibleFields.map((field, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === visibleFields.length - 1;

              return (
                <div
                  key={field.key}
                  className={`rounded-xl border p-4 transition ${
                    field.visible
                      ? "border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
                      : "border-slate-200/60 bg-slate-50/60 opacity-60 dark:border-slate-800 dark:bg-slate-900/40"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Left: Reorder + Identity */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Move Up / Down Buttons */}
                      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={() => moveFieldOrder(activeFormDef.id, field.key, "up")}
                          disabled={isFirst}
                          aria-label={`Move ${field.label} up`}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          #{field.order}
                        </span>
                        <button
                          type="button"
                          onClick={() => moveFieldOrder(activeFormDef.id, field.key, "down")}
                          disabled={isLast}
                          aria-label={`Move ${field.label} down`}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Field details & inputs */}
                      <div className="min-w-0 flex-1 space-y-3">
                        {/* Title line */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {field.label}
                          </span>
                          <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                            ({field.key})
                          </span>
                          {field.defaultRequired && !field.required && (
                            <span
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                              title="This field is required by system default, but customized to optional"
                            >
                              Default: Required
                            </span>
                          )}
                          {!field.defaultRequired && field.required && (
                            <span
                              className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/40 dark:text-amber-300"
                              title="This field is optional by system default, but customized to required"
                            >
                              Custom: Required
                            </span>
                          )}
                        </div>

                        {/* Rename Label Input */}
                        <div className="space-y-1">
                          <label
                            htmlFor={`label-${field.key}`}
                            className="block text-[11px] font-medium text-slate-500 dark:text-slate-400"
                          >
                            Field Label (display name)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              id={`label-${field.key}`}
                              type="text"
                              value={field.customLabel ?? ""}
                              onChange={(e) =>
                                setFieldLabel(activeFormDef.id, field.key, e.target.value)
                              }
                              placeholder={field.defaultLabel}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                            />
                            {field.customLabel && (
                              <button
                                type="button"
                                onClick={() =>
                                  setFieldLabel(activeFormDef.id, field.key, "")
                                }
                                title="Reset label to default"
                                className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Placeholder Configuration */}
                        <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                          <div className="flex items-center justify-between">
                            <label
                              htmlFor={`placeholder-toggle-${field.key}`}
                              className="text-[11px] font-medium text-slate-500 dark:text-slate-400"
                            >
                              Input Placeholder
                            </label>
                            <label className="relative inline-flex cursor-pointer items-center">
                              <input
                                id={`placeholder-toggle-${field.key}`}
                                type="checkbox"
                                checked={field.showPlaceholder}
                                onChange={(e) =>
                                  setFieldShowPlaceholder(
                                    activeFormDef.id,
                                    field.key,
                                    e.target.checked
                                  )
                                }
                                className="peer sr-only"
                              />
                              <div className="peer h-4 w-7 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-full dark:bg-slate-600" />
                              <span className="ml-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                {field.showPlaceholder ? "Enabled" : "None"}
                              </span>
                            </label>
                          </div>

                          {field.showPlaceholder ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={field.customPlaceholder ?? ""}
                                onChange={(e) =>
                                  setFieldCustomPlaceholder(
                                    activeFormDef.id,
                                    field.key,
                                    e.target.value
                                  )
                                }
                                placeholder={
                                  field.defaultPlaceholder || "No default placeholder"
                                }
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                              />
                              {field.customPlaceholder && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFieldCustomPlaceholder(
                                      activeFormDef.id,
                                      field.key,
                                      ""
                                    )
                                  }
                                  title="Reset placeholder to default"
                                  className="shrink-0 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] italic text-slate-400 dark:text-slate-500">
                              Input will render clean with no placeholder.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Controls (Requirement toggle + Visibility toggle) */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-1">
                      {/* Required / Optional Toggle */}
                      <button
                        type="button"
                        onClick={() =>
                          setFieldRequired(
                            activeFormDef.id,
                            field.key,
                            !field.required
                          )
                        }
                        aria-label={`Toggle requirement for ${field.label}`}
                        title={
                          field.required
                            ? "Field is currently required. Click to make it optional."
                            : "Field is currently optional. Click to make it required."
                        }
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                          field.required
                            ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/60"
                            : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                        }`}
                      >
                        <span
                          className={
                            field.required
                              ? "font-bold text-amber-600 dark:text-amber-400"
                              : "text-slate-400"
                          }
                        >
                          *
                        </span>
                        <span>{field.required ? "Required" : "Optional"}</span>
                      </button>

                      {/* Visibility Toggle */}
                      <button
                        type="button"
                        onClick={() =>
                          setFieldVisibility(
                            activeFormDef.id,
                            field.key,
                            !field.visible
                          )
                        }
                        aria-label={
                          field.visible
                            ? `Hide ${field.label}`
                            : `Make ${field.label} visible`
                        }
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                          field.visible
                            ? "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/60"
                        }`}
                      >
                        {field.visible ? (
                          <>
                            <Eye className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Visible</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3.5 w-3.5 text-red-500" />
                            <span>Hidden</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Live Sheet Preview (5 cols) */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-md overflow-hidden dark:border-slate-700 dark:bg-slate-800">
            {/* Sheet Preview Chrome Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Live Sheet Preview
                </span>
              </div>
              <span className="rounded bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-800 dark:bg-primary-950/60 dark:text-primary-300">
                Auto-updating
              </span>
            </div>

            {/* Simulated SlideOver Drawer */}
            <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="border-b border-slate-100 pb-3 dark:border-slate-700">
                <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                  {activeFormDef.sheetTitle}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  SlideOver drawer preview with current customization
                </p>
              </div>

              {/* Fields in real order */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentFields
                  .filter((f) => f.visible)
                  .map((field) => (
                    <div key={field.key} className="space-y-1">
                      <FormLabel required={field.required} className="text-xs">
                        {field.label}
                      </FormLabel>
                      <input
                        type="text"
                        disabled
                        readOnly
                        placeholder={field.placeholder ?? ""}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-400"
                      />
                    </div>
                  ))}

                {currentFields.filter((f) => f.visible).length === 0 && (
                  <p className="col-span-1 sm:col-span-2 py-6 text-center text-xs text-slate-400 italic">
                    All fields have been hidden.
                  </p>
                )}
              </div>

              {/* Simulated Sheet Footer */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  disabled
                  className="rounded-lg bg-primary-600 py-1.5 text-center text-xs font-medium text-white opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled
                  className="rounded-lg border border-slate-200 bg-slate-100 py-1.5 text-center text-xs font-medium text-slate-600 opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={confirmResetFormOpen}
        onClose={() => setConfirmResetFormOpen(false)}
        onConfirm={() => {
          resetFormToDefaults(activeFormDef.id);
          setConfirmResetFormOpen(false);
        }}
        title={`Reset ${activeFormDef.title}?`}
        message="This will restore all fields, labels, placeholders, and ordering for this form to system defaults."
        confirmLabel="Reset form"
        variant="warning"
      />

      <ConfirmDialog
        open={confirmResetAllOpen}
        onClose={() => setConfirmResetAllOpen(false)}
        onConfirm={() => {
          resetAllFormsToDefaults();
          setConfirmResetAllOpen(false);
        }}
        title="Reset all forms to system defaults?"
        message="This will restore all forms and sheets across the entire organization to system defaults."
        confirmLabel="Reset all forms"
        variant="danger"
      />
    </section>
  );
}
