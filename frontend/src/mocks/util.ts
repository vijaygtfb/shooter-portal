/** DEMO ONLY - helpers for the mock server. */

export function uid(prefix = ""): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  return prefix + id;
}

/** FNV-1a hash - a stand-in for the backend's HMAC-SHA256 (never use this for real secrets). */
export function demoHash(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}
