import { z } from "zod";
import { GUARDIAN_RELATIONSHIPS } from "@/features/masterData/data";
import { ALWAYS_REFINE, nameString, opt, req } from "./fields";

/** Final submit (REQUIREMENTS §3.4). Guardian consent is required only for applicants under 18. */
export interface SubmitValues {
  declaration: boolean;
  guardian_name: string;
  guardian_relationship: string;
  guardian_consent: boolean;
}

export function submitSchema(isMinor: boolean) {
  return z
    .object({
      declaration: z.literal(true, { error: "Please confirm the declaration" }),
      guardian_name: isMinor ? req("complete", nameString("Guardian name", 2, 100)) : opt(nameString("Guardian name", 2, 100)),
      guardian_relationship: isMinor
        ? req("complete", z.enum(GUARDIAN_RELATIONSHIPS, { error: "Select the relationship" }))
        : opt(z.enum(GUARDIAN_RELATIONSHIPS)),
      guardian_consent: z.boolean().optional(),
    })
    .superRefine((v, c) => {
      if (isMinor && v.guardian_consent !== true) {
        c.addIssue({ code: "custom", path: ["guardian_consent"], message: "Guardian consent is required for applicants under 18" });
      }
    }, ALWAYS_REFINE);
}

export const emptySubmit: SubmitValues = {
  declaration: false,
  guardian_name: "",
  guardian_relationship: "",
  guardian_consent: false,
};
