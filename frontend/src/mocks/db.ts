/**
 * DEMO ONLY - the in-browser "database" behind the mock API.
 * It stands in for the DynamoDB tables in REQUIREMENTS §6/§16.7 and is saved in localStorage so demo
 * state survives page reloads and role switches. Delete src/mocks/ once the FastAPI backend is live.
 */
import type { AccountStatus, Role } from "@/features/auth/schema";
import type { RejectionType } from "@/features/masterData/data";
import type { HistoryEntry, RegStatus } from "@/features/registration/model";
import { buildSeed } from "./seed";

export interface UserRec {
  user_id: string;
  email: string;
  /** Demo only: stored as plain text. The backend uses Argon2id (REQUIREMENTS §4.4). */
  password: string;
  role: Role;
  account_status: AccountStatus;
  full_name: string | null;
  state_code: string | null;
  district_code: string | null;
  /** Verified mobile in E.164, or null. */
  mobile: string | null;
  failed_logins: number;
  locked_until: string | null;
  created_at: string;
}

export interface RegRec {
  user_id: string;
  status: RegStatus;
  current_step: number;
  basic_info: Record<string, unknown> | null;
  personal_info: Record<string, unknown> | null;
  membership: Record<string, unknown> | null;
  submit_info: Record<string, unknown> | null;
  /** Stand-in for the Aadhaar HMAC. The full number is never stored. */
  aadhaar_hash: string | null;
  registration_no: string | null;
  coach_user_id: string | null;
  district_code: string | null;
  validity_years: number | null;
  coach_notes: string | null;
  district_notes: string | null;
  rejection_type: RejectionType | null;
  rejection_notes: string | null;
  rejected_by_role: Role | null;
  rejected_at: string | null;
  shooter_id: string | null;
  id_issued_on: string | null;
  id_expires_on: string | null;
  approval_history: HistoryEntry[];
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
}

export interface Mail {
  id: string;
  to: string;
  channel: "EMAIL" | "SMS";
  subject: string;
  body: string;
  link?: string;
  at: string;
}

interface OtpRec {
  code: string;
  expires_at: number;
  attempts: number;
  sent_at: number;
}

export interface Db {
  version: number;
  users: UserRec[];
  registrations: Record<string, RegRec>;
  /** Last issued value per counter (REQUIREMENTS §6.3, §16.5). */
  counters: Record<string, number>;
  otps: Record<string, OtpRec>;
  email_tokens: Record<string, { email: string; exp: number }>;
  access_tokens: Record<string, { user_id: string; exp: number }>;
  refresh_tokens: Record<string, { user_id: string; exp: number }>;
  reset_tokens: Record<string, { user_id: string; exp: number; used: boolean }>;
  captchas: Record<string, { answer: string; exp: number }>;
  mailbox: Mail[];
}

export const DB_VERSION = 1;
const DB_KEY = "sat-demo-db-v1";

/** Key/value store: localStorage in the browser, memory in tests or when storage is blocked. */
export interface KeyValue {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function memoryStore(): KeyValue {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) };
}

function browserStore(kind: "localStorage" | "sessionStorage"): KeyValue {
  try {
    const s = globalThis[kind];
    if (!s) return memoryStore();
    const probe = "__probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return { get: (k) => s.getItem(k), set: (k, v) => s.setItem(k, v), remove: (k) => s.removeItem(k) };
  } catch {
    return memoryStore();
  }
}

let persistent: KeyValue = browserStore("localStorage");
/** Simulates the httpOnly refresh-token cookie (per browser tab session). */
let cookieJar: KeyValue = browserStore("sessionStorage");
let cache: Db | null = null;

/** Tests call this to run against fresh in-memory storage. */
export function switchToMemoryStorage() {
  persistent = memoryStore();
  cookieJar = memoryStore();
  cache = null;
}

export function getDb(): Db {
  if (cache) return cache;
  const raw = persistent.get(DB_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Db;
      if (parsed.version === DB_VERSION) {
        cache = parsed;
        return cache;
      }
    } catch {
      // Corrupt demo data: fall through and reseed.
    }
  }
  cache = buildSeed();
  saveDb();
  return cache;
}

export function saveDb() {
  if (!cache) return;
  try {
    persistent.set(DB_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or blocked: keep working from memory.
  }
}

export function resetDb() {
  cache = buildSeed();
  saveDb();
  cookieJar.remove(COOKIE);
}

const COOKIE = "sat-demo-refresh";
export const cookie = {
  get: () => cookieJar.get(COOKIE),
  set: (v: string) => cookieJar.set(COOKIE, v),
  clear: () => cookieJar.remove(COOKIE),
};
