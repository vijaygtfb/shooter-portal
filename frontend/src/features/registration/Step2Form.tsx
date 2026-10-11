import { useEffect } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { InputMask } from "primereact/inputmask";
import { InputNumber } from "primereact/inputnumber";
import { Dropdown } from "primereact/dropdown";
import { Checkbox } from "primereact/checkbox";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { classNames } from "primereact/utils";
import { Field } from "@/components/Field";
import { DocumentUpload } from "@/features/documents/DocumentUpload";
import { MASTER_DATA } from "@/features/masterData/data";
import { maskAadhaar } from "@/lib/validators";
import { step2Values, type Registration } from "./model";
import { step2Schema, type Step2Values } from "./schemas/step2";
import { SubmitSection, useFinalSubmit } from "./SubmitSection";
import { useStepSave } from "./useStepSave";

const opts = (list: { code: string; label: string }[]) => list.map((o) => ({ label: o.label, value: o.code }));

export function Step2Form({
  registration,
  isLast,
  onSaved,
  onNext,
  onPrevious,
  onSubmitted,
}: {
  registration: Registration;
  /** True for staff roles, whose profile ends at Step 2 (REQUIREMENTS §16.2). */
  isLast: boolean;
  onSaved: (r: Registration) => void;
  onNext: () => void;
  onPrevious: () => void;
  onSubmitted: (r: Registration) => void;
}) {
  const form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema("complete")) as Resolver<Step2Values>,
    mode: "onTouched",
    defaultValues: step2Values(registration),
  });
  const { register, control, setValue, setError, formState: { errors } } = form;
  const { saveDraft, saveComplete, saving } = useStepSave(2, form, step2Schema("draft"), (r) => {
    onSaved(r);
    // The server never returns the Aadhaar number: keep the masked "on file" state in sync.
    const p = step2Values(r);
    setValue("aadhaar_on_file", p.aadhaar_on_file);
    setValue("aadhaar_last4", p.aadhaar_last4);
    setValue("aadhaar_no", "");
  });
  const final = useFinalSubmit(registration, false, saveComplete, onSubmitted);

  const [marital, state, address, mailingSame, aadhaarOnFile, last4] = useWatch({
    control,
    name: ["marital_status", "state", "address", "mailing_same", "aadhaar_on_file", "aadhaar_last4"],
  });

  // Spouse name only applies when married.
  useEffect(() => {
    if (marital && marital !== "MARRIED") setValue("spouse_name", "");
  }, [marital, setValue]);

  // "Same as address" copies the address and locks the mailing address.
  useEffect(() => {
    if (mailingSame) setValue("mailing_address", address ?? "");
  }, [mailingSame, address, setValue]);

  const numberField = (name: "height_cm" | "weight_kg" | "shoe_size_uk", label: string, min: number, max: number) => (
    <Field label={label} htmlFor={name} error={errors[name]?.message}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <InputNumber inputId={name} value={field.value} onValueChange={(e) => field.onChange(e.value ?? null)} onBlur={field.onBlur} useGrouping={false} min={min} max={max} maxFractionDigits={name === "shoe_size_uk" ? 0 : 1} className={classNames({ "p-invalid": errors[name] })} />
        )}
      />
    </Field>
  );

  const sizeField = (name: "track_suit_size" | "tshirt_size", label: string) => (
    <Field label={label} htmlFor={name} error={errors[name]?.message}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Dropdown inputId={name} value={field.value} options={opts(MASTER_DATA.apparel_sizes)} onChange={(e) => field.onChange(e.value)} onBlur={field.onBlur} placeholder="Select size" showClear className={classNames({ "p-invalid": errors[name] })} />
        )}
      />
    </Field>
  );

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="step-form">
      <h2 className="step-title">Personal Information</h2>
      <div className="grid-2">
        <Field label="Mother Name" htmlFor="mother_name" error={errors.mother_name?.message}>
          <InputText id="mother_name" placeholder="MOTHER NAME" {...register("mother_name")} className={classNames({ "p-invalid": errors.mother_name })} />
        </Field>
        <Field label="Father Name" htmlFor="father_name" error={errors.father_name?.message}>
          <InputText id="father_name" placeholder="FATHER NAME" {...register("father_name")} className={classNames({ "p-invalid": errors.father_name })} />
        </Field>
        <Field label="Marital Status" htmlFor="marital_status" required error={errors.marital_status?.message}>
          <Controller
            name="marital_status"
            control={control}
            render={({ field }) => (
              <Dropdown inputId="marital_status" value={field.value} options={opts(MASTER_DATA.marital_statuses)} onChange={(e) => field.onChange(e.value)} onBlur={field.onBlur} placeholder="Select marital status" className={classNames({ "p-invalid": errors.marital_status })} />
            )}
          />
        </Field>
        <Field label="Spouse Name" htmlFor="spouse_name" error={errors.spouse_name?.message}>
          <InputText id="spouse_name" placeholder="SPOUSE NAME" disabled={marital !== "MARRIED"} {...register("spouse_name")} className={classNames({ "p-invalid": errors.spouse_name })} />
        </Field>

        <Field label="Address" htmlFor="address" required error={errors.address?.message} className="span-2">
          <InputTextarea id="address" rows={2} autoResize maxLength={250} {...register("address")} className={classNames({ "p-invalid": errors.address })} />
        </Field>

        <Field label="State" htmlFor="state" required error={errors.state?.message}>
          <Controller
            name="state"
            control={control}
            render={({ field }) => (
              <Dropdown
                inputId="state"
                value={field.value}
                options={opts(MASTER_DATA.states)}
                onChange={(e) => {
                  field.onChange(e.value);
                  setValue("city", ""); // city options depend on state
                }}
                onBlur={field.onBlur}
                placeholder="Select state"
                className={classNames({ "p-invalid": errors.state })}
              />
            )}
          />
        </Field>
        <Field label="City / District" htmlFor="city" required error={errors.city?.message}>
          <Controller
            name="city"
            control={control}
            render={({ field }) => (
              <Dropdown inputId="city" value={field.value} options={opts(MASTER_DATA.districts[state] ?? [])} onChange={(e) => field.onChange(e.value)} onBlur={field.onBlur} filter placeholder={state ? "Select city / district" : "Select a state first"} disabled={!state} className={classNames({ "p-invalid": errors.city })} />
            )}
          />
        </Field>

        <Field label="Pincode" htmlFor="pincode" required error={errors.pincode?.message}>
          <InputText id="pincode" keyfilter="int" maxLength={6} inputMode="numeric" placeholder="PINCODE" {...register("pincode")} className={classNames({ "p-invalid": errors.pincode })} />
        </Field>
        <Field
          label="Aadhaar No"
          htmlFor="aadhaar_no"
          required={!aadhaarOnFile}
          error={errors.aadhaar_no?.message}
          hint={aadhaarOnFile ? "Saved. Type a new number only if you need to replace it." : "12 digits. Stored encrypted; only the last 4 digits are shown after saving."}
        >
          <div className="input-with-action">
            <Controller
              name="aadhaar_no"
              control={control}
              render={({ field }) => (
                <InputMask id="aadhaar_no" mask="9999 9999 9999" slotChar=" " autoClear={false} value={field.value} onChange={(e) => field.onChange(e.target.value ?? "")} onBlur={field.onBlur} placeholder={aadhaarOnFile ? maskAadhaar(last4) : "XXXX XXXX XXXX"} className={classNames({ "p-invalid": errors.aadhaar_no })} />
              )}
            />
            {aadhaarOnFile && <Tag value={maskAadhaar(last4)} icon="pi pi-lock" severity="info" />}
          </div>
        </Field>

        <Field label="Address Proof" htmlFor="address_proof" required error={errors.address_proof?.message}>
          <Controller
            name="address_proof"
            control={control}
            render={({ field }) => (
              <DocumentUpload id="address_proof" docType="ADDRESS_PROOF" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.address_proof} onError={(m) => (m ? setError("address_proof", { message: m }) : form.clearErrors("address_proof"))} />
            )}
          />
        </Field>
        <Field label="Mailing Address" htmlFor="mailing_address" error={errors.mailing_address?.message}>
          <Controller
            name="mailing_same"
            control={control}
            render={({ field }) => (
              <div className="check-line compact">
                <Checkbox inputId="mailing_same" checked={!!field.value} onChange={(e) => field.onChange(!!e.checked)} />
                <label htmlFor="mailing_same">Same as address</label>
              </div>
            )}
          />
          <InputTextarea id="mailing_address" rows={2} autoResize maxLength={250} disabled={!!mailingSame} {...register("mailing_address")} className={classNames({ "p-invalid": errors.mailing_address })} />
        </Field>

        {numberField("height_cm", "Height (cm)", 50, 250)}
        {numberField("weight_kg", "Weight (kg)", 15, 200)}
        {sizeField("track_suit_size", "Track Suit Size")}
        {sizeField("tshirt_size", "T-Shirt Size")}
        {numberField("shoe_size_uk", "Shoe Size (UK)", 1, 15)}
      </div>

      {isLast && <SubmitSection form={final.form} isMinor={false} staff />}

      <div className="step-actions">
        <Button type="button" label="Previous" className="btn-outline-dark" onClick={onPrevious} disabled={!!saving || final.submitting} />
        <Button type="button" label="Save For Later" className="btn-dark" onClick={saveDraft} loading={saving === "draft"} disabled={!!saving || final.submitting} />
        {isLast ? (
          <Button type="button" label="Submit profile" icon="pi pi-send" className="btn-primary" onClick={final.submit} loading={saving === "complete" || final.submitting} />
        ) : (
          <Button type="button" label="Next" className="btn-dark" onClick={async () => (await saveComplete()) && onNext()} loading={saving === "complete"} disabled={!!saving} />
        )}
      </div>
    </form>
  );
}
