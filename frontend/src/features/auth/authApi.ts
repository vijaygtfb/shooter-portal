import { z } from "zod";
import { apiRequest } from "@/lib/apiClient";
import {
  captchaSchema,
  currentUserSchema,
  emailVerifiedSchema,
  messageSchema,
  otpSentSchema,
  registerResponseSchema,
  tokenResponseSchema,
} from "./schema";

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const sendEmailOtp = (email: string) => apiRequest("/auth/email/send-otp", otpSentSchema, post({ email }));

export const verifyEmailOtp = (email: string, otp: string) =>
  apiRequest("/auth/email/verify-otp", emailVerifiedSchema, post({ email, otp }));

export const registerAccount = (payload: {
  email_verification_token: string;
  password: string;
  role: string;
  full_name?: string;
  state_code?: string;
  district_code?: string;
}) => apiRequest("/auth/register", registerResponseSchema, post(payload));

export const login = (email: string, password: string) =>
  apiRequest("/auth/login", tokenResponseSchema, post({ email, password }));

export const fetchMe = () => apiRequest("/auth/me", currentUserSchema);

export const logout = () => apiRequest("/auth/logout", z.null(), { method: "POST" });

export const fetchCaptcha = () => apiRequest("/auth/captcha", captchaSchema);

export const forgotPassword = (email: string, captcha_id: string, captcha_answer: string) =>
  apiRequest("/auth/forgot-password", messageSchema, post({ email, captcha_id, captcha_answer }));

export const resetPassword = (token: string, new_password: string) =>
  apiRequest("/auth/reset-password", messageSchema, post({ token, new_password }));

export const sendMobileOtp = (mobile: string) =>
  apiRequest("/verification/mobile/send-otp", otpSentSchema, post({ mobile }));

export const verifyMobileOtp = (mobile: string, otp: string) =>
  apiRequest("/verification/mobile/verify-otp", messageSchema, post({ mobile, otp }));
