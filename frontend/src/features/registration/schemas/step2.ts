import { z } from "zod";
import { docRefSchema, type DocRef } from "@/features/documents/schema";
import { APPAREL_SIZES, isDistrictOf, MARITAL_STATUSES, STATE_CODES } from "@/features/masterData/data";
import { isValidAadhaar, PINCODE_RE } from "@/lib/validators";
import { ALWAYS_REFINE, nameString, opt, req, type Mode } from "./fields";

/** Step 2 - Personal Information (REQUIREMENTS §3.2). */
export interface Step2Values {
  mother_name: string;
  father_name: string;
  marital_status: string;
  spouse_name: string;
  address: string;
  state: string;
  city: string;
  pincode: string;
  /** Digits typed by the user. Empty when an Aadhaar is already on file and not being replaced. */
  aadhaar_no: string;
  /** Set by the server once an Aadhaar is saved. The full number is never sent back. */
  aadhaar_on_file: boolean;
  aadhaar_last4: string;
  address_proof: DocRef | null;
  mailing_same: boolean;
  mailing_address: string;
  height_cm: number | null;
  weight_kg: number | null;
  track_suit_size: string;
  tshirt_size: string;
  shoe_size_uk: number | null;
}

const num = (label: string, min: number, max: number) =>
  z
    .number({ error: `${label} must be a number` })
    .min(min, `${label} must be between ${min} and ${max}`)
    .max(max, `${label} must be between ${min} and ${max}`);

export function step2Schema(mode: Mode) {
  return z
    .object({
      mother_name: opt(nameString("Mother name", 2, 100)),
      father_name: opt(nameString("Father name", 2, 100)),
      marital_status: req(mode, z.enum(MARITAL_STATUSES, { error: "Select marital status" })),
      spouse_name: opt(nameString("Spouse name", 2, 100)),
      address: req(
        mode,
        z
          .string({ error: "Address is required" })
          .min(5, "Address must be at least 5 characters")
          .max(250, "Address must be at most 250 characters"),
      ),
      state: req(mode, z.enum(STATE_CODES as [string, ...string[]], { error: "Select a state" })),
      city: req(mode, z.string({ error: "Select a city / district" })),
      pincode: req(mode, z.string({ error: "Pincode is required" }).regex(PINCODE_RE, "Enter a valid 6-digit pincode")),
      aadhaar_no: opt(
        z
          .string()
          .transform((s) => s.replace(/\s/g, ""))
          .refine((s) => /^\d{12}$/.test(s), "Aadhaar must be 12 digits")
          .refine((s) => /^[2-9]/.test(s), "Aadhaar cannot start with 0 or 1")
          .refine(isValidAadhaar, "Invalid Aadhaar number (checksum failed)"),
      ),
      aadhaar_on_file: z.boolean().optional(),
      aadhaar_last4: z.string().optional(),
      address_proof: req(mode, docRefSchema),
      mailing_same: z.boolean().optional(),
      mailing_address: opt(z.string().max(250, "Mailing address must be at most 250 characters")),
      height_cm: opt(num("Height", 50, 250)),
      weight_kg: opt(num("Weight", 15, 200)),
      track_suit_size: opt(z.enum(APPAREL_SIZES, { error: "Select a size" })),
      tshirt_size: opt(z.enum(APPAREL_SIZES, { error: "Select a size" })),
      shoe_size_uk: opt(num("Shoe size", 1, 15).int("Shoe size must be a whole number")),
    })
    .superRefine((v, c) => {
      if (mode === "complete" && !v.aadhaar_no && !v.aadhaar_on_file) {
        c.addIssue({ code: "custom", path: ["aadhaar_no"], message: "Aadhaar number is required" });
      }
      if (typeof v.state === "string" && typeof v.city === "string" && v.state && v.city && !isDistrictOf(v.state, v.city)) {
        c.addIssue({ code: "custom", path: ["city"], message: "Select a city / district in the chosen state" });
      }
      if (v.marital_status !== "MARRIED" && v.spouse_name) {
        c.addIssue({ code: "custom", path: ["spouse_name"], message: "Spouse name applies only when married" });
      }
    }, ALWAYS_REFINE);
}

export const emptyStep2: Step2Values = {
  mother_name: "",
  father_name: "",
  marital_status: "",
  spouse_name: "",
  address: "",
  state: "MH",
  city: "",
  pincode: "",
  aadhaar_no: "",
  aadhaar_on_file: false,
  aadhaar_last4: "",
  address_proof: null,
  mailing_same: false,
  mailing_address: "",
  height_cm: null,
  weight_kg: null,
  track_suit_size: "",
  tshirt_size: "",
  shoe_size_uk: null,
};
