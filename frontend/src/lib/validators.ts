/** Shared format rules (REQUIREMENTS §3). Mirrors the backend validators - keep both in sync. */

export const NAME_RE = /^[A-Za-z][A-Za-z .'-]*$/;
export const MOBILE_RE = /^[6-9]\d{9}$/;
export const PINCODE_RE = /^[1-9]\d{5}$/;
export const AADHAAR_RE = /^[2-9]\d{11}$/;
export const PASSPORT_RE = /^[A-PR-WY][1-9]\d\s?\d{4}[1-9]$/i;
export const EMAIL_MAX = 254;

// Verhoeff checksum tables.
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

export function verhoeffValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let c = 0;
  const rev = digits.split("").reverse();
  for (let i = 0; i < rev.length; i++) c = D[c][P[i % 8][Number(rev[i])]];
  return c === 0;
}

/** Appends the Verhoeff check digit (used for demo data and tests). */
export function verhoeffAppend(digits: string): string {
  let c = 0;
  const rev = digits.split("").reverse();
  for (let i = 0; i < rev.length; i++) c = D[c][P[(i + 1) % 8][Number(rev[i])]];
  return digits + INV[c];
}

export function isValidAadhaar(value: string): boolean {
  const digits = value.replace(/\s/g, "");
  return AADHAAR_RE.test(digits) && verhoeffValid(digits);
}

export function maskAadhaar(last4: string): string {
  return `XXXX XXXX ${last4}`;
}

/** "+919876543210" or "9876543210" -> "+91 98XXXXXX10" */
export function maskMobile(mobile: string): string {
  const d = mobile.replace(/\D/g, "").slice(-10);
  return `+91 ${d.slice(0, 2)}XXXXXX${d.slice(8)}`;
}

export function toE164(mobile10: string): string {
  return `+91${mobile10}`;
}

export function fromE164(mobile: string | undefined | null): string {
  return (mobile ?? "").replace(/^\+91/, "");
}

/** Password policy (REQUIREMENTS §4.4). Returns the unmet rules; empty means valid. */
export function passwordProblems(password: string, email?: string): string[] {
  const problems: string[] = [];
  if (password.length < 8 || password.length > 64) problems.push("8-64 characters");
  if (!/[A-Z]/.test(password)) problems.push("an uppercase letter");
  if (!/[a-z]/.test(password)) problems.push("a lowercase letter");
  if (!/\d/.test(password)) problems.push("a digit");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("a special character");
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 3 && password.toLowerCase().includes(local)) {
    problems.push("must not contain your email name");
  }
  return problems;
}
