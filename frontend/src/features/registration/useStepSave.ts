import { useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { useToast } from "@/components/ToastProvider";
import { errorMessage } from "@/lib/apiClient";
import { applyServerErrors, applyZodIssues } from "./formHelpers";
import type { Registration } from "./model";
import { saveStep } from "./registrationApi";

/**
 * Save for later (draft: format checks only) and Next (complete: full validation) for one step
 * (REQUIREMENTS §2.4). The server re-validates both.
 */
export function useStepSave<T extends FieldValues>(
  step: 1 | 2 | 3,
  form: UseFormReturn<T>,
  draftSchema: z.ZodType,
  onSaved: (r: Registration) => void,
) {
  const toast = useToast();
  const [saving, setSaving] = useState<"draft" | "complete" | null>(null);

  const saveDraft = async () => {
    form.clearErrors();
    const values = form.getValues();
    const check = draftSchema.safeParse(values);
    if (!check.success) {
      applyZodIssues(check.error, form.setError);
      toast({ severity: "warn", summary: "Not saved", detail: "Fix the highlighted fields, or clear them, then save again." });
      return;
    }
    setSaving("draft");
    try {
      onSaved(await saveStep(step, values, "draft"));
      toast({ severity: "success", summary: "Saved for later", detail: "You can log out and continue from here later." });
    } catch (err) {
      applyServerErrors(err, form.setError);
      toast({ severity: "error", summary: "Not saved", detail: errorMessage(err) });
    } finally {
      setSaving(null);
    }
  };

  /** Validates the whole step, then saves it. Returns true on success. */
  const saveComplete = async (): Promise<boolean> => {
    const valid = await form.trigger();
    if (!valid) {
      toast({ severity: "warn", summary: "Please check this step", detail: "Correct the highlighted fields to continue." });
      focusFirstError();
      return false;
    }
    setSaving("complete");
    try {
      onSaved(await saveStep(step, form.getValues(), "complete"));
      return true;
    } catch (err) {
      const mapped = applyServerErrors(err, form.setError);
      toast({ severity: "error", summary: "Not saved", detail: mapped[0] ?? errorMessage(err) });
      focusFirstError();
      return false;
    } finally {
      setSaving(null);
    }
  };

  return { saveDraft, saveComplete, saving };
}

function focusFirstError() {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(".step-panel:not([hidden]) .p-invalid input, .step-panel:not([hidden]) input.p-invalid, .step-panel:not([hidden]) .p-invalid");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus?.();
  });
}
