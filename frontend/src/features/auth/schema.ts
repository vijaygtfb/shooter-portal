import { z } from "zod";
import { ALWAYS_REFINE } from "@/features/registration/schemas/fields";
import { EMAIL_MAX, passwordProblems } from "@/lib/validators";

/** Roles and account states (REQUIREMENTS §16.1). Must match the backend StrEnums exactly. */
export const ROLES = ["STUDENT", "COACH", "DISTRICT_SECRETARY", "SUPER_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Student",
  COACH: "Coach",
  DISTRICT_SECRETARY: "District Secretary",
  SUPER_ADMIN: "Super Admin",
};

/** Roles a person can pick on the Register screen. Super Admin is seeded, never self-registered. */
export const SELF_REGISTER_ROLES = ["STUDENT", "COACH", "DISTRICT_SECRETARY"] as const;

export const ACCOUNT_STATUSES = ["ACTIVE", "PENDING_ACTIVATION", "REJECTED", "DEACTIVATED"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const currentUserSchema = z.object({
  user_id: z.string(),
  email: z.string(),
  role: z.enum(ROLES),
  account_status: z.enum(ACCOUNT_STATUSES),
  full_name: z.string().nullable(),
  state_code: z.string().nullable(),
  district_code: z.string().nullable(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

export const tokenResponseSchema = z.object({ access_token: z.string(), user: currentUserSchema });

export const registerResponseSchema = z.object({
  account_status: z.enum(ACCOUNT_STATUSES),
  access_token: z.string().nullable(),
  user: currentUserSchema.nullable(),
});

export const otpSentSchema = z.object({
  message: z.string(),
  expires_in: z.number(),
  resend_in: z.number(),
  /** Demo mode only: lets the presenter see the OTP without a real email/SMS. */
  demo_otp: z.string().optional(),
});

export const emailVerifiedSchema = z.object({ email_verification_token: z.string() });
export const messageSchema = z.object({ message: z.string() });
export const captchaSchema = z.object({ captcha_id: z.string(), image_base64: z.string() });

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .max(EMAIL_MAX, "Email is too long")
  .pipe(z.email("Enter a valid email address"));

export const otpSchema = z.object({ otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit OTP") });

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required"),
});
export type LoginValues = z.infer<typeof loginSchema>;

type RefineCtx = z.RefinementCtx;

function checkPasswords(v: { password: string; confirm_password: string }, email: string | undefined, c: RefineCtx) {
  const problems = passwordProblems(String(v.password ?? ""), typeof email === "string" ? email : undefined);
  if (problems.length) {
    c.addIssue({ code: "custom", path: ["password"], message: `Password needs: ${problems.join(", ")}` });
  }
  if (v.confirm_password !== v.password) {
    c.addIssue({ code: "custom", path: ["confirm_password"], message: "Passwords do not match" });
  }
}

export const registerSchema = z
  .object({
    role: z.enum(SELF_REGISTER_ROLES, { error: "Choose how you are registering" }),
    email: emailField,
    password: z.string(),
    confirm_password: z.string(),
    full_name: z.string().trim().max(100).optional(),
    state_code: z.string().optional(),
    district_code: z.string().optional(),
  })
  .superRefine((v, c) => {
    checkPasswords(v, v.email, c);
    if (v.role === "STUDENT") return;
    if (!v.full_name || v.full_name.length < 2) c.addIssue({ code: "custom", path: ["full_name"], message: "Full name is required" });
    if (!v.state_code) c.addIssue({ code: "custom", path: ["state_code"], message: "Select a state" });
    if (!v.district_code) c.addIssue({ code: "custom", path: ["district_code"], message: "Select the district you serve" });
  }, ALWAYS_REFINE);
export type RegisterValues = z.input<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: emailField,
  captcha_answer: z.string().regex(/^\d{5}$/, "Enter the 5 digits shown in the image"),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({ password: z.string(), confirm_password: z.string() })
  .superRefine((v, c) => checkPasswords(v, undefined, c), ALWAYS_REFINE);
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
