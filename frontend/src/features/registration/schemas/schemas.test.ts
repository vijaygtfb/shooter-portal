import { describe, expect, it } from "vitest";
import type { DocRef } from "@/features/documents/schema";
import { verhoeffAppend } from "@/lib/validators";
import { emptyStep1, step1Schema, type Step1Values } from "./step1";
import { emptyStep2, step2Schema, type Step2Values } from "./step2";
import { emptyStep3, needsNonCriminalCert, step3Schema, type Step3Values } from "./step3";
import { submitSchema } from "./submit";

const today = "2026-09-26";
const doc = (doc_type: DocRef["doc_type"]): DocRef => ({ doc_type, key: `users/u/${doc_type}/x.pdf`, file_name: "x.pdf", content_type: "application/pdf", size: 1000, uploaded_at: "2026-01-01T00:00:00Z" });

const paths = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) => (r.error?.issues ?? []).map((i) => i.path.join("."));

const validStep1: Step1Values = {
  ...emptyStep1,
  first_name: "Aarav",
  last_name: "Patil",
  main_event: "RIFLE",
  playing_events: ["RIFLE"],
  dob: "2004-03-14",
  birth_proof: doc("BIRTH_PROOF"),
  place_of_birth: "Pune",
  mobile: "9876543210",
  gender: "MALE",
  profile_photo: doc("PROFILE_PHOTO"),
};

describe("step 1", () => {
  it("accepts a complete step", () => {
    expect(step1Schema("complete", { today }).safeParse(validStep1).success).toBe(true);
  });

  it("requires fields in complete mode but not in draft mode", () => {
    const r = step1Schema("complete", { today }).safeParse(emptyStep1);
    expect(paths(r)).toEqual(expect.arrayContaining(["first_name", "main_event", "playing_events", "dob", "birth_proof", "mobile", "gender", "profile_photo"]));
    expect(step1Schema("draft", { today }).safeParse(emptyStep1).success).toBe(true);
  });

  it("still checks the format of filled fields in draft mode", () => {
    const r = step1Schema("draft", { today }).safeParse({ ...emptyStep1, mobile: "12345", first_name: "A1" });
    expect(paths(r)).toEqual(expect.arrayContaining(["mobile", "first_name"]));
  });

  it("requires the main event to be one of the playing events", () => {
    const r = step1Schema("complete", { today }).safeParse({ ...validStep1, playing_events: ["PISTOL"] });
    expect(paths(r)).toContain("playing_events");
  });

  it("checks date of birth (past, age 5-100) and alternate mobile", () => {
    expect(paths(step1Schema("complete", { today }).safeParse({ ...validStep1, dob: "2027-01-01" }))).toContain("dob");
    expect(paths(step1Schema("complete", { today }).safeParse({ ...validStep1, dob: "2023-01-01" }))).toContain("dob");
    expect(paths(step1Schema("complete", { today }).safeParse({ ...validStep1, alt_mobile: "9876543210" }))).toContain("alt_mobile");
  });
});

const aadhaar = verhoeffAppend("23456789012");
const validStep2: Step2Values = {
  ...emptyStep2,
  marital_status: "UNMARRIED",
  address: "7, Tilak Nagar, Hadapsar",
  state: "MH",
  city: "PUNE",
  pincode: "411028",
  aadhaar_no: `${aadhaar.slice(0, 4)} ${aadhaar.slice(4, 8)} ${aadhaar.slice(8)}`,
  address_proof: doc("ADDRESS_PROOF"),
};

describe("step 2", () => {
  it("accepts a complete step", () => {
    expect(step2Schema("complete").safeParse(validStep2).success).toBe(true);
  });

  it("rejects an Aadhaar with a bad checksum or leading 1", () => {
    const bad = aadhaar.slice(0, 11) + ((Number(aadhaar[11]) + 1) % 10);
    expect(paths(step2Schema("complete").safeParse({ ...validStep2, aadhaar_no: bad }))).toContain("aadhaar_no");
    expect(paths(step2Schema("complete").safeParse({ ...validStep2, aadhaar_no: verhoeffAppend("13456789012") }))).toContain("aadhaar_no");
  });

  it("reports cross-field errors together with field errors", () => {
    const r = step2Schema("complete").safeParse({ ...validStep2, aadhaar_no: "", pincode: "" });
    expect(paths(r)).toEqual(expect.arrayContaining(["pincode", "aadhaar_no"]));
  });

  it("does not require Aadhaar again once it is on file", () => {
    expect(step2Schema("complete").safeParse({ ...validStep2, aadhaar_no: "", aadhaar_on_file: true }).success).toBe(true);
    expect(paths(step2Schema("complete").safeParse({ ...validStep2, aadhaar_no: "" }))).toContain("aadhaar_no");
  });

  it("checks the city belongs to the state, pincode and spouse rules", () => {
    expect(paths(step2Schema("complete").safeParse({ ...validStep2, state: "GA" }))).toContain("city");
    expect(paths(step2Schema("complete").safeParse({ ...validStep2, pincode: "011028" }))).toContain("pincode");
    expect(paths(step2Schema("complete").safeParse({ ...validStep2, spouse_name: "Riya" }))).toContain("spouse_name");
  });

  it("validates height, weight and shoe size ranges", () => {
    const r = step2Schema("draft").safeParse({ ...emptyStep2, height_cm: 20, weight_kg: 300, shoe_size_uk: 16 });
    expect(paths(r)).toEqual(expect.arrayContaining(["height_cm", "weight_kg", "shoe_size_uk"]));
  });
});

