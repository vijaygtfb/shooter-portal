import { describe, expect, it } from "vitest";
import { isValidAadhaar, maskMobile, passwordProblems, PASSPORT_RE, verhoeffAppend, verhoeffValid } from "./validators";
import { ageOn, formatDate, idCardExpiry, isExpired, todayIst } from "./dates";

describe("verhoeff / aadhaar", () => {
  it("accepts a number with a correct check digit", () => {
    const n = verhoeffAppend("23412341234");
    expect(verhoeffValid(n)).toBe(true);
    expect(isValidAadhaar(n)).toBe(true);
  });

  it("rejects a wrong check digit, a leading 0/1 and a wrong length", () => {
    const n = verhoeffAppend("23412341234");
    const wrong = n.slice(0, 11) + ((Number(n[11]) + 1) % 10);
    expect(isValidAadhaar(wrong)).toBe(false);
    expect(isValidAadhaar(verhoeffAppend("13412341234"))).toBe(false);
    expect(isValidAadhaar("2341234")).toBe(false);
  });

  it("ignores spaces from the input mask", () => {
    const n = verhoeffAppend("49993456789");
    expect(isValidAadhaar(`${n.slice(0, 4)} ${n.slice(4, 8)} ${n.slice(8)}`)).toBe(true);
  });
});

describe("other validators", () => {
  it("masks mobile numbers", () => {
    expect(maskMobile("+919876543210")).toBe("+91 98XXXXXX10");
  });

  it("checks the Indian passport format", () => {
    expect(PASSPORT_RE.test("J8369854")).toBe(true);
    expect(PASSPORT_RE.test("Q1234567")).toBe(false);
  });

  it("applies the password policy", () => {
    expect(passwordProblems("Demo@1234", "coach@demo.in")).toEqual([]);
    expect(passwordProblems("short")).not.toEqual([]);
    expect(passwordProblems("Rahul@12345", "rahul@x.in")).toContain("must not contain your email name");
  });
});

describe("dates", () => {
  it("computes age on a date", () => {
    expect(ageOn("2008-09-26", "2026-09-26")).toBe(18);
    expect(ageOn("2008-09-27", "2026-09-26")).toBe(17);
  });

  it("computes ID card expiry as issue + N years - 1 day", () => {
    expect(idCardExpiry("2026-09-26", 1)).toBe("2027-09-25");
    expect(idCardExpiry("2026-09-26", 2)).toBe("2028-09-25");
    expect(idCardExpiry("2028-02-29", 1)).toBe("2029-02-28");
    expect(idCardExpiry("2026-01-01", 1)).toBe("2026-12-31");
  });

  it("formats and compares dates", () => {
    expect(formatDate("2026-09-26")).toBe("26-09-2026");
    expect(isExpired("2026-09-25", "2026-09-26")).toBe(true);
    expect(isExpired("2026-09-26", "2026-09-26")).toBe(false);
    expect(todayIst(new Date("2026-09-25T20:00:00Z"))).toBe("2026-09-26");
  });
});
