import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { classNames } from "primereact/utils";
import { AuthLayout } from "@/components/AuthLayout";
import { Field } from "@/components/Field";
import { config } from "@/config";
import { errorMessage } from "@/lib/apiClient";
import * as authApi from "./authApi";
import { forgotPasswordSchema, type ForgotPasswordValues } from "./schema";

/** Forgot password with captcha (REQUIREMENTS §2.3, docs/ui-reference/02-forgot-password-captcha.png). */
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [captcha, setCaptcha] = useState<{ captcha_id: string; image_base64: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), mode: "onTouched", defaultValues: { email: "", captcha_answer: "" } });

  const loadCaptcha = useCallback(async () => {
    try {
      setCaptcha(await authApi.fetchCaptcha());
      setValue("captcha_answer", "");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [setValue]);

  useEffect(() => {
    void loadCaptcha();
  }, [loadCaptcha]);

  const onSubmit = async (v: ForgotPasswordValues) => {
    if (!captcha) return;
    setError(null);
    try {
      const r = await authApi.forgotPassword(v.email, captcha.captcha_id, v.captcha_answer);
      setDone(r.message);
    } catch (err) {
      setError(errorMessage(err));
      void loadCaptcha(); // captchas are single-use
    }
  };

  return (
    <AuthLayout title="Forgot Password?">
      {done ? (
        <div className="form">
          <Message severity="success" text={done} className="w-full" />
          {config.useMockApi && (
            <p className="demo-hint">
              Demo: the reset link is in the <Link to="/demo/mailbox">demo mailbox</Link>.
            </p>
          )}
          <Button label="Back to login" className="btn-primary" onClick={() => navigate("/login")} />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="form">
          <p className="lead">Enter your e-mail address below to reset your password.</p>
          {error && <Message severity="error" text={error} className="w-full" />}
          <Field label="Email" htmlFor="email" required error={errors.email?.message}>
            <InputText id="email" type="email" {...register("email")} className={classNames({ "p-invalid": errors.email })} />
          </Field>
          <Field label="Captcha" htmlFor="captcha_answer" required error={errors.captcha_answer?.message}>
            <div className="captcha-row">
              <span className="captcha-img">
                {captcha ? <img src={captcha.image_base64} alt="Captcha: type the 5 digits shown" width={150} height={48} /> : "Loading..."}
              </span>
              <Button type="button" icon="pi pi-refresh" text aria-label="Get a new captcha" onClick={loadCaptcha} />
              <InputText
                id="captcha_answer"
                keyfilter="int"
                maxLength={5}
                placeholder="CAPTCHA"
                autoComplete="off"
                {...register("captcha_answer")}
                className={classNames({ "p-invalid": errors.captcha_answer })}
              />
            </div>
          </Field>
          <div className="row-between">
            <Button type="submit" label="Send Password Reset Link" loading={isSubmitting} className="btn-navy" />
            <Button type="button" label="Back To Login" className="btn-navy" onClick={() => navigate("/login")} />
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
