/** Date helpers. Dates are ISO "YYYY-MM-DD" in storage, DD-MM-YYYY on screen, and "today" is IST. */

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in Asia/Kolkata as ISO. */
export function todayIst(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isoToDate(iso: string | null | undefined): Date | null {
  if (!iso || !ISO_DATE_RE.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dateToIso(date: Date | null | undefined): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "2026-09-26" -> "26-09-2026". ISO datetimes show their date part. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Whole years between dob and "on" (both ISO). */
export function ageOn(dobIso: string, onIso: string): number {
  const [by, bm, bd] = dobIso.split("-").map(Number);
  const [y, m, d] = onIso.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

/**
 * ID card expiry (REQUIREMENTS §16.6): issue date + N years, minus one day.
 * A 29 Feb issue date whose anniversary doesn't exist rolls to 1 Mar, so the expiry is 28 Feb.
 */
export function idCardExpiry(issueIso: string, years: number): string {
  const [y, m, d] = issueIso.split("-").map(Number);
  const anniversary = new Date(Date.UTC(y + years, m - 1, d));
  anniversary.setUTCDate(anniversary.getUTCDate() - 1);
  return anniversary.toISOString().slice(0, 10);
}

export function isExpired(expiryIso: string | null | undefined, todayIso = todayIst()): boolean {
  return !!expiryIso && expiryIso < todayIso;
}