const validStep3: Step3Values = { ...emptyStep3, coach_user_id: "u-coach-1", non_criminal_cert: doc("NON_CRIMINAL_CERT") };

describe("step 3", () => {
  const ctx = { today, dob: "2004-03-14" };

  it("accepts a minimal complete step for an adult", () => {
    expect(step3Schema("complete", ctx).safeParse(validStep3).success).toBe(true);
  });

  it("requires the non-criminal certificate only from age 18", () => {
    expect(paths(step3Schema("complete", ctx).safeParse({ ...validStep3, non_criminal_cert: null }))).toContain("non_criminal_cert");
    expect(step3Schema("complete", { today, dob: "2012-01-01" }).safeParse({ ...validStep3, non_criminal_cert: null }).success).toBe(true);
    expect(needsNonCriminalCert("2008-09-26", { today })).toBe(true);
    expect(needsNonCriminalCert("2008-09-27", { today })).toBe(false);
  });

  it("makes the passport a group rule once a number is entered", () => {
    const r = step3Schema("complete", ctx).safeParse({ ...validStep3, passport_number: "J8369854" });
    expect(paths(r)).toEqual(expect.arrayContaining(["passport_file", "passport_issue_date", "passport_expiry_date", "passport_issuing_authority", "passport_place_of_issue"]));
    expect(paths(step3Schema("complete", ctx).safeParse({ ...validStep3, passport_number: "Q1234567" }))).toContain("passport_number");
  });

  it("drops empty weapon rows, validates filled ones and rejects repeated serials", () => {
    const empty = { type: "", make: "", model: "", caliber: "", serial_no: "" };
    expect(step3Schema("complete", ctx).safeParse({ ...validStep3, weapons: [empty] }).success).toBe(true);
    const partial = step3Schema("complete", ctx).safeParse({ ...validStep3, weapons: [{ ...empty, make: "Walther" }] });
    expect(paths(partial)).toEqual(expect.arrayContaining(["weapons.0.type", "weapons.0.serial_no"]));
    const row = { type: "10M_AIR_RIFLE", make: "Walther", model: "", caliber: "", serial_no: "AB1" };
    expect(paths(step3Schema("complete", ctx).safeParse({ ...validStep3, weapons: [row, { ...row, serial_no: "ab1" }] }))).toContain("weapons.1.serial_no");
  });

  it("rejects a coach 'To' date before 'From' and more than 10 rows", () => {
    const r = step3Schema("complete", ctx).safeParse({ ...validStep3, coaches: [{ name: "Vikram Rathod", from: "2024-01-01", to: "2023-01-01" }] });
    expect(paths(r)).toContain("coaches.0.to");
    const many = Array.from({ length: 11 }, () => ({ name: "Vikram Rathod", from: "2024-01-01", to: "" }));
    expect(paths(step3Schema("complete", ctx).safeParse({ ...validStep3, coaches: many }))).toContain("coaches");
  });

  it("requires choosing a coach", () => {
    expect(paths(step3Schema("complete", ctx).safeParse({ ...validStep3, coach_user_id: "" }))).toContain("coach_user_id");
  });
});

describe("submit", () => {
  it("requires the declaration", () => {
    expect(submitSchema(false).safeParse({ declaration: false }).success).toBe(false);
    expect(submitSchema(false).safeParse({ declaration: true, guardian_name: "", guardian_relationship: "", guardian_consent: false }).success).toBe(true);
  });

  it("requires guardian consent for minors", () => {
    const r = submitSchema(true).safeParse({ declaration: true, guardian_name: "", guardian_relationship: "", guardian_consent: false });
    expect(paths(r)).toEqual(expect.arrayContaining(["guardian_name", "guardian_relationship"]));
    expect(submitSchema(true).safeParse({ declaration: true, guardian_name: "Mandar Kulkarni", guardian_relationship: "FATHER", guardian_consent: true }).success).toBe(true);
  });
});
