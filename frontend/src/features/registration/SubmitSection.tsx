import { useState } from "react";
import { Controller, useForm, type Resolver, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox } from "primereact/checkbox";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { classNames } from "primereact/utils";
import { Field } from "@/components/Field";
import { useToast } from "@/components/ToastProvider";
import { MASTER_DATA } from "@/features/masterData/data";
import { errorMessage, fieldErrors } from "@/lib/apiClient";
import { applyServerErrors } from "./formHelpers";
import { submitValues, type Registration } from "./model";
import { submitApplication } from "./registrationApi";
import { submitSchema, type SubmitValues } from "./schemas/submit";

const STEP_OF: Record<string, string> = { basic_info: "Step 1", personal_info: "Step 2", membership: "Step 3" };

/** Declaration (+ guardian consent for minors) and the final Submit (REQUIREMENTS §3.4). */
export function useFinalSubmit(registration: Registration, isMinor: boolean, saveCurrentStep: () => Promise<boolean>, onSubmitted: (r: Registration) => void) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<SubmitValues>({
    resolver: zodResolver(submitSchema(isMinor)) as Resolver<SubmitValues>,
    mode: "onTouched",
    // The declaration must be confirmed again on every submission, including a resubmission.
    defaultValues: { ...submitValues(registration), declaration: false },
  });

  const submit = async () => {
    const declarationOk = await form.trigger();
    if (!(await saveCurrentStep()) || !declarationOk) {
      if (!declarationOk) toast({ severity: "warn", summary: "Please confirm the declaration" });
      return;
    }
    setSubmitting(true);
    try {
      const r = await submitApplication(form.getValues());
      onSubmitted(r);
    } catch (err) {
      applyServerErrors(err, form.setError, "submit_info");
      const other = fieldErrors(err).filter((f) => !f.path.startsWith("submit_info"));
      const detail = other.length
        ? other.map((f) => `${STEP_OF[f.path.split(".")[0]] ?? "Form"}: ${f.message}`).join(" | ")
        : errorMessage(err);
      toast({ severity: "error", summary: "Could not submit", detail, life: 8000 });
    } finally {
      setSubmitting(false);
    }
  };

  return { form, submit, submitting };
}

export function SubmitSection({ form, isMinor, staff }: { form: UseFormReturn<SubmitValues>; isMinor: boolean; staff?: boolean }) {
  const {
    control,
    register,
    formState: { errors },
  } = form;

  return (
    <section className="panel-grey submit-section" aria-labelledby="declaration-title">
      <h3 id="declaration-title" className="section-title">Declaration</h3>
      {isMinor && !staff && (
        <>
          <p className="muted">The applicant is under 18, so a parent or guardian must give consent.</p>
          <div className="grid-2">
            <Field label="Guardian Name" htmlFor="guardian_name" required error={errors.guardian_name?.message}>
              <InputText id="guardian_name" {...register("guardian_name")} className={classNames({ "p-invalid": errors.guardian_name })} />
            </Field>
            <Field label="Relationship" htmlFor="guardian_relationship" required error={errors.guardian_relationship?.message}>
              <Controller
                name="guardian_relationship"
                control={control}
                render={({ field }) => (
                  <Dropdown
                    inputId="guardian_relationship"
                    value={field.value}
                    options={MASTER_DATA.guardian_relationships.map((o) => ({ label: o.label, value: o.code }))}
                    onChange={(e) => field.onChange(e.value)}
                    onBlur={field.onBlur}
                    placeholder="Select relationship"
                    className={classNames({ "p-invalid": errors.guardian_relationship })}
                  />
                )}
              />
            </Field>
          </div>
          <Controller
            name="guardian_consent"
            control={control}
            render={({ field }) => (
              <div className="check-line">
                <Checkbox inputId="guardian_consent" checked={!!field.value} onChange={(e) => field.onChange(!!e.checked)} className={classNames({ "p-invalid": errors.guardian_consent })} />
                <label htmlFor="guardian_consent">I am the parent / legal guardian and I consent to this registration and the processing of the applicant's data.</label>
              </div>
            )}
          />
          <small className="p-error" aria-live="polite">{errors.guardian_consent?.message ?? ""}</small>
        </>
      )}
      <Controller
        name="declaration"
        control={control}
        render={({ field }) => (
          <div className="check-line">
            <Checkbox inputId="declaration" checked={!!field.value} onChange={(e) => field.onChange(!!e.checked)} className={classNames({ "p-invalid": errors.declaration })} />
            <label htmlFor="declaration">
              I confirm the information provided is true and correct.<span className="req"> *</span>
            </label>
          </div>
        )}
      />
      <small className="p-error" aria-live="polite">{errors.declaration?.message ?? ""}</small>
    </section>
  );
}
