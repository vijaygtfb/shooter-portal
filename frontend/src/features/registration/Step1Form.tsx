import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { RadioButton } from "primereact/radiobutton";
import { Checkbox } from "primereact/checkbox";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { classNames } from "primereact/utils";
import { DateInput } from "@/components/DateInput";
import { Field } from "@/components/Field";
import { useToast } from "@/components/ToastProvider";
import * as authApi from "@/features/auth/authApi";
import { OtpDialog } from "@/features/auth/OtpDialog";
import { DocumentUpload } from "@/features/documents/DocumentUpload";
import type { DocType } from "@/features/documents/schema";
import { MASTER_DATA } from "@/features/masterData/data";
import { todayIst } from "@/lib/dates";
import { maskMobile, MOBILE_RE } from "@/lib/validators";
import { step1Values, type Registration } from "./model";
import { step1Schema, type Step1Values } from "./schemas/step1";
import { useStepSave } from "./useStepSave";

const opts = (list: { code: string; label: string }[]) => list.map((o) => ({ label: o.label, value: o.code }));

export function Step1Form({
  registration,
  onSaved,
  onNext,
}: {
  registration: Registration;
  onSaved: (r: Registration) => void;
  onNext: () => void;
}) {
  const toast = useToast();
  const form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema("complete")) as Resolver<Step1Values>,
    mode: "onTouched",
    defaultValues: step1Values(registration),
  });
  const { register, control, setValue, getValues, setError, trigger, formState: { errors } } = form;
  const { saveDraft, saveComplete, saving } = useStepSave(1, form, step1Schema("draft"), onSaved);
  const [otpOpen, setOtpOpen] = useState(false);
  const [verifiedMobile, setVerifiedMobile] = useState(registration.verified_mobile);

  const mobile = useWatch({ control, name: "mobile" });
  const mobileVerified = !!mobile && verifiedMobile === `+91${mobile}`;

  const onVerifyMobile = async () => {
    if (!MOBILE_RE.test(getValues("mobile"))) {
      await trigger("mobile");
      return;
    }
    setOtpOpen(true);
  };

  const onNextClick = async () => {
    if (!mobileVerified) {
      setError("mobile", { message: "Please verify your mobile number" });
      return;
    }
    if (await saveComplete()) onNext();
  };

  const upload = (name: "birth_proof" | "profile_photo" | "action_photo", docType: DocType, label: string, required: boolean) => (
    <Field label={label} htmlFor={name} required={required} error={errors[name]?.message}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <DocumentUpload
            id={name}
            docType={docType}
            value={field.value}
            onChange={(v) => field.onChange(v)}
            onBlur={field.onBlur}
            invalid={!!errors[name]}
            removable={!required}
            onError={(m) => (m ? setError(name, { message: m }) : form.clearErrors(name))}
          />
        )}
      />
    </Field>
  );

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="step-form">
      <h2 className="step-title">Basic Info</h2>
      <div className="grid-2">
        <Field label="State / Unit of Representation" htmlFor="state_unit" required error={errors.state_unit?.message}>
          <Controller
            name="state_unit"
            control={control}
            render={({ field }) => (
              <Dropdown inputId="state_unit" value={field.value} options={opts(MASTER_DATA.state_units)} onChange={(e) => field.onChange(e.value)} onBlur={field.onBlur} placeholder="Select state / unit" className={classNames({ "p-invalid": errors.state_unit })} />
            )}
          />
        </Field>
        <div className="grid-2 tight">
          <Field label="First Name" htmlFor="first_name" required error={errors.first_name?.message}>
            <InputText id="first_name" placeholder="FIRST NAME" {...register("first_name")} className={classNames({ "p-invalid": errors.first_name })} />
          </Field>
          <Field label="Last Name" htmlFor="last_name" error={errors.last_name?.message}>
            <InputText id="last_name" placeholder="LAST NAME" {...register("last_name")} className={classNames({ "p-invalid": errors.last_name })} />
          </Field>
        </div>

        <fieldset className={classNames("choice-box", { invalid: errors.main_event })} aria-describedby="main_event-error">
          <legend className="field-label">
            Main Event (to be reflected in ID card)<span className="req"> *</span>
          </legend>
          <Controller
            name="main_event"
            control={control}
            render={({ field }) => (
              <div className="choice-row">
                {MASTER_DATA.main_events.map((ev) => (
                  <label key={ev.code} className="choice">
                    <RadioButton
                      inputId={`main_event_${ev.code}`}
                      name="main_event"
                      value={ev.code}
                      checked={field.value === ev.code}
                      onChange={(e) => {
                        field.onChange(e.value);
                        const events = getValues("playing_events");
                        if (!events.includes(e.value)) setValue("playing_events", [...events, e.value], { shouldValidate: true });
                      }}
                    />
                    {ev.label.toUpperCase()}
                  </label>
                ))}
              </div>
            )}
          />
          <small id="main_event-error" className="p-error" aria-live="polite">{errors.main_event?.message ?? ""}</small>
        </fieldset>

        <fieldset className={classNames("choice-box", { invalid: errors.playing_events })} aria-describedby="playing_events-error">
          <legend className="field-label">
            Playing Events<span className="req"> *</span>
          </legend>
          <Controller
            name="playing_events"
            control={control}
            render={({ field }) => (
              <div className="choice-row">
                {MASTER_DATA.main_events.map((ev) => (
                  <label key={ev.code} className="choice">
                    <Checkbox
                      inputId={`playing_${ev.code}`}
                      value={ev.code}
                      checked={field.value.includes(ev.code)}
                      onChange={(e) => {
                        const next = e.checked ? [...field.value, ev.code] : field.value.filter((x) => x !== ev.code);
                        field.onChange(next);
                        void trigger("playing_events");
                      }}
                    />
                    {ev.label.toUpperCase()}
                  </label>
                ))}
              </div>
            )}
          />
          <small id="playing_events-error" className="p-error" aria-live="polite">{errors.playing_events?.message ?? ""}</small>
        </fieldset>

        <Field label="Education" htmlFor="education" error={errors.education?.message}>
          <InputText id="education" placeholder="EDUCATION" {...register("education")} className={classNames({ "p-invalid": errors.education })} />
        </Field>
        <Field label="Date of Birth" htmlFor="dob" required error={errors.dob?.message}>
          <Controller
            name="dob"
            control={control}
            render={({ field }) => <DateInput id="dob" value={field.value} onChange={field.onChange} onBlur={field.onBlur} maxDate={todayIst()} invalid={!!errors.dob} />}
          />
        </Field>

        {upload("birth_proof", "BIRTH_PROOF", "Birth Proof", true)}
        <Field label="Place of Birth" htmlFor="place_of_birth" required error={errors.place_of_birth?.message}>
          <InputText id="place_of_birth" placeholder="PLACE OF BIRTH" {...register("place_of_birth")} className={classNames({ "p-invalid": errors.place_of_birth })} />
        </Field>

        <Field label="Email ID" htmlFor="email" required>
          <div className="input-with-action">
            <InputText id="email" value={registration.email} readOnly />
            <Tag value="Verified" icon="pi pi-check" severity="success" />
          </div>
        </Field>
        <Field label="Mobile Number" htmlFor="mobile" required error={errors.mobile?.message} hint={!mobileVerified ? "Verify your mobile number to continue." : undefined}>
          <div className="input-with-action">
            <InputText id="mobile" keyfilter="int" maxLength={10} placeholder="MOBILE NUMBER" inputMode="numeric" {...register("mobile")} className={classNames({ "p-invalid": errors.mobile })} />
            {mobileVerified ? (
              <Tag value="Verified" icon="pi pi-check" severity="success" />
            ) : (
              <Button type="button" label="Verify" className="btn-primary" onClick={onVerifyMobile} />
            )}
          </div>
        </Field>

        <Field label="Alt. Contact Number" htmlFor="alt_mobile" error={errors.alt_mobile?.message}>
          <InputText id="alt_mobile" keyfilter="int" maxLength={10} placeholder="ALTERNATE CONTACT NUMBER" inputMode="numeric" {...register("alt_mobile")} className={classNames({ "p-invalid": errors.alt_mobile })} />
        </Field>
        <Field label="Gender" htmlFor="gender" required error={errors.gender?.message}>
          <Controller
            name="gender"
            control={control}
            render={({ field }) => (
              <Dropdown inputId="gender" value={field.value} options={opts(MASTER_DATA.genders)} onChange={(e) => field.onChange(e.value)} onBlur={field.onBlur} placeholder="SELECT GENDER" className={classNames({ "p-invalid": errors.gender })} />
            )}
          />
        </Field>

        {upload("profile_photo", "PROFILE_PHOTO", "Profile Photo", true)}
        {upload("action_photo", "ACTION_PHOTO", "Action Photo", false)}
      </div>

      <div className="step-actions">
        <Button type="button" label="Save For Later" className="btn-dark" onClick={saveDraft} loading={saving === "draft"} disabled={!!saving} />
        <Button type="button" label="Next" className="btn-dark" onClick={onNextClick} loading={saving === "complete"} disabled={!!saving || !mobileVerified} tooltip={!mobileVerified ? "Verify your mobile number first" : undefined} tooltipOptions={{ showOnDisabled: true, position: "top" }} />
      </div>

      <OtpDialog
        visible={otpOpen}
        target={mobile ? maskMobile(mobile) : ""}
        send={() => authApi.sendMobileOtp(getValues("mobile"))}
        verify={async (otp) => {
          await authApi.verifyMobileOtp(getValues("mobile"), otp);
          setVerifiedMobile(`+91${getValues("mobile")}`);
        }}
        onVerified={() => {
          setOtpOpen(false);
          form.clearErrors("mobile");
          toast({ severity: "success", summary: "Mobile number verified" });
        }}
        onHide={() => setOtpOpen(false)}
      />
    </form>
  );
}
