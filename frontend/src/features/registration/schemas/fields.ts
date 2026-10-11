import { z } from "zod";
import { ageOn, ISO_DATE_RE, todayIst } from "@/lib/dates";
import { NAME_RE } from "@/lib/validators";

/**
 * "complete" = Next / Submit (required fields enforced).
 * "draft"    = Save for later (nothing required, but any filled value must be well-formed).
 */
export type Mode = "complete" | "draft";

export interface SchemaContext {
  /** Today in IST as ISO. Injected so tests are deterministic. */
  today?: string;
}

export function isBlank(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

/** Blank inputs ("" / null) become undefined and strings are trimmed before validation. */
export function blankToUndefined(v: unknown): unknown {
  if (isBlank(v)) return undefined;
  return typeof v === "string" ? v.trim() : v;
}

/** Required in complete mode, optional in draft mode. The schema's own `error` is the "required" message. */
export function req<S extends z.ZodType>(mode: Mode, schema: S) {
  return mode === "complete"
    ? z.preprocess(blankToUndefined, schema)
    : z.preprocess(blankToUndefined, schema.optional());
}

/** Always optional; validated only when filled. */
export function opt<S extends z.ZodType>(schema: S) {
  return z.preprocess(blankToUndefined, schema.optional());
}

export function nameString(label: string, min: number, max: number) {
  return z
    .string({ error: `${label} is required` })
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`)
    .regex(NAME_RE, `${label} can contain letters, spaces and . ' - only`);
}

export function isoDate(label: string) {
  return z.string({ error: `${label} is required` }).regex(ISO_DATE_RE, `${label} must be a valid date`);
}

/** Drops rows whose every field is blank (REQUIREMENTS §3.3: an empty row is ignored). */
export function dropEmptyRows(v: unknown): unknown {
  if (!Array.isArray(v)) return v;
  return v.filter((row) => row && typeof row === "object" && Object.values(row).some((x) => !isBlank(x)));
}

export function today(ctx?: SchemaContext): string {
  return ctx?.today ?? todayIst();
}

export function ageFrom(dob: string | undefined, ctx?: SchemaContext): number | null {
  return dob && ISO_DATE_RE.test(dob) ? ageOn(dob, today(ctx)) : null;
}

/**
 * Zod skips object-level refinements while any field has an error. Cross-field rules (e.g. "Aadhaar
 * required", "main event must be a playing event") should show together with field errors, so run
 * them whenever the value is an object. Refinements must therefore tolerate partly-invalid values.
 */
export const ALWAYS_REFINE = {
  when: (payload: { value: unknown }) => typeof payload.value === "object" && payload.value !== null,
};
