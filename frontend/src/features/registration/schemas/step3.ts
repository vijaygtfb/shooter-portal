import { z } from "zod";
import { docRefSchema, type DocRef } from "@/features/documents/schema";
import { WEAPON_TYPES } from "@/features/masterData/data";
import { PASSPORT_RE } from "@/lib/validators";
import { ageFrom, ALWAYS_REFINE, dropEmptyRows, isoDate, nameString, opt, req, today, type Mode, type SchemaContext } from "./fields";

/** Step 3 - Membership & Other Info (REQUIREMENTS §3.3, §16). Students only. */
export interface WeaponRow {
  type: string;
  make: string;
  model: string;
  caliber: string;
  serial_no: string;
}

export interface CoachRow {
  name: string;
  from: string;
  to: string;
}

export interface Step3Values {
  /** The Coach who approves this application (REQUIREMENTS §16.3). */
  coach_user_id: string;
  passport_number: string;
  passport_file: DocRef | null;
  passport_issue_date: string;
  passport_expiry_date: string;
  passport_issuing_authority: string;
  passport_place_of_issue: string;
  weapons: WeaponRow[];
  coaches: CoachRow[];
  non_criminal_cert: DocRef | null;
}

export interface Step3Context extends SchemaContext {
  /** Date of birth from Step 1, used for the age >= 18 certificate rule and date ranges. */
  dob?: string;
}

export const MAX_ROWS = 10;

export function step3Schema(mode: Mode, ctx?: Step3Context) {
  const weaponRow = z.object({
    type: req(mode, z.enum(WEAPON_TYPES, { error: "Select a weapon type" })),
    make: req(mode, z.string({ error: "Make is required" }).max(50, "Make must be at most 50 characters")),
    model: opt(z.string().max(50, "Model must be at most 50 characters")),
    caliber: opt(z.string().max(20, "Caliber must be at most 20 characters")),
    serial_no: req(mode, z.string({ error: "Serial no. is required" }).max(50, "Serial no. must be at most 50 characters")),
  });

  const coachRow = z.object({
    name: req(mode, nameString("Coach name", 2, 100)),
    from: req(mode, isoDate("From date")),
    to: opt(isoDate("To date")),
  });

  const rows = <S extends z.ZodType>(row: S, label: string) =>
    z.preprocess(dropEmptyRows, z.array(row).max(MAX_ROWS, `You can add up to ${MAX_ROWS} ${label}`).optional());

  return z
    .object({
      coach_user_id: req(mode, z.string({ error: "Select your coach" })),
      passport_number: opt(z.string().regex(PASSPORT_RE, "Enter a valid Indian passport number (e.g. J8369854)").transform((s) => s.toUpperCase())),
      passport_file: opt(docRefSchema),
      passport_issue_date: opt(isoDate("Date of issue")),
      passport_expiry_date: opt(isoDate("Date of expiry")),
      passport_issuing_authority: opt(z.string().max(100, "Issuing authority must be at most 100 characters")),
      passport_place_of_issue: opt(z.string().max(100, "Place of issue must be at most 100 characters")),
      weapons: rows(weaponRow, "weapons"),
      coaches: rows(coachRow, "coaches"),
      non_criminal_cert: opt(docRefSchema),
    })
    .superRefine((v, c) => {
      const now = today(ctx);
      const dob = ctx?.dob;

      // Passport becomes a group rule once a number is entered.
      if (mode === "complete" && v.passport_number) {
        const need: [keyof typeof v, string][] = [
          ["passport_file", "Upload the passport"],
          ["passport_issue_date", "Date of issue is required"],
          ["passport_expiry_date", "Date of expiry is required"],
          ["passport_issuing_authority", "Issuing authority is required"],
          ["passport_place_of_issue", "Place of issue is required"],
        ];
        for (const [field, message] of need) {
          if (!v[field]) c.addIssue({ code: "custom", path: [field], message });
        }
      }
      if (v.passport_issue_date) {
        if (v.passport_issue_date > now) c.addIssue({ code: "custom", path: ["passport_issue_date"], message: "Date of issue cannot be in the future" });
        if (dob && v.passport_issue_date < dob) c.addIssue({ code: "custom", path: ["passport_issue_date"], message: "Date of issue cannot be before date of birth" });
      }
      if (v.passport_issue_date && v.passport_expiry_date && v.passport_expiry_date <= v.passport_issue_date) {
        c.addIssue({ code: "custom", path: ["passport_expiry_date"], message: "Date of expiry must be after the date of issue" });
      }

      const serials = new Set<string>();
      (Array.isArray(v.weapons) ? v.weapons : []).forEach((w, i) => {
        const s = typeof w?.serial_no === "string" ? w.serial_no.trim().toUpperCase() : "";
        if (!s) return;
        if (serials.has(s)) c.addIssue({ code: "custom", path: ["weapons", i, "serial_no"], message: "Serial no. is repeated" });
        serials.add(s);
      });

      (Array.isArray(v.coaches) ? v.coaches : []).forEach((row, i) => {
        if (!row) return;
        if (row.from && row.from > now) c.addIssue({ code: "custom", path: ["coaches", i, "from"], message: "From date cannot be in the future" });
        if (row.from && dob && row.from < dob) c.addIssue({ code: "custom", path: ["coaches", i, "from"], message: "From date cannot be before date of birth" });
        if (row.to && row.to > now) c.addIssue({ code: "custom", path: ["coaches", i, "to"], message: "To date cannot be in the future" });
        if (row.to && row.from && row.to < row.from) c.addIssue({ code: "custom", path: ["coaches", i, "to"], message: "To date must be on or after the From date" });
      });

      const age = ageFrom(dob, ctx);
      if (mode === "complete" && age !== null && age >= 18 && !v.non_criminal_cert) {
        c.addIssue({ code: "custom", path: ["non_criminal_cert"], message: "Non-criminal certificate is required for applicants aged 18 or above" });
      }
    }, ALWAYS_REFINE);
}

export const emptyWeapon: WeaponRow = { type: "", make: "", model: "", caliber: "", serial_no: "" };
export const emptyCoach: CoachRow = { name: "", from: "", to: "" };

export const emptyStep3: Step3Values = {
  coach_user_id: "",
  passport_number: "",
  passport_file: null,
  passport_issue_date: "",
  passport_expiry_date: "",
  passport_issuing_authority: "",
  passport_place_of_issue: "",
  weapons: [],
  coaches: [],
  non_criminal_cert: null,
};

/** Whether the Non-Criminal Certificate field is shown (age >= 18 from Step 1 DOB). */
export function needsNonCriminalCert(dob: string | undefined, ctx?: SchemaContext): boolean {
  const age = ageFrom(dob, ctx);
  return age !== null && age >= 18;
}
