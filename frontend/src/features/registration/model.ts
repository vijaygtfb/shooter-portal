import { z } from "zod";
import { ROLES } from "@/features/auth/schema";
import { REJECTION_TYPES } from "@/features/masterData/data";
import { emptyStep1, type Step1Values } from "./schemas/step1";
import { emptyStep2, type Step2Values } from "./schemas/step2";
import { emptyStep3, type Step3Values } from "./schemas/step3";
import { emptySubmit, type SubmitValues } from "./schemas/submit";

/** Application statuses (REQUIREMENTS §6.2, §16.3). PROFILE_COMPLETE is used for staff profiles. */
export const REG_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "COACH_APPROVED",
  "COACH_REJECTED",
  "DISTRICT_APPROVED",
  "DISTRICT_REJECTED",
  "PROFILE_COMPLETE",
] as const;
export type RegStatus = (typeof REG_STATUSES)[number];

export const STATUS_LABELS: Record<RegStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Awaiting Coach",
  COACH_APPROVED: "Awaiting District",
  COACH_REJECTED: "Rejected by Coach",
  DISTRICT_APPROVED: "Approved",
  DISTRICT_REJECTED: "Rejected by District",
  PROFILE_COMPLETE: "Profile complete",
};

export const STATUS_SEVERITY: Record<RegStatus, "success" | "info" | "warning" | "danger" | "secondary"> = {
  DRAFT: "secondary",
  SUBMITTED: "info",
  COACH_APPROVED: "warning",
  COACH_REJECTED: "danger",
  DISTRICT_APPROVED: "success",
  DISTRICT_REJECTED: "danger",
  PROFILE_COMPLETE: "success",
};

export const HISTORY_ACTIONS = ["SUBMITTED", "RESUBMITTED", "COACH_APPROVED", "COACH_REJECTED", "DISTRICT_APPROVED", "DISTRICT_REJECTED"] as const;

export const historyEntrySchema = z.object({
  action: z.enum(HISTORY_ACTIONS),
  by_user_id: z.string(),
  by_role: z.enum(ROLES),
  by_name: z.string(),
  rejection_type: z.enum(REJECTION_TYPES).nullable().optional(),
  notes: z.string().nullable().optional(),
  validity_years: z.number().nullable().optional(),
  at: z.string(),
});
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

/** Step data comes back as a loose object; toValues() fills it onto the typed form defaults. */
const stepData = z.record(z.string(), z.unknown()).nullable();

export const registrationSchema = z.object({
  user_id: z.string(),
  role: z.enum(ROLES),
  email: z.string(),
  mobile_verified: z.boolean(),
  verified_mobile: z.string().nullable(),
  status: z.enum(REG_STATUSES),
  current_step: z.number().int().min(1).max(3),
  basic_info: stepData,
  personal_info: stepData,
  membership: stepData,
  submit_info: stepData,
  registration_no: z.string().nullable(),
  coach_user_id: z.string().nullable(),
  coach_name: z.string().nullable(),
  district_code: z.string().nullable(),
  validity_years: z.number().nullable(),
  coach_notes: z.string().nullable(),
  district_notes: z.string().nullable(),
  rejection_type: z.enum(REJECTION_TYPES).nullable(),
  rejection_notes: z.string().nullable(),
  rejected_by_role: z.enum(ROLES).nullable(),
  rejected_at: z.string().nullable(),
  shooter_id: z.string().nullable(),
  id_issued_on: z.string().nullable(),
  id_expires_on: z.string().nullable(),
  approval_history: z.array(historyEntrySchema),
  created_at: z.string(),
  updated_at: z.string(),
  submitted_at: z.string().nullable(),
});
export type Registration = z.infer<typeof registrationSchema>;

function toValues<T extends object>(empty: T, data: Record<string, unknown> | null): T {
  const out = { ...empty } as Record<string, unknown>;
  if (!data) return out as T;
  for (const key of Object.keys(empty)) {
    const v = data[key];
    if (v !== undefined && v !== null) out[key] = v;
  }
  return out as T;
}

export const step1Values = (r: Registration): Step1Values => toValues(emptyStep1, r.basic_info);
export const step2Values = (r: Registration): Step2Values => toValues(emptyStep2, r.personal_info);
export const step3Values = (r: Registration): Step3Values => toValues(emptyStep3, r.membership);
export const submitValues = (r: Registration): SubmitValues => toValues(emptySubmit, r.submit_info);

export function fullName(r: Registration): string {
  const b = step1Values(r);
  return [b.first_name, b.last_name].filter(Boolean).join(" ") || r.email;
}

/** Number of form steps for a role: students 3, everyone else 2 (REQUIREMENTS §16.2). */
export function stepCount(role: Registration["role"]): 2 | 3 {
  return role === "STUDENT" ? 3 : 2;
}

export const isRejected = (s: RegStatus) => s === "COACH_REJECTED" || s === "DISTRICT_REJECTED";
/** A student can edit a draft, or a rejected application to resubmit it (REQUIREMENTS §16.3.3). */
export const isStudentEditable = (s: RegStatus) => s === "DRAFT" || isRejected(s);
