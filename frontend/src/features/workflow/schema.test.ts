import { describe, expect, it } from "vitest";
import { coachApproveSchema, districtApproveSchema, rejectSchema } from "./schema";

describe("coach approval", () => {
  it("requires validity of 1 or 2 years; notes are optional", () => {
    expect(coachApproveSchema.safeParse({ validity_years: 1 }).success).toBe(true);
    expect(coachApproveSchema.safeParse({ validity_years: 2, notes: "Good" }).success).toBe(true);
    expect(coachApproveSchema.safeParse({ validity_years: 3 }).success).toBe(false);
    expect(coachApproveSchema.safeParse({}).success).toBe(false);
  });
});

describe("district approval", () => {
  it("accepts empty notes and caps them at 500", () => {
    expect(districtApproveSchema.safeParse({}).success).toBe(true);
    expect(districtApproveSchema.safeParse({ notes: "" }).success).toBe(true);
    expect(districtApproveSchema.safeParse({ notes: "x".repeat(501) }).success).toBe(false);
  });
});

describe("rejection", () => {
  it("defaults the rejection type to Document Issue", () => {
    const r = rejectSchema.parse({ notes: "Birth proof is blurred, please upload again." });
    expect(r.rejection_type).toBe("DOCUMENT_ISSUE");
  });

  it("requires notes of at least 25 characters after trimming", () => {
    expect(rejectSchema.safeParse({ notes: "too short" }).success).toBe(false);
    expect(rejectSchema.safeParse({ notes: `   ${"a".repeat(24)}   ` }).success).toBe(false);
    expect(rejectSchema.safeParse({ notes: "a".repeat(25) }).success).toBe(true);
    expect(rejectSchema.safeParse({ rejection_type: "BAD", notes: "a".repeat(25) }).success).toBe(false);
  });
});
