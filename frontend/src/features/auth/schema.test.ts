import { describe, expect, it } from "vitest";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "./schema";

const student = { role: "STUDENT", email: "Aarav.Patil@Demo.in ", password: "Shoot@2026", confirm_password: "Shoot@2026" };

describe("auth schemas", () => {
  it("normalises the email on login", () => {
    const r = loginSchema.parse({ email: " A@B.IN ", password: "x" });
    expect(r.email).toBe("a@b.in");
  });

  it("registers a student with a valid password", () => {
    expect(registerSchema.safeParse(student).success).toBe(true);
  });

  it("rejects weak or mismatched passwords", () => {
    expect(registerSchema.safeParse({ ...student, password: "weak", confirm_password: "weak" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...student, confirm_password: "Shoot@2027" }).success).toBe(false);
  });

  it("requires name and district for Coach / District Secretary", () => {
    const r = registerSchema.safeParse({ ...student, role: "COACH" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(["full_name", "district_code"]));
    expect(registerSchema.safeParse({ ...student, role: "COACH", full_name: "Vikram Rathod", state_code: "MH", district_code: "PUNE" }).success).toBe(true);
  });

  it("does not allow self-registering as Super Admin", () => {
    expect(registerSchema.safeParse({ ...student, role: "SUPER_ADMIN" }).success).toBe(false);
  });

  it("checks the 5-digit captcha and reset passwords", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.in", captcha_answer: "1234" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "a@b.in", captcha_answer: "12345" }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ password: "Shoot@2026", confirm_password: "Shoot@2026" }).success).toBe(true);
  });
});
