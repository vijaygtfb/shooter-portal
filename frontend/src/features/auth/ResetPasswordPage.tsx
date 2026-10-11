import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Password } from "primereact/password";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { classNames } from "primereact/utils";
import { AuthLayout } from "@/components/AuthLayout";
import { Field } from "@/components/Field";
import { useToast } from "@/components/ToastProvider";
import { errorMessage } from "@/lib/apiClient";
import * as authApi from "./authApi";
import { resetPasswordSchema, type ResetPasswordValues } from "./schema";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), mode: "onTouched", defaultValues: { password: "", confirm_password: "" } });

  const onSubmit = async (v: ResetPasswordValues) => {
    setError(null);
    try {
      const r = await authApi.resetPassword(token, v.password);
      toast({ severity: "success", summary: "Password reset", detail: r.message });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const pw = (name: "password" | "confirm_password", label: string, feedback: boolean) => (
    <Field label={label} htmlFor={name} required error={errors[name]?.message}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Password
            inputId={name}
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            toggleMask
            feedback={feedback}
            autoComplete="new-password"
            className={classNames("w-full", { "p-invalid": errors[name] })}
            inputClassName="w-full"
          />
        )}
      />
    </Field>
  );

  return (
    <AuthLayout title="Set a new password">
      {!token ? (
        <Message severity="error" text="This reset link is invalid. Please request a new one." className="w-full" />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="form">
          {error && <Message severity="error" text={error} className="w-full" />}
          {pw("password", "New password", true)}
          {pw("confirm_password", "Confirm new password", false)}
          <Button type="submit" label="Reset password" loading={isSubmitting} className="btn-primary w-full" />
        </form>
      )}
      <p className="center muted mt-3">
        <Link to="/login">Back to login</Link>
      </p>
    </AuthLayout>
  );
}
