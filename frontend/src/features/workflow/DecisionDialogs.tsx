import { useEffect } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { RadioButton } from "primereact/radiobutton";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { classNames } from "primereact/utils";
import { Field } from "@/components/Field";
import { DEFAULT_REJECTION_TYPE, MASTER_DATA } from "@/features/masterData/data";
import { formatDate, idCardExpiry, todayIst } from "@/lib/dates";
import {
  coachApproveSchema,
  districtApproveSchema,
  NOTES_MAX,
  REJECT_NOTES_MIN,
  rejectSchema,
  type CoachApproveValues,
  type DistrictApproveValues,
  type RejectValues,
} from "./schema";

interface BaseProps {
  visible: boolean;
  studentName: string;
  onHide: () => void;
}

function Counter({ value, min, max }: { value: string; min?: number; max: number }) {
  const n = value.trim().length;
  const short = min !== undefined && n < min;
  return (
    <small className={classNames("counter", { short })} aria-live="polite">
      {n}/{max}
      {short && ` (at least ${min})`}
    </small>
  );
}

/** Coach approval: ID card validity (1 or 2 years, required) + optional notes (REQUIREMENTS §16.3). */
export function CoachApproveDialog({ visible, studentName, onHide, onConfirm }: BaseProps & { onConfirm: (v: CoachApproveValues) => Promise<void> }) {
  const { control, register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CoachApproveValues>({
    resolver: zodResolver(coachApproveSchema) as Resolver<CoachApproveValues>,
    defaultValues: { notes: "" },
  });
  useEffect(() => {
    if (visible) reset({ notes: "" });
  }, [visible, reset]);
  const notes = useWatch({ control, name: "notes" }) ?? "";

  return (
    <Dialog header={`Approve ${studentName}`} visible={visible} onHide={onHide} modal style={{ width: "32rem" }} breakpoints={{ "640px": "95vw" }}>
      <form onSubmit={handleSubmit(onConfirm)} noValidate className="form">
        <fieldset className="plain-fieldset" aria-describedby="validity_years-error">
          <legend className="field-label">
            ID card validity<span className="req"> *</span>
          </legend>
          <Controller
            name="validity_years"
            control={control}
            render={({ field }) => (
              <div className="choice-row">
                {[1, 2].map((y) => (
                  <label key={y} className="choice">
                    <RadioButton inputId={`validity_${y}`} name="validity_years" value={y} checked={field.value === y} onChange={(e) => field.onChange(e.value)} className={classNames({ "p-invalid": errors.validity_years })} />
                    {y} year{y > 1 ? "s" : ""}
                  </label>
                ))}
              </div>
            )}
          />
          <small id="validity_years-error" className="p-error" aria-live="polite">{errors.validity_years?.message ?? ""}</small>
          <small className="field-hint">The expiry date is counted from the day the District Secretary approves.</small>
        </fieldset>
        <Field label="Notes (optional)" htmlFor="approve_notes" error={errors.notes?.message}>
          <InputTextarea id="approve_notes" rows={3} autoResize maxLength={NOTES_MAX} {...register("notes")} className={classNames({ "p-invalid": errors.notes })} />
          <Counter value={notes} max={NOTES_MAX} />
        </Field>
        <div className="dialog-actions">
          <Button type="button" label="Cancel" text onClick={onHide} />
          <Button type="submit" label="Approve" icon="pi pi-check" severity="success" loading={isSubmitting} />
        </div>
      </form>
    </Dialog>
  );
}

/** District approval: optional notes. Shows the Shooter ID expiry that will be set. */
export function DistrictApproveDialog({ visible, studentName, validityYears, onHide, onConfirm }: BaseProps & { validityYears: number | null; onConfirm: (v: DistrictApproveValues) => Promise<void> }) {
  const { control, register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DistrictApproveValues>({
    resolver: zodResolver(districtApproveSchema) as Resolver<DistrictApproveValues>,
    defaultValues: { notes: "" },
  });
  useEffect(() => {
    if (visible) reset({ notes: "" });
  }, [visible, reset]);
  const notes = useWatch({ control, name: "notes" }) ?? "";
  const years = validityYears ?? 1;

  return (
    <Dialog header={`Approve ${studentName}`} visible={visible} onHide={onHide} modal style={{ width: "32rem" }} breakpoints={{ "640px": "95vw" }}>
      <form onSubmit={handleSubmit(onConfirm)} noValidate className="form">
        <Message
          severity="info"
          className="w-full"
          text={`A Shooter ID (SAT + 9 digits) will be issued. Validity set by the Coach: ${years} year${years > 1 ? "s" : ""}, so the card will be valid till ${formatDate(idCardExpiry(todayIst(), years))}.`}
        />
        <Field label="Notes (optional)" htmlFor="district_notes" error={errors.notes?.message}>
          <InputTextarea id="district_notes" rows={3} autoResize maxLength={NOTES_MAX} {...register("notes")} className={classNames({ "p-invalid": errors.notes })} />
          <Counter value={notes} max={NOTES_MAX} />
        </Field>
        <div className="dialog-actions">
          <Button type="button" label="Cancel" text onClick={onHide} />
          <Button type="submit" label="Approve and issue ID" icon="pi pi-verified" severity="success" loading={isSubmitting} />
        </div>
      </form>
    </Dialog>
  );
}

/** Rejection (Coach or District): type defaults to Document Issue; notes required, min 25 characters (§16.3.1). */
export function RejectDialog({ visible, studentName, onHide, onConfirm }: BaseProps & { onConfirm: (v: RejectValues) => Promise<void> }) {
  const { control, register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RejectValues>({
    resolver: zodResolver(rejectSchema) as Resolver<RejectValues>,
    mode: "onTouched",
    defaultValues: { rejection_type: DEFAULT_REJECTION_TYPE, notes: "" },
  });
  useEffect(() => {
    if (visible) reset({ rejection_type: DEFAULT_REJECTION_TYPE, notes: "" });
  }, [visible, reset]);
  const notes = useWatch({ control, name: "notes" }) ?? "";
  const tooShort = notes.trim().length < REJECT_NOTES_MIN;

  return (
    <Dialog header={`Reject ${studentName}`} visible={visible} onHide={onHide} modal style={{ width: "34rem" }} breakpoints={{ "640px": "95vw" }}>
      <form onSubmit={handleSubmit(onConfirm)} noValidate className="form">
        <p className="muted small">The student will receive an email and will see this reason when they log in.</p>
        <Field label="Rejection Type" htmlFor="rejection_type" required error={errors.rejection_type?.message}>
          <Controller
            name="rejection_type"
            control={control}
            render={({ field }) => (
              <Dropdown inputId="rejection_type" value={field.value} options={MASTER_DATA.rejection_types.map((o) => ({ label: o.label, value: o.code }))} onChange={(e) => field.onChange(e.value)} className={classNames({ "p-invalid": errors.rejection_type })} />
            )}
          />
        </Field>
        <Field label="Notes" htmlFor="reject_notes" required error={errors.notes?.message}>
          <InputTextarea id="reject_notes" rows={4} autoResize maxLength={NOTES_MAX} placeholder="Explain what is wrong and what the student should do" {...register("notes")} className={classNames({ "p-invalid": errors.notes })} />
          <Counter value={notes} min={REJECT_NOTES_MIN} max={NOTES_MAX} />
        </Field>
        <div className="dialog-actions">
          <Button type="button" label="Cancel" text onClick={onHide} />
          <Button type="submit" label="Reject" icon="pi pi-times" severity="danger" loading={isSubmitting} disabled={tooShort} />
        </div>
      </form>
    </Dialog>
  );
}
