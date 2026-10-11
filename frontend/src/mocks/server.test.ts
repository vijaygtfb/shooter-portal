import { beforeEach, describe, expect, it } from "vitest";
import { step1Schema } from "@/features/registration/schemas/step1";
import { step2Schema } from "@/features/registration/schemas/step2";
import { step3Schema } from "@/features/registration/schemas/step3";
import { idCardExpiry, todayIst } from "@/lib/dates";
import { getDb, switchToMemoryStorage } from "./db";
import { DEMO_PASSWORD } from "./seed";
import { mockFetch, setMockLatency } from "./server";

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await mockFetch(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = res.status === 204 ? null : await res.json();
  return { status: res.status, json };
}

async function loginAs(email: string) {
  const r = await call("POST", "/auth/login", { email, password: DEMO_PASSWORD });
  expect(r.status).toBe(200);
  return r.json.access_token as string;
}

const NOTES = "The birth certificate scan is unreadable, please re-upload.";

beforeEach(() => {
  switchToMemoryStorage();
  setMockLatency(0);
});

describe("seed data", () => {
  it("every submitted student passes the complete step schemas", () => {
    const today = "2026-09-26";
    const regs = Object.values(getDb().registrations).filter((r) => r.status !== "DRAFT" && r.membership);
    expect(regs.length).toBeGreaterThan(5);
    for (const r of regs) {
      expect(step1Schema("complete", { today }).safeParse(r.basic_info).success).toBe(true);
      expect(step2Schema("complete").safeParse({ ...r.personal_info, aadhaar_on_file: true }).success).toBe(true);
      const s3 = step3Schema("complete", { today, dob: r.basic_info?.dob as string }).safeParse(r.membership);
      expect(s3.success, JSON.stringify(s3.error?.issues)).toBe(true);
    }
  });
});

describe("auth", () => {
  it("blocks a pending Coach until the Super Admin activates the account", async () => {
    const pending = await call("POST", "/auth/login", { email: "newcoach@demo.in", password: DEMO_PASSWORD });
    expect(pending.status).toBe(403);
    expect(pending.json.detail).toMatch(/awaiting approval/);

    const coachToken = await loginAs("coach@demo.in");
    expect((await call("POST", "/admin/users/u-coach-3/activate", undefined, coachToken)).status).toBe(403);

    const admin = await loginAs("superadmin@demo.in");
    expect((await call("POST", "/admin/users/u-coach-3/activate", undefined, admin)).status).toBe(200);
    expect((await call("POST", "/auth/login", { email: "newcoach@demo.in", password: DEMO_PASSWORD })).status).toBe(200);
  });

  it("rejects a wrong captcha in forgot-password", async () => {
    const cap = await call("GET", "/auth/captcha");
    const wrong = await call("POST", "/auth/forgot-password", { email: "nobody@demo.in", captcha_id: cap.json.captcha_id, captcha_answer: "00000" });
    expect(wrong.status).toBe(400);
  });
});

describe("approval workflow", () => {
  it("runs Coach approval then District approval and issues the next Shooter ID", async () => {
    const coach = await loginAs("coach@demo.in");
    const approved = await call("POST", "/coach/students/u-stu-aarav/approve", { validity_years: 2 }, coach);
    expect(approved.status).toBe(200);
    expect(approved.json.status).toBe("COACH_APPROVED");

    const ds = await loginAs("district@demo.in");
    const final = await call("POST", "/district/students/u-stu-aarav/approve", {}, ds);
    expect(final.status).toBe(200);
    expect(final.json.shooter_id).toBe("SAT000000003"); // seed issued 1 and 2
    expect(final.json.id_expires_on).toBe(idCardExpiry(todayIst(), 2));

    const next = await call("POST", "/district/students/u-stu-rohan/approve", { notes: "" }, ds);
    expect(next.json.shooter_id).toBe("SAT000000004");
  });

  it("requires 25+ character notes to reject and defaults the type to Document Issue", async () => {
    const coach = await loginAs("coach@demo.in");
    const short = await call("POST", "/coach/students/u-stu-aarav/reject", { notes: "too short" }, coach);
    expect(short.status).toBe(422);

    const ok = await call("POST", "/coach/students/u-stu-aarav/reject", { notes: NOTES }, coach);
    expect(ok.status).toBe(200);
    expect(ok.json.status).toBe("COACH_REJECTED");
    expect(ok.json.rejection_type).toBe("DOCUMENT_ISSUE");
    expect(getDb().mailbox[0].to).toBe("aarav.patil@demo.in");
  });

  it("rejects out-of-order transitions and hides other reviewers' students", async () => {
    const ds = await loginAs("district@demo.in");
    expect((await call("POST", "/district/students/u-stu-isha/approve", {}, ds)).status).toBe(404); // not yet visible to district
    const coach2 = await loginAs("coach2@demo.in");
    expect((await call("POST", "/coach/students/u-stu-aarav/approve", { validity_years: 1 }, coach2)).status).toBe(404);
    const coach = await loginAs("coach@demo.in");
    expect((await call("POST", "/coach/students/u-stu-rohan/approve", { validity_years: 1 }, coach)).status).toBe(409);
  });

  it("lets a rejected student edit and resubmit, restarting approval from the Coach", async () => {
    const student = await loginAs("kabir.shinde@demo.in");
    const before = (await call("GET", "/registration", undefined, student)).json;
    expect(before.status).toBe("COACH_REJECTED");

    const basic = { ...before.basic_info, education: "B.Sc" };
    expect((await call("PUT", "/registration/steps/1?mode=complete", basic, student)).status).toBe(200);

    const r = await call("POST", "/registration/submit", { declaration: true, guardian_name: "", guardian_relationship: "", guardian_consent: false }, student);
    expect(r.status).toBe(200);
    expect(r.json.status).toBe("SUBMITTED");
    expect(r.json.registration_no).toBe(before.registration_no);
    expect(r.json.rejection_notes).toBeNull();
    expect(r.json.basic_info.education).toBe("B.Sc");
    expect(r.json.approval_history.map((h: { action: string }) => h.action)).toEqual(["SUBMITTED", "COACH_REJECTED", "RESUBMITTED"]);

    // Locked again while under review, and back in the Coach's queue.
    expect((await call("PUT", "/registration/steps/1?mode=draft", basic, student)).status).toBe(409);
    const coach = await loginAs("coach@demo.in");
    expect((await call("POST", "/coach/students/u-stu-kabir/approve", { validity_years: 1 }, coach)).status).toBe(200);
  });

  it("does not allow editing an approved application", async () => {
    const student = await loginAs("sneha.joshi@demo.in");
    expect((await call("PUT", "/registration/steps/1?mode=draft", {}, student)).status).toBe(409);
    expect((await call("POST", "/registration/submit", { declaration: true }, student)).status).toBe(409);
  });

  it("locks a submitted application against edits", async () => {
    const student = await loginAs("aarav.patil@demo.in");
    expect((await call("PUT", "/registration/steps/1?mode=draft", {}, student)).status).toBe(409);
  });
});
