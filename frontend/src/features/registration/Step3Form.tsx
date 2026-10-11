import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { classNames } from "primereact/utils";
import { DateInput } from "@/components/DateInput";
import { Field } from "@/components/Field";
import { DocumentUpload } from "@/features/documents/DocumentUpload";
import { districtLabel, MASTER_DATA } from "@/features/masterData/data";
import { fetchCoaches } from "@/features/workflow/workflowApi";
import type { CoachOption } from "@/features/workflow/schema";
import { errorMessage } from "@/lib/apiClient";
import { ageOn, todayIst } from "@/lib/dates";
import { isRejected, step1Values, step2Values, step3Values, type Registration } from "./model";
import { emptyCoach, emptyWeapon, MAX_ROWS, needsNonCriminalCert, step3Schema, type Step3Values } from "./schemas/step3";
import { SubmitSection, useFinalSubmit } from "./SubmitSection";
import { useStepSave } from "./useStepSave";

export function Step3Form({
  registration,
  onSaved,
  onPrevious,
  onSubmitted,
}: {
  registration: Registration;
  onSaved: (r: Registration) => void;
  onPrevious: () => void;
  onSubmitted: (r: Registration) => void;
}) {
  const dob = step1Values(registration).dob || undefined;
  const district = step2Values(registration).city || undefined;
  const today = todayIst();
  const isMinor = !!dob && ageOn(dob, today) < 18;
  const showCert = needsNonCriminalCert(dob);

  const form = useForm<Step3Values>({
    resolver: zodResolver(step3Schema("complete", { dob })) as Resolver<Step3Values>,
    mode: "onTouched",
    defaultValues: step3Values(registration),
  });
  const { register, control, setError, formState: { errors } } = form;
  const weapons = useFieldArray({ control, name: "weapons" });
  const coaches = useFieldArray({ control, name: "coaches" });
  const { saveDraft, saveComplete, saving } = useStepSave(3, form, step3Schema("draft", { dob }), onSaved);
  const final = useFinalSubmit(registration, isMinor, saveComplete, onSubmitted);

  const [coachOptions, setCoachOptions] = useState<CoachOption[]>([]);
  const [coachError, setCoachError] = useState<string | null>(null);
  useEffect(() => {
    fetchCoaches(district)
      .then(setCoachOptions)
      .catch((err) => setCoachError(errorMessage(err)));
  }, [district]);

  const [passportNo, passportExpiry] = useWatch({ control, name: ["passport_number", "passport_expiry_date"] });
  const passportRequired = !!passportNo?.trim();

  const text = (name: `weapons.${number}.${"make" | "model" | "caliber" | "serial_no"}` | `coaches.${number}.name`, placeholder: string, error?: string) => (
    <>
      <InputText id={name} aria-label={placeholder} placeholder={placeholder.toUpperCase()} {...register(name)} className={classNames({ "p-invalid": error })} />
      <small className="p-error" aria-live="polite">{error ?? ""}</small>
    </>
  );

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="step-form">
      <h2 className="step-title">Membership &amp; Other Info</h2>

      <section className="panel-grey" aria-labelledby="coach-select-title">
        <h3 id="coach-select-title" className="section-title">Approving Coach</h3>
        <p className="muted small">Your application goes to this Coach first, then to the District Secretary of {districtLabel(undefined, district)}.</p>
        {coachError && <Message severity="error" text={coachError} />}
        <Field label="Your Coach" htmlFor="coach_user_id" required error={errors.coach_user_id?.message} className="max-w-md">
          <Controller
            name="coach_user_id"
            control={control}
            render={({ field }) => (
              <Dropdown
                inputId="coach_user_id"
                value={field.value}
                options={coachOptions.map((c) => ({ label: `${c.name} (${districtLabel(undefined, c.district_code ?? undefined)})`, value: c.user_id }))}
                onChange={(e) => field.onChange(e.value)}
                onBlur={field.onBlur}
                placeholder="Select your coach"
                emptyMessage="No active coaches found"
                className={classNames({ "p-invalid": errors.coach_user_id })}
              />
            )}
          />
        </Field>
      </section>

      <section className="panel-grey" aria-labelledby="passport-title">
        <h3 id="passport-title" className="section-title">Passport</h3>
        <p className="muted small">Optional. Once you enter a passport number, the other passport fields become required.</p>
        <div className="grid-3">
          <Field label="Passport Number" htmlFor="passport_number" error={errors.passport_number?.message}>
            <InputText id="passport_number" placeholder="PASSPORT NUMBER" maxLength={9} {...register("passport_number")} className={classNames("uppercase", { "p-invalid": errors.passport_number })} />
          </Field>
          <Field label="Passport Upload" htmlFor="passport_file" required={passportRequired} error={errors.passport_file?.message}>
            <Controller
              name="passport_file"
              control={control}
              render={({ field }) => (
                <DocumentUpload id="passport_file" docType="PASSPORT" value={field.value} onChange={field.onChange} onBlur={field.onBlur} removable invalid={!!errors.passport_file} onError={(m) => (m ? setError("passport_file", { message: m }) : form.clearErrors("passport_file"))} />
              )}
            />
          </Field>
          <Field label="Issuing Authority" htmlFor="passport_issuing_authority" required={passportRequired} error={errors.passport_issuing_authority?.message}>
            <InputText id="passport_issuing_authority" placeholder="ISSUING AUTHORITY" {...register("passport_issuing_authority")} className={classNames({ "p-invalid": errors.passport_issuing_authority })} />
          </Field>
          <Field label="Date of Issue" htmlFor="passport_issue_date" required={passportRequired} error={errors.passport_issue_date?.message}>
            <Controller name="passport_issue_date" control={control} render={({ field }) => <DateInput id="passport_issue_date" value={field.value} onChange={field.onChange} onBlur={field.onBlur} minDate={dob} maxDate={today} invalid={!!errors.passport_issue_date} />} />
          </Field>
          <Field
            label="Date of Expiry"
            htmlFor="passport_expiry_date"
            required={passportRequired}
            error={errors.passport_expiry_date?.message}
            hint={passportExpiry && passportExpiry < today ? <span className="warn-text"><i className="pi pi-exclamation-triangle" /> This passport has expired.</span> : undefined}
          >
            <Controller name="passport_expiry_date" control={control} render={({ field }) => <DateInput id="passport_expiry_date" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.passport_expiry_date} />} />
          </Field>
          <Field label="Place of Issue" htmlFor="passport_place_of_issue" required={passportRequired} error={errors.passport_place_of_issue?.message}>
            <InputText id="passport_place_of_issue" placeholder="PLACE OF ISSUE" {...register("passport_place_of_issue")} className={classNames({ "p-invalid": errors.passport_place_of_issue })} />
          </Field>
        </div>
      </section>

      <section className="panel-grey" aria-labelledby="weapons-title">
        <h3 id="weapons-title" className="section-title">Weapon Details</h3>
        {errors.weapons?.root?.message && <small className="p-error">{errors.weapons.root.message}</small>}
        {weapons.fields.length === 0 && <p className="muted small">No weapons added. Rows are optional; add up to {MAX_ROWS}.</p>}
        {weapons.fields.length > 0 && (
          <div className="rows-table weapons" role="table" aria-label="Weapons">
            <div className="rows-head" role="row">
              <span role="columnheader">Type *</span>
              <span role="columnheader">Make *</span>
              <span role="columnheader">Model</span>
              <span role="columnheader">Caliber</span>
              <span role="columnheader">Serial No. *</span>
              <span />
            </div>
            {weapons.fields.map((row, i) => {
              const e = errors.weapons?.[i];
              return (
                <div className="rows-row" role="row" key={row.id}>
                  <div>
                    <Controller
                      name={`weapons.${i}.type`}
                      control={control}
                      render={({ field }) => (
                        <Dropdown inputId={`weapons.${i}.type`} aria-label="Weapon type" value={field.value} options={MASTER_DATA.weapon_types.map((o) => ({ label: o.label, value: o.code }))} onChange={(ev) => field.onChange(ev.value)} onBlur={field.onBlur} placeholder="SELECT TYPE" className={classNames({ "p-invalid": e?.type })} />
                      )}
                    />
                    <small className="p-error">{e?.type?.message ?? ""}</small>
                  </div>
                  <div>{text(`weapons.${i}.make`, "Make", e?.make?.message)}</div>
                  <div>{text(`weapons.${i}.model`, "Model", e?.model?.message)}</div>
                  <div>{text(`weapons.${i}.caliber`, "Caliber", e?.caliber?.message)}</div>
                  <div>{text(`weapons.${i}.serial_no`, "Serial No.", e?.serial_no?.message)}</div>
                  <Button type="button" icon="pi pi-trash" text severity="danger" aria-label={`Remove weapon ${i + 1}`} onClick={() => weapons.remove(i)} />
                </div>
              );
            })}
          </div>
        )}
        <Button type="button" icon="pi pi-plus" label="Add weapon" className="btn-add" onClick={() => weapons.append({ ...emptyWeapon })} disabled={weapons.fields.length >= MAX_ROWS} />
      </section>

      <section className="panel-grey" aria-labelledby="coaches-title">
        <h3 id="coaches-title" className="section-title">Coach Details</h3>
        {coaches.fields.length === 0 && <p className="muted small">Your coaching history. Optional; add up to {MAX_ROWS}. Leave "To" empty for your current coach.</p>}
        {coaches.fields.length > 0 && (
          <div className="rows-table coaches" role="table" aria-label="Coaching history">
            <div className="rows-head" role="row">
              <span role="columnheader">Coach Name *</span>
              <span role="columnheader">From *</span>
              <span role="columnheader">To</span>
              <span />
            </div>
            {coaches.fields.map((row, i) => {
              const e = errors.coaches?.[i];
              return (
                <div className="rows-row" role="row" key={row.id}>
                  <div>{text(`coaches.${i}.name`, "Coach Name", e?.name?.message)}</div>
                  <div>
                    <Controller name={`coaches.${i}.from`} control={control} render={({ field }) => <DateInput id={`coaches.${i}.from`} value={field.value} onChange={field.onChange} onBlur={field.onBlur} minDate={dob} maxDate={today} invalid={!!e?.from} />} />
                    <small className="p-error">{e?.from?.message ?? ""}</small>
                  </div>
                  <div>
                    <Controller name={`coaches.${i}.to`} control={control} render={({ field }) => <DateInput id={`coaches.${i}.to`} value={field.value} onChange={field.onChange} onBlur={field.onBlur} maxDate={today} invalid={!!e?.to} />} />
                    <small className="p-error">{e?.to?.message ?? ""}</small>
                  </div>
                  <Button type="button" icon="pi pi-trash" text severity="danger" aria-label={`Remove coach ${i + 1}`} onClick={() => coaches.remove(i)} />
                </div>
              );
            })}
          </div>
        )}
        <Button type="button" icon="pi pi-plus" label="Add coach" className="btn-add" onClick={() => coaches.append({ ...emptyCoach })} disabled={coaches.fields.length >= MAX_ROWS} />
      </section>

      {showCert && (
        <section className="panel-grey" aria-labelledby="ncc-title">
          <h3 id="ncc-title" className="section-title">Non-Criminal Certificate</h3>
          <Field label="Non-Criminal Certificate" htmlFor="non_criminal_cert" required error={errors.non_criminal_cert?.message} hint="Required because the applicant is 18 or older.">
            <Controller
              name="non_criminal_cert"
              control={control}
              render={({ field }) => (
                <DocumentUpload id="non_criminal_cert" docType="NON_CRIMINAL_CERT" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.non_criminal_cert} onError={(m) => (m ? setError("non_criminal_cert", { message: m }) : form.clearErrors("non_criminal_cert"))} />
              )}
            />
          </Field>
        </section>
      )}

      <SubmitSection form={final.form} isMinor={isMinor} />

      <div className="step-actions">
        <Button type="button" label="Previous" className="btn-outline-dark" onClick={onPrevious} disabled={!!saving || final.submitting} />
        <Button type="button" label="Save For Later" className="btn-dark" onClick={saveDraft} loading={saving === "draft"} disabled={!!saving || final.submitting} />
        <Button type="button" label={isRejected(registration.status) ? "Resubmit application" : "Submit application"} icon="pi pi-send" className="btn-primary" onClick={final.submit} loading={saving === "complete" || final.submitting} />
      </div>
    </form>
  );
}
