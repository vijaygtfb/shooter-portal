import { z } from "zod";
import { docRefSchema, type DocRef } from "@/features/documents/schema";
import { GENDERS, MAIN_EVENTS, STATE_UNIT_CODES } from "@/features/masterData/data";
import { MOBILE_RE } from "@/lib/validators";
import { ageFrom, ALWAYS_REFINE, isoDate, nameString, opt, req, today, type Mode, type SchemaContext } from "./fields";

/** Step 1 - Basic Info (REQUIREMENTS §3.1). Email is shown from the account and is not part of this step. */
export interface Step1Values {
  state_unit: string;
  first_name: string;
  last_name: string;
  main_event: string;
  playing_events: string[];
  education: string;
  dob: string;
  birth_proof: DocRef | null;
  place_of_birth: string;
  mobile: string;
  alt_mobile: string;
  gender: string;
  profile_photo: DocRef | null;
  action_photo: DocRef | null;
}

export function step1Schema(mode: Mode, ctx?: SchemaContext) {
  const base = z.object({
    state_unit: req(mode, z.enum(STATE_UNIT_CODES as [string, ...string[]], { error: "Select a state / unit" })),
    first_name: req(mode, nameString("First name", 2, 50)),
    last_name: opt(nameString("Last name", 1, 50)),
    main_event: req(mode, z.enum(MAIN_EVENTS, { error: "Select the main event" })),
    playing_events:
      mode === "complete"
        ? z.array(z.enum(MAIN_EVENTS)).min(1, "Select at least one playing event")
        : z.array(z.enum(MAIN_EVENTS)).optional(),
    education: opt(z.string().max(100, "Education must be at most 100 characters")),
    dob: req(mode, isoDate("Date of birth")),
    birth_proof: req(mode, docRefSchema.refine((d) => d.doc_type === "BIRTH_PROOF", "Upload birth proof")),
    place_of_birth: req(
      mode,
      z
        .string({ error: "Place of birth is required" })
        .min(2, "Place of birth must be at least 2 characters")
        .max(100, "Place of birth must be at most 100 characters"),
    ),
    mobile: req(mode, z.string({ error: "Mobile number is required" }).regex(MOBILE_RE, "Enter a valid 10-digit Indian mobile number")),
    alt_mobile: opt(z.string().regex(/^\d{10}$/, "Alternate number must be 10 digits")),
    gender: req(mode, z.enum(GENDERS, { error: "Select a gender" })),
    profile_photo: req(mode, docRefSchema),
    action_photo: opt(docRefSchema),
  });

  return base.superRefine((v, c) => {
    if (v.main_event && Array.isArray(v.playing_events) && !v.playing_events.includes(v.main_event)) {
      c.addIssue({ code: "custom", path: ["playing_events"], message: "Playing events must include the main event" });
    }
    if (typeof v.dob === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.dob)) {
      if (v.dob >= today(ctx)) {
        c.addIssue({ code: "custom", path: ["dob"], message: "Date of birth must be in the past" });
      } else {
        const age = ageFrom(v.dob, ctx) ?? 0;
        if (age < 5 || age > 100) c.addIssue({ code: "custom", path: ["dob"], message: "Age must be between 5 and 100 years" });
      }
    }
    if (v.alt_mobile && v.mobile && v.alt_mobile === v.mobile) {
      c.addIssue({ code: "custom", path: ["alt_mobile"], message: "Alternate number must differ from the mobile number" });
    }
  }, ALWAYS_REFINE);
}

export const emptyStep1: Step1Values = {
  state_unit: "MAHARASHTRA",
  first_name: "",
  last_name: "",
  main_event: "",
  playing_events: [],
  education: "",
  dob: "",
  birth_proof: null,
  place_of_birth: "",
  mobile: "",
  alt_mobile: "",
  gender: "",
  profile_photo: null,
  action_photo: null,
};
