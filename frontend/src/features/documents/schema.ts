import { z } from "zod";

/** Upload rules (REQUIREMENTS §5). Every document is limited to 1 MB. Mirrors the backend. */
export const DOC_TYPES = [
  "BIRTH_PROOF",
  "PROFILE_PHOTO",
  "ACTION_PHOTO",
  "ADDRESS_PROOF",
  "PASSPORT",
  "NON_CRIMINAL_CERT",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const MAX_UPLOAD_BYTES = 1024 * 1024; // 1 MB

const PDF_IMG = ["application/pdf", "image/jpeg", "image/png"];
const IMG = ["image/jpeg", "image/png"];

export const DOC_RULES: Record<DocType, { label: string; mimes: string[]; maxBytes: number }> = {
  BIRTH_PROOF: { label: "Birth proof", mimes: PDF_IMG, maxBytes: MAX_UPLOAD_BYTES },
  PROFILE_PHOTO: { label: "Profile photo", mimes: IMG, maxBytes: MAX_UPLOAD_BYTES },
  ACTION_PHOTO: { label: "Action photo", mimes: IMG, maxBytes: MAX_UPLOAD_BYTES },
  ADDRESS_PROOF: { label: "Address proof", mimes: PDF_IMG, maxBytes: MAX_UPLOAD_BYTES },
  PASSPORT: { label: "Passport", mimes: PDF_IMG, maxBytes: MAX_UPLOAD_BYTES },
  NON_CRIMINAL_CERT: { label: "Non-criminal certificate", mimes: PDF_IMG, maxBytes: MAX_UPLOAD_BYTES },
};

export function describeRule(docType: DocType): string {
  const r = DOC_RULES[docType];
  const types = r.mimes.map((m) => (m === "application/pdf" ? "PDF" : m === "image/png" ? "PNG" : "JPG")).join(", ");
  return `${types} - max ${r.maxBytes / (1024 * 1024)} MB`;
}

/** Client-side check of a picked file before upload. */
export function fileSchema(docType: DocType) {
  const r = DOC_RULES[docType];
  return z
    .file()
    .min(1, "The file is empty")
    .max(r.maxBytes, `File must be ${r.maxBytes / (1024 * 1024)} MB or smaller`)
    .mime(r.mimes, `Allowed types: ${describeRule(docType).split(" - ")[0]}`);
}

/** A document attached to an application (what the form stores after a successful upload). */
export const docRefSchema = z.object(
  {
    doc_type: z.enum(DOC_TYPES),
    key: z.string().min(1),
    file_name: z.string().min(1),
    content_type: z.string(),
    size: z.number().int().nonnegative(),
    uploaded_at: z.string(),
  },
  { error: "Upload this document" },
);
export type DocRef = z.infer<typeof docRefSchema>;

export const uploadUrlResponseSchema = z.object({
  key: z.string(),
  url: z.string(),
  fields: z.record(z.string(), z.string()),
});

export const viewUrlResponseSchema = z.object({ url: z.string() });

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
