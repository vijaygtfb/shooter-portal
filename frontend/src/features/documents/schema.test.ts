import { describe, expect, it } from "vitest";
import { DOC_RULES, DOC_TYPES, fileSchema, MAX_UPLOAD_BYTES } from "./schema";

const file = (size: number, type: string, name = "f") => new File([new Uint8Array(size)], name, { type });

describe("upload rules", () => {
  it("limits every document type to 1 MB", () => {
    for (const t of DOC_TYPES) expect(DOC_RULES[t].maxBytes).toBe(MAX_UPLOAD_BYTES);
    expect(fileSchema("BIRTH_PROOF").safeParse(file(MAX_UPLOAD_BYTES, "application/pdf")).success).toBe(true);
    expect(fileSchema("BIRTH_PROOF").safeParse(file(MAX_UPLOAD_BYTES + 1, "application/pdf")).success).toBe(false);
  });

  it("allows only images for photos and PDF/images for proofs", () => {
    expect(fileSchema("PROFILE_PHOTO").safeParse(file(100, "application/pdf")).success).toBe(false);
    expect(fileSchema("PROFILE_PHOTO").safeParse(file(100, "image/png")).success).toBe(true);
    expect(fileSchema("ADDRESS_PROOF").safeParse(file(100, "application/x-msdownload")).success).toBe(false);
  });

  it("rejects empty files", () => {
    expect(fileSchema("PASSPORT").safeParse(file(0, "application/pdf")).success).toBe(false);
  });
});
