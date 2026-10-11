import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputText } from "primereact/inputtext";
import { Password } from "primereact/password";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { SelectButton } from "primereact/selectbutton";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";
import { classNames } from "primereact/utils";
import { AuthLayout } from "@/components/AuthLayout";
import { Field } from "@/components/Field";
import { useToast } from "@/components/ToastProvider";
import { MASTER_DATA } from "@/features/masterData/data";
import { errorMessage, fieldErrors } from "@/lib/apiClient";
import { homePath, useAuth } from "./AuthContext";
import * as authApi from "./authApi";
import { OtpDialog } from "./OtpDialog";
import { emailField, registerSchema, ROLE_LABELS, SELF_REGISTER_ROLES, type RegisterValues } from "./schema";

const roleOptions = SELF_REGISTER_ROLES.map((r) => ({ label: ROLE_LABELS[r], value: r }));
const stateOptions = MASTER_DATA.states.map((s) => ({ label: s.label, value: s.code }));

const PASSWORD_HINT = "8-64 characters with an uppercase letter, a lowercase letter, a digit and a special character.";

export function RegisterPage() {
  const { user, startSession } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [otpOpen, setOtpOpen] = useState(false);
  const [emailToken, setEmailToken] = useState<string | null>(null);
  const [pendingDone, setPendingDone] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    trigger,
    getValues,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: { role: "STUDENT", email: "", password: "", confirm_password: "", full_name: "", state_code: "MH", district_code: "" },
  });
  const role = useWatch({ control, name: "role" });
  const stateCode = useWatch({ control, name: "state_code" });
  const verified = emailToken !== null;
  const isStaff = role !== "STUDENT";

  if (user) return <Navigate to={homePath(user.role)} replace />;

  const onVerifyClick = async () => {
    if (await trigger("email")) setOtpOpen(true);
  };

  const email = () => emailField.parse(getValues("email"));

  const onSubmit = async (v: RegisterValues) => {
    if (!emailToken) return;
    setFormError(null);
    try {
      const res = await authApi.registerAccount({
        email_verification_token: emailToken,
        password: v.password,
        role: v.role,
        full_name: isStaff ? v.full_name : undefined,
        state_code: isStaff ? v.state_code : undefined,
        district_code: isStaff ? v.district_code : undefined,
      });
      if (res.access_token && res.user) {
        startSession(res.access_token, res.user);
        toast({ severity: "success", summary: "Account created", detail: "Now complete your application." });
        navigate("/application", { replace: true });
      } else {
        setPendingDone(ROLE_LABELS[v.role]);
      }
    } catch (err) {
      const fields = fieldErrors(err);
      fields.forEach((f) => setError(f.path as keyof RegisterValues, { message: f.message }));
      if (!fields.length) setFormError(errorMessage(err));
    }
  };

  if (pendingDone) {
    return (
      <AuthLayout title="Account created">
        <div className="pending-box">
          <i className="pi pi-hourglass" aria-hidden="true" />
          <h3>Awaiting Super Admin approval</h3>
          <p>
            Your {pendingDone} account has been created. You will be able to log in once the Super Admin activates it. We will email you when
            that happens.
          </p>
          <Button label="Back to login" className="btn-primary" onClick={() => navigate("/login")} />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Verify your email first. The other fields unlock after verification." wide>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="form">
        {formError && <Message severity="error" text={formError} className="w-full" />}

        <Field label="Register as" htmlFor="role" required error={errors.role?.message}>
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <SelectButton
                id="role"
                value={field.value}
                options={roleOptions}
                onChange={(e) => e.value && field.onChange(e.value)}
                allowEmpty={false}
                disabled={verified}
                className="role-select"
              />
            )}
          />
        </Field>
        {isStaff && (
          <Message
            severity="info"
            className="w-full"
            text={`${ROLE_LABELS[role]} accounts must be activated by the Super Admin before you can log in.`}
          />
        )}

        <Field label="Email ID" htmlFor="email" required error={errors.email?.message}>
          <div className="input-with-action">
            <InputText
              id="email"
              type="email"
              autoComplete="email"
              readOnly={verified}
              {...register("email")}
              className={classNames({ "p-invalid": errors.email })}
            />
            {verified ? (
              <Tag value="Verified" icon="pi pi-check" severity="success" />
            ) : (
              <Button type="button" label="Verify" onClick={onVerifyClick} className="btn-primary" />
            )}
          </div>
        </Field>

        <fieldset disabled={!verified} className="plain-fieldset form">
          {isStaff && (
            <>
              <Field label="Full name" htmlFor="full_name" required error={errors.full_name?.message}>
                <InputText id="full_name" {...register("full_name")} className={classNames({ "p-invalid": errors.full_name })} />
              </Field>
              <div className="grid-2">
                <Field label="State" htmlFor="state_code" required error={errors.state_code?.message}>
                  <Controller
                    name="state_code"
                    control={control}
                    render={({ field }) => (
                      <Dropdown
                        inputId="state_code"
                        value={field.value}
                        options={stateOptions}
                        onChange={(e) => {
                          field.onChange(e.value);
                          setValue("district_code", "");
                        }}
                        disabled={!verified}
                        className={classNames({ "p-invalid": errors.state_code })}
                      />
                    )}
                  />
                </Field>
                <Field label={role === "COACH" ? "District" : "District you serve"} htmlFor="district_code" required error={errors.district_code?.message}>
                  <Controller
                    name="district_code"
                    control={control}
                    render={({ field }) => (
                      <Dropdown
                        inputId="district_code"
                        value={field.value}
                        options={(MASTER_DATA.districts[stateCode ?? ""] ?? []).map((d) => ({ label: d.label, value: d.code }))}
                        onChange={(e) => field.onChange(e.value)}
                        onBlur={field.onBlur}
                        filter
                        placeholder="Select district"
                        disabled={!verified}
                        className={classNames({ "p-invalid": errors.district_code })}
                      />
                    )}
                  />
                </Field>
              </div>
            </>
          )}
          <div className="grid-2">
            <Field label="Password" htmlFor="password" required error={errors.password?.message} hint={PASSWORD_HINT}>
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <Password
                    inputId="password"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    toggleMask
                    disabled={!verified}
                    autoComplete="new-password"
                    className={classNames("w-full", { "p-invalid": errors.password })}
                    inputClassName="w-full"
                  />
                )}
              />
            </Field>
            <Field label="Confirm password" htmlFor="confirm_password" required error={errors.confirm_password?.message}>
              <Controller
                name="confirm_password"
                control={control}
                render={({ field }) => (
                  <Password
                    inputId="confirm_password"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    feedback={false}
                    toggleMask
                    disabled={!verified}
                    autoComplete="new-password"
                    className={classNames("w-full", { "p-invalid": errors.confirm_password })}
                    inputClassName="w-full"
                  />
                )}
              />
            </Field>
          </div>
          <Button type="submit" label="Create account" icon="pi pi-user-plus" loading={isSubmitting} disabled={!verified} className="btn-primary w-full" />
        </fieldset>
        <p className="center muted">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </form>

      <OtpDialog
        visible={otpOpen}
        target={getValues("email")}
        send={() => authApi.sendEmailOtp(email())}
        verify={async (otp) => {
          const r = await authApi.verifyEmailOtp(email(), otp);
          setEmailToken(r.email_verification_token);
        }}
        onVerified={() => {
          setOtpOpen(false);
          toast({ severity: "success", summary: "Email verified" });
        }}
        onHide={() => setOtpOpen(false)}
      />
    </AuthLayout>
  );
}
