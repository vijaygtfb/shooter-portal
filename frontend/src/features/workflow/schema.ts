import { z } from "zod";
import { ROLES } from "@/features/auth/schema";
import { DEFAULT_REJECTION_TYPE, MAIN_EVENTS, REJECTION_TYPES } from "@/features/masterData/data";
import { REG_STATUSES } from "@/features/registration/model";

/** Approve / reject contracts (REQUIREMENTS §16.3, §16.7). Mirrors the backend. */
export const REJECT_NOTES_MIN = 25;
export const NOTES_MAX = 500;

const optionalNotes = z
  .string()
  .trim()
  .max(NOTES_MAX, `Notes must be at most ${NOTES_MAX} characters`)
  .optional()
  .transform((s) => (s ? s : undefined));

export const coachApproveSchema = z.object({
  validity_years: z.union([z.literal(1), z.literal(2)], { error: "Choose ID card validity (1 or 2 years)" }),
  notes: optionalNotes,
});
export type CoachApproveValues = z.input<typeof coachApproveSchema>;

export const districtApproveSchema = z.object({ notes: optionalNotes });
export type DistrictApproveValues = z.input<typeof districtApproveSchema>;

export const rejectSchema = z.object({
  rejection_type: z.enum(REJECTION_TYPES, { error: "Select a rejection type" }).default(DEFAULT_REJECTION_TYPE),
  notes: z
    .string({ error: "Notes are required" })
    .trim()
    .min(REJECT_NOTES_MIN, `Notes must be at least ${REJECT_NOTES_MIN} characters`)
    .max(NOTES_MAX, `Notes must be at most ${NOTES_MAX} characters`),
});
export type RejectValues = z.input<typeof rejectSchema>;

export const studentListItemSchema = z.object({
  user_id: z.string(),
  name: z.string(),
  email: z.string(),
  registration_no: z.string().nullable(),
  status: z.enum(REG_STATUSES),
  main_event: z.enum(MAIN_EVENTS).nullable(),
  district_code: z.string().nullable(),
  coach_name: z.string().nullable(),
  submitted_at: z.string().nullable(),
  updated_at: z.string(),
  shooter_id: z.string().nullable(),
  id_expires_on: z.string().nullable(),
});
export type StudentListItem = z.infer<typeof studentListItemSchema>;
export const studentListSchema = z.array(studentListItemSchema);

export const coachOptionSchema = z.object({ user_id: z.string(), name: z.string(), district_code: z.string().nullable() });
export const coachOptionsSchema = z.array(coachOptionSchema);
export type CoachOption = z.infer<typeof coachOptionSchema>;

export const staffUserSchema = z.object({
  user_id: z.string(),
  email: z.string(),
  full_name: z.string().nullable(),
  role: z.enum(ROLES),
  account_status: z.enum(["ACTIVE", "PENDING_ACTIVATION", "REJECTED", "DEACTIVATED"]),
  state_code: z.string().nullable(),
  district_code: z.string().nullable(),
  created_at: z.string(),
});
export type StaffUser = z.infer<typeof staffUserSchema>;
export const staffUsersSchema = z.array(staffUserSchema);
