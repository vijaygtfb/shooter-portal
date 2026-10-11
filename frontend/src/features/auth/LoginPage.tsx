import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputText } from "primereact/inputtext";
import { Password } from "primereact/password";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { classNames } from "primereact/utils";
import { AuthLayout } from "@/components/AuthLayout";
import { Field } from "@/components/Field";
import { DemoAccounts } from "@/features/demo/DemoAccounts";
import { errorMessage } from "@/lib/apiClient";
import { homePath, useAuth } from "./AuthContext";
import { loginSchema, type LoginValues } from "./schema";
import { Controller } from "react-hook-form";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), mode: "onTouched", defaultValues: { email: "", password: "" } });

  if (user) return <Navigate to={homePath(user.role)} replace />;

  const onSubmit = async (v: LoginValues) => {
    setError(null);
    try {
      const u = await login(v.email, v.password);
      navigate(homePath(u.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthLayout
      title="Log in"
      subtitle="Students, Coaches, District Secretaries and Super Admin use the same login."
      aside={
        <DemoAccounts
          onPick={(email, password) => {
            setValue("email", email, { shouldValidate: true });
            setValue("password", password, { shouldValidate: true });
          }}
        />
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="form">
        {error && <Message severity="error" text={error} className="w-full" />}
        <Field label="Email" htmlFor="email" required error={errors.email?.message}>
          <InputText id="email" type="email" autoComplete="username" {...register("email")} className={classNames({ "p-invalid": errors.email })} />
        </Field>
        <Field label="Password" htmlFor="password" required error={errors.password?.message}>
          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <Password
                inputId="password"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                feedback={false}
                toggleMask
                autoComplete="current-password"
                className={classNames("w-full", { "p-invalid": errors.password })}
                inputClassName="w-full"
              />
            )}
          />
        </Field>
        <div className="row-between">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <Button type="submit" label="Log in" icon="pi pi-sign-in" loading={isSubmitting} className="btn-primary w-full" />
        <p className="center muted">
          New shooter or staff member? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
