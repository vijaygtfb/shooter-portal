/**
 * DEMO ONLY - an in-browser stand-in for the FastAPI backend, used when config.useMockApi is true.
 * It implements the endpoints in REQUIREMENTS §8 and §16.7 with dummy data, including the server-side
 * rules (status transitions, uniqueness, OTP attempts, lockout) so the demo behaves like the real thing.
 * Replace with the real backend by setting useMockApi: false in public/config.js.
 */
import { z } from "zod";
import { emailField, ROLE_LABELS, type Role } from "@/features/auth/schema";
import { DOC_RULES, DOC_TYPES, type DocRef, type DocType } from "@/features/documents/schema";
import { labelOf, MASTER_DATA } from "@/features/masterData/data";
import type { HistoryEntry, Registration } from "@/features/registration/model";
import { isRejected, isStudentEditable, stepCount } from "@/features/registration/model";
import { step1Schema } from "@/features/registration/schemas/step1";
import { step2Schema } from "@/features/registration/schemas/step2";
import { step3Schema } from "@/features/registration/schemas/step3";
import { submitSchema } from "@/features/registration/schemas/submit";
import { coachApproveSchema, districtApproveSchema, rejectSchema, type StudentListItem } from "@/features/workflow/schema";
import { ageOn, formatDate, idCardExpiry, todayIst } from "@/lib/dates";
import { MOBILE_RE, passwordProblems } from "@/lib/validators";
import { cookie, getDb, resetDb, saveDb, type Mail, type RegRec, type UserRec } from "./db";
import { deleteObject, getObject, putObject, sniffType, viewUrl } from "./files";
import { DEMO_OTP, SHOOTER_ID_SEED } from "./seed";
import { demoHash, nowIso, pad, uid } from "./util";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;
const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60 * 1000;
const SHOOTER_ID_MAX = 999_999_999;

let latencyMs = 250;
/** Tests set this to 0. */
export function setMockLatency(ms: number) {
  latencyMs = ms;
}

class HttpError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
  ) {
    super(typeof detail === "string" ? detail : `HTTP ${status}`);
  }
}

const notFound = () => new HttpError(404, "Not found");

function respond(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Request-Id": uid("mock-") },
  });
}

/** Zod issues -> FastAPI-style 422 detail. */
function validation(error: z.ZodError, prefix: (string | number)[] = []): HttpError {
  return new HttpError(
    422,
    error.issues.map((i) => ({ loc: ["body", ...prefix, ...i.path.map((p) => (typeof p === "symbol" ? String(p) : p))], msg: i.message, type: i.code })),
  );
}

function parse<S extends z.ZodType>(schema: S, body: unknown, prefix: (string | number)[] = []): z.output<S> {
  const r = schema.safeParse(body);
  if (!r.success) throw validation(r.error, prefix);
  return r.data;
}

interface Ctx {
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  headers: Headers;
}

type Handler = (ctx: Ctx) => unknown | Promise<unknown>;

const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler; status?: number }[] = [];

function route(method: string, path: string, handler: Handler, status = 200) {
  const keys: string[] = [];
  const pattern = new RegExp(
    "^" + path.replace(/:([a-z_]+)/g, (_m, k: string) => (keys.push(k), "([^/]+)")) + "$",
  );
  routes.push({ method, pattern, keys, handler, status });
}

// ---------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------

function findUserByEmail(email: string): UserRec | undefined {
  return getDb().users.find((u) => u.email === email.toLowerCase());
}

function findUser(id: string): UserRec | undefined {
  return getDb().users.find((u) => u.user_id === id);
}

function currentUser(ctx: Ctx): UserRec {
  const header = ctx.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const rec = getDb().access_tokens[token];
  if (!rec || rec.exp < Date.now()) throw new HttpError(401, "Not authenticated");
  const u = findUser(rec.user_id);
  if (!u || u.account_status !== "ACTIVE") throw new HttpError(401, "Not authenticated");
  return u;
}

function requireRole(ctx: Ctx, ...roles: Role[]): UserRec {
  const u = currentUser(ctx);
  if (!roles.includes(u.role)) throw new HttpError(403, "You do not have permission to do this.");
  return u;
}

function publicUser(u: UserRec) {
  return {
    user_id: u.user_id,
    email: u.email,
    role: u.role,
    account_status: u.account_status,
    full_name: u.full_name,
    state_code: u.state_code,
    district_code: u.district_code,
  };
}

function issueTokens(u: UserRec) {
  const db = getDb();
  const access = uid("at-");
  const refresh = uid("rt-");
  db.access_tokens[access] = { user_id: u.user_id, exp: Date.now() + ACCESS_TTL_MS };
  db.refresh_tokens[refresh] = { user_id: u.user_id, exp: Date.now() + REFRESH_TTL_MS };
  cookie.set(refresh);
  saveDb();
  return { access_token: access, user: publicUser(u) };
}

function revokeAllSessions(userId: string) {
  const db = getDb();
  for (const [k, v] of Object.entries(db.refresh_tokens)) if (v.user_id === userId) delete db.refresh_tokens[k];
  for (const [k, v] of Object.entries(db.access_tokens)) if (v.user_id === userId) delete db.access_tokens[k];
}

function sendMail(mail: Omit<Mail, "id" | "at">) {
  getDb().mailbox.unshift({ ...mail, id: uid("m-"), at: nowIso() });
}

function reg(userId: string): RegRec {
  const r = getDb().registrations[userId];
  if (!r) throw notFound();
  return r;
}

function nameOf(r: RegRec, u?: UserRec): string {
  const b = r.basic_info ?? {};
  const name = [b.first_name, b.last_name].filter((x) => typeof x === "string" && x).join(" ");
  return name || u?.full_name || u?.email || "-";
}

function toApi(r: RegRec): Registration {
  const u = findUser(r.user_id);
  if (!u) throw notFound();
  const basicMobile = typeof r.basic_info?.mobile === "string" ? r.basic_info.mobile : "";
  const coach = r.coach_user_id ? findUser(r.coach_user_id) : undefined;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { aadhaar_hash, ...rest } = r;
  return {
    ...rest,
    role: u.role,
    email: u.email,
    verified_mobile: u.mobile,
    mobile_verified: !!u.mobile && u.mobile === `+91${basicMobile}`,
    coach_name: coach?.full_name ?? null,
  } as Registration;
}

function listItem(r: RegRec): StudentListItem {
  const u = findUser(r.user_id);
  const main = r.basic_info?.main_event;
  return {
    user_id: r.user_id,
    name: nameOf(r, u),
    email: u?.email ?? "",
    registration_no: r.registration_no,
    status: r.status,
    main_event: typeof main === "string" && main ? (main as StudentListItem["main_event"]) : null,
    district_code: r.district_code ?? (typeof r.personal_info?.city === "string" ? r.personal_info.city : null),
    coach_name: r.coach_user_id ? findUser(r.coach_user_id)?.full_name ?? null : null,
    submitted_at: r.submitted_at,
    updated_at: r.updated_at,
    shooter_id: r.shooter_id,
    id_expires_on: r.id_expires_on,
  };
}

function touch(r: RegRec) {
  r.updated_at = nowIso();
}

function history(r: RegRec, by: UserRec, entry: Omit<HistoryEntry, "by_user_id" | "by_role" | "by_name" | "at">) {
  r.approval_history.push({ ...entry, by_user_id: by.user_id, by_role: by.role, by_name: by.full_name ?? by.email, at: nowIso() });
}

// OTP --------------------------------------------------------------------------------------------------

function sendOtp(target: string, deliver: (code: string) => void) {
  const db = getDb();
  const existing = db.otps[target];
  if (existing && Date.now() - existing.sent_at < OTP_RESEND_MS) {
    const wait = Math.ceil((OTP_RESEND_MS - (Date.now() - existing.sent_at)) / 1000);
    throw new HttpError(429, `Please wait ${wait} seconds before requesting a new OTP.`);
  }
  // A new OTP invalidates the previous one. Demo mode always uses DEMO_OTP.
  db.otps[target] = { code: DEMO_OTP, expires_at: Date.now() + OTP_TTL_MS, attempts: 0, sent_at: Date.now() };
  deliver(DEMO_OTP);
  saveDb();
  return { message: "OTP sent.", expires_in: OTP_TTL_MS / 1000, resend_in: OTP_RESEND_MS / 1000, demo_otp: DEMO_OTP };
}

function verifyOtp(target: string, otp: string) {
  const db = getDb();
  const rec = db.otps[target];
  if (!rec || rec.expires_at < Date.now()) {
    delete db.otps[target];
    saveDb();
    throw new HttpError(400, "This OTP has expired. Please request a new one.");
  }
  if (rec.code !== otp) {
    rec.attempts += 1;
    const left = OTP_MAX_ATTEMPTS - rec.attempts;
    if (left <= 0) {
      delete db.otps[target];
      saveDb();
      throw new HttpError(400, "Too many incorrect attempts. Please request a new OTP.");
    }
    saveDb();
    throw new HttpError(400, `Incorrect OTP. ${left} attempt${left === 1 ? "" : "s"} remaining.`);
  }
  delete db.otps[target];
  saveDb();
}

function otpEmailBody(code: string) {
  return `Date: ${formatDate(todayIst())}\n\nUse the OTP below to verify your email address.\n\n    ${code}\n\nExpires in 10 minutes.\n\nIf you did not request this, you can ignore this email.`;
}

// Captcha ----------------------------------------------------------------------------------------------

function captchaSvg(answer: string): string {
  const digits = answer
    .split("")
    .map((d, i) => {
      const y = 30 + ((i * 7) % 3) * 6;
      const rot = ((i * 37) % 30) - 15;
      return `<text x="${18 + i * 26}" y="${y}" font-family="Arial" font-size="24" font-weight="bold" fill="#333" transform="rotate(${rot} ${18 + i * 26} ${y})">${d}</text>`;
    })
    .join("");
  const lines = [0, 1, 2, 3]
    .map((i) => `<line x1="0" y1="${8 + i * 11}" x2="150" y2="${40 - i * 9}" stroke="#999" stroke-width="1.5"/>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="48"><rect width="150" height="48" fill="#e8e8e8"/>${lines}${digits}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ---------------------------------------------------------------------------------------------------
// Auth (REQUIREMENTS §2, §4, §16.1)
// ---------------------------------------------------------------------------------------------------

route("POST", "/auth/email/send-otp", ({ body }) => {
  const { email } = parse(z.object({ email: emailField }), body);
  return sendOtp(`EMAIL#${email}`, (code) =>
    sendMail({ to: email, channel: "EMAIL", subject: "Your email verification OTP", body: otpEmailBody(code) }),
  );
});

route("POST", "/auth/email/verify-otp", ({ body }) => {
  const { email, otp } = parse(z.object({ email: emailField, otp: z.string() }), body);
  verifyOtp(`EMAIL#${email}`, otp);
  if (findUserByEmail(email)) throw new HttpError(409, "An account with this email already exists. Please log in.");
  const token = uid("evt-");
  getDb().email_tokens[token] = { email, exp: Date.now() + 15 * 60 * 1000 };
  saveDb();
  return { email_verification_token: token };
});

route(
  "POST",
  "/auth/register",
  ({ body }) => {
    const input = parse(
      z.object({
        email_verification_token: z.string(),
        password: z.string(),
        role: z.enum(["STUDENT", "COACH", "DISTRICT_SECRETARY"]),
        full_name: z.string().trim().max(100).optional(),
        state_code: z.string().optional(),
        district_code: z.string().optional(),
      }),
      body,
    );
    const db = getDb();
    const tok = db.email_tokens[input.email_verification_token];
    if (!tok || tok.exp < Date.now()) throw new HttpError(400, "Email verification expired. Please verify your email again.");
    const problems = passwordProblems(input.password, tok.email);
    if (problems.length) throw new HttpError(422, [{ loc: ["body", "password"], msg: `Password needs: ${problems.join(", ")}` }]);
    if (findUserByEmail(tok.email)) throw new HttpError(409, "An account with this email already exists. Please log in.");
    if (input.role !== "STUDENT" && (!input.full_name || !input.district_code)) {
      throw new HttpError(422, [{ loc: ["body", "district_code"], msg: "Select the district you serve" }]);
    }
    delete db.email_tokens[input.email_verification_token];

    const staff = input.role !== "STUDENT";
    const u: UserRec = {
      user_id: uid("u-"),
      email: tok.email,
      password: input.password,
      role: input.role,
      account_status: staff ? "PENDING_ACTIVATION" : "ACTIVE",
      full_name: input.full_name || null,
      state_code: input.state_code ?? null,
      district_code: input.district_code ?? null,
      mobile: null,
      failed_logins: 0,
      locked_until: null,
      created_at: nowIso(),
    };
    db.users.push(u);
    db.registrations[u.user_id] = {
      user_id: u.user_id, status: "DRAFT", current_step: 1, basic_info: null, personal_info: null, membership: null,
      submit_info: null, aadhaar_hash: null, registration_no: null, coach_user_id: null, district_code: null,
      validity_years: null, coach_notes: null, district_notes: null, rejection_type: null, rejection_notes: null,
      rejected_by_role: null, rejected_at: null, shooter_id: null, id_issued_on: null, id_expires_on: null,
      approval_history: [], created_at: nowIso(), updated_at: nowIso(), submitted_at: null,
    };
    if (staff) {
      for (const admin of db.users.filter((x) => x.role === "SUPER_ADMIN")) {
        sendMail({
          to: admin.email, channel: "EMAIL", subject: `New ${ROLE_LABELS[u.role]} account awaiting approval`,
          body: `${u.full_name} (${u.email}) registered as ${ROLE_LABELS[u.role]} for ${labelOf("states", u.state_code)}.\n\nLog in to activate or reject the account.`,
        });
      }
      saveDb();
      return { account_status: u.account_status, access_token: null, user: null };
    }
    const t = issueTokens(u);
    return { account_status: u.account_status, access_token: t.access_token, user: t.user };
  },
  201,
);

route("POST", "/auth/login", ({ body }) => {
  const { email, password } = parse(z.object({ email: emailField, password: z.string().min(1) }), body);
  const u = findUserByEmail(email);
  const invalid = new HttpError(401, "Invalid email or password.");
  if (!u) throw invalid;
  if (u.locked_until && new Date(u.locked_until).getTime() > Date.now()) {
    throw new HttpError(423, "Too many failed attempts. Your account is locked for 15 minutes.");
  }
  if (u.password !== password) {
    u.failed_logins += 1;
    if (u.failed_logins >= LOCK_AFTER) {
      u.locked_until = new Date(Date.now() + LOCK_MS).toISOString();
      u.failed_logins = 0;
    }
    saveDb();
    throw invalid;
  }
  u.failed_logins = 0;
  u.locked_until = null;
  if (u.account_status === "PENDING_ACTIVATION") throw new HttpError(403, "Your account is awaiting approval by the Super Admin.");
  if (u.account_status === "REJECTED") throw new HttpError(403, "Your account request was not approved. Please contact the association.");
  if (u.account_status === "DEACTIVATED") throw new HttpError(403, "Your account has been deactivated. Please contact the association.");
  return issueTokens(u);
});

route("POST", "/auth/refresh", () => {
  const db = getDb();
  const token = cookie.get();
  const rec = token ? db.refresh_tokens[token] : undefined;
  const u = rec && rec.exp > Date.now() ? findUser(rec.user_id) : undefined;
  if (!token || !u || u.account_status !== "ACTIVE") {
    cookie.clear();
    throw new HttpError(401, "Session expired. Please log in again.");
  }
  delete db.refresh_tokens[token]; // rotate on every use
  return issueTokens(u);
});

route("GET", "/auth/me", (ctx) => publicUser(currentUser(ctx)));

route(
  "POST",
  "/auth/logout",
  () => {
    const token = cookie.get();
    if (token) delete getDb().refresh_tokens[token];
    cookie.clear();
    saveDb();
    return null;
  },
  204,
);

route("GET", "/auth/captcha", () => {
  const answer = String(Math.floor(10000 + Math.random() * 90000));
  const id = uid("cap-");
  getDb().captchas[id] = { answer: demoHash(answer), exp: Date.now() + 5 * 60 * 1000 };
  saveDb();
  return { captcha_id: id, image_base64: captchaSvg(answer) };
});

const GENERIC_RESET = "If an account exists for this email, a password reset link has been sent.";

route("POST", "/auth/forgot-password", ({ body }) => {
  const input = parse(z.object({ email: emailField, captcha_id: z.string(), captcha_answer: z.string() }), body);
  const db = getDb();
  const cap = db.captchas[input.captcha_id];
  delete db.captchas[input.captcha_id]; // single use
  if (!cap || cap.exp < Date.now() || cap.answer !== demoHash(input.captcha_answer)) {
    saveDb();
    throw new HttpError(400, "The captcha is incorrect or expired. Please try the new one.");
  }
  const u = findUserByEmail(input.email);
  if (u) {
    const token = uid("rst-");
    db.reset_tokens[token] = { user_id: u.user_id, exp: Date.now() + RESET_TTL_MS, used: false };
    const link = `${globalThis.location?.origin ?? ""}/reset-password?token=${token}`;
    sendMail({
      to: u.email, channel: "EMAIL", subject: "Reset your password", link,
      body: "We received a request to reset your password.\n\nUse the link below within 30 minutes. It can be used once.\n\nIf you did not request this, you can ignore this email.",
    });
  }
  saveDb();
  return { message: GENERIC_RESET };
});

route("POST", "/auth/reset-password", ({ body }) => {
  const input = parse(z.object({ token: z.string(), new_password: z.string() }), body);
  const db = getDb();
  const rec = db.reset_tokens[input.token];
  if (!rec || rec.used || rec.exp < Date.now()) throw new HttpError(400, "This reset link is invalid or has expired.");
  const u = findUser(rec.user_id);
  if (!u) throw new HttpError(400, "This reset link is invalid or has expired.");
  const problems = passwordProblems(input.new_password, u.email);
  if (problems.length) throw new HttpError(422, [{ loc: ["body", "password"], msg: `Password needs: ${problems.join(", ")}` }]);
  u.password = input.new_password;
  u.failed_logins = 0;
  u.locked_until = null;
  rec.used = true;
  revokeAllSessions(u.user_id);
  saveDb();
  return { message: "Your password has been reset. Please log in." };
});

route("POST", "/verification/mobile/send-otp", (ctx) => {
  const u = currentUser(ctx);
  const { mobile } = parse(z.object({ mobile: z.string().regex(MOBILE_RE, "Enter a valid 10-digit Indian mobile number") }), ctx.body);
  const e164 = `+91${mobile}`;
  if (getDb().users.some((x) => x.user_id !== u.user_id && x.mobile === e164)) {
    throw new HttpError(409, "This mobile number is already registered with another account.");
  }
  return sendOtp(`SMS#${e164}`, (code) =>
    sendMail({ to: e164, channel: "SMS", subject: "SMS", body: `${code} is your OTP to verify your mobile number. Valid for 10 minutes. Do not share it.` }),
  );
});

route("POST", "/verification/mobile/verify-otp", (ctx) => {
  const u = currentUser(ctx);
  const { mobile, otp } = parse(z.object({ mobile: z.string().regex(MOBILE_RE), otp: z.string() }), ctx.body);
  const e164 = `+91${mobile}`;
  verifyOtp(`SMS#${e164}`, otp);
  u.mobile = e164;
  saveDb();
  return { message: "Mobile number verified." };
});

// ---------------------------------------------------------------------------------------------------
// Master data, registration, documents (REQUIREMENTS §3, §5, §7)
// ---------------------------------------------------------------------------------------------------

route("GET", "/master-data", () => MASTER_DATA);

route("GET", "/registration", (ctx) => toApi(reg(currentUser(ctx).user_id)));

/** Students may edit a draft, or a rejected application to resubmit it (REQUIREMENTS §16.3.3). */
function assertEditable(u: UserRec, r: RegRec) {
  const editable = u.role === "STUDENT" ? isStudentEditable(r.status) : true;
  if (!editable) throw new HttpError(409, "This application is under review or approved and can no longer be edited.");
}

function dobOf(r: RegRec): string | undefined {
  return typeof r.basic_info?.dob === "string" && r.basic_info.dob ? r.basic_info.dob : undefined;
}

function checkMobileVerified(u: UserRec, basic: Record<string, unknown> | null, prefix: string[] = []) {
  const mobile = typeof basic?.mobile === "string" ? basic.mobile : "";
  if (!mobile || u.mobile !== `+91${mobile}`) {
    throw new HttpError(422, [{ loc: ["body", ...prefix, "mobile"], msg: "Please verify your mobile number" }]);
  }
}

/** Server-side Aadhaar handling: validate, check uniqueness by hash, keep only last-4 + hash. */
function applyAadhaar(u: UserRec, r: RegRec, data: Record<string, unknown>) {
  const digits = typeof data.aadhaar_no === "string" ? data.aadhaar_no.replace(/\s/g, "") : "";
  if (digits) {
    const hash = demoHash(digits);
    const taken = Object.values(getDb().registrations).some((x) => x.user_id !== u.user_id && x.aadhaar_hash === hash);
    if (taken) throw new HttpError(422, [{ loc: ["body", "aadhaar_no"], msg: "This Aadhaar number is already registered with another account." }]);
    r.aadhaar_hash = hash;
    data.aadhaar_last4 = digits.slice(-4);
  } else {
    data.aadhaar_last4 = (r.personal_info?.aadhaar_last4 as string | undefined) ?? "";
  }
  data.aadhaar_on_file = !!r.aadhaar_hash;
  data.aadhaar_no = ""; // never stored or returned
}

route("PUT", "/registration/steps/:step", (ctx) => {
  const u = currentUser(ctx);
  const r = reg(u.user_id);
  assertEditable(u, r);
  const step = Number(ctx.params.step);
  const mode = ctx.query.get("mode") === "complete" ? "complete" : "draft";
  if (![1, 2, 3].includes(step) || step > stepCount(u.role)) throw notFound();

  const body = (ctx.body ?? {}) as Record<string, unknown>;
  // Validate what was sent, but store the raw form values so the form round-trips exactly.
  if (step === 1) {
    parse(step1Schema(mode), body);
    if (mode === "complete") checkMobileVerified(u, body);
    r.basic_info = { ...body };
  } else if (step === 2) {
    parse(step2Schema(mode), { ...body, aadhaar_on_file: !!r.aadhaar_hash });
    const data = { ...body };
    applyAadhaar(u, r, data);
    r.personal_info = data;
  } else {
    parse(step3Schema(mode, { dob: dobOf(r) }), body);
    r.membership = { ...body };
  }
  r.current_step = mode === "complete" ? Math.min(step + 1, stepCount(u.role)) : step;
  touch(r);
  saveDb();
  return toApi(r);
});

route("POST", "/registration/submit", (ctx) => {
  const u = currentUser(ctx);
  const r = reg(u.user_id);
  if (u.role === "STUDENT" && !isStudentEditable(r.status)) throw new HttpError(409, "This application has already been submitted.");
  const resubmission = isRejected(r.status);
  const body = (ctx.body ?? {}) as Record<string, unknown>;
  const dob = dobOf(r);
  const isMinor = !!dob && ageOn(dob, todayIst()) < 18;

  parse(step1Schema("complete"), r.basic_info ?? {}, ["basic_info"]);
  checkMobileVerified(u, r.basic_info, ["basic_info"]);
  parse(step2Schema("complete"), { ...(r.personal_info ?? {}), aadhaar_on_file: !!r.aadhaar_hash }, ["personal_info"]);
  if (u.role === "STUDENT") parse(step3Schema("complete", { dob }), r.membership ?? {}, ["membership"]);
  parse(submitSchema(u.role === "STUDENT" && isMinor), body, ["submit_info"]);

  r.submit_info = { ...body };
  const b = r.basic_info ?? {};
  u.full_name = [b.first_name, b.last_name].filter(Boolean).join(" ") || u.full_name;

  if (u.role !== "STUDENT") {
    r.status = "PROFILE_COMPLETE";
    touch(r);
    saveDb();
    return toApi(r);
  }

  const coachId = String(r.membership?.coach_user_id ?? "");
  const coach = findUser(coachId);
  if (!coach || coach.role !== "COACH" || coach.account_status !== "ACTIVE") {
    throw new HttpError(422, [{ loc: ["body", "membership", "coach_user_id"], msg: "Select an active coach" }]);
  }
  const db = getDb();
  const district = String(r.personal_info?.city ?? "DSA");
  if (!r.registration_no) {
    // A resubmission keeps its original registration number.
    db.counters.REG_NO = (db.counters.REG_NO ?? 0) + 1;
    r.registration_no = `${district}-${todayIst().slice(0, 4)}-${pad(db.counters.REG_NO, 5)}`;
  }
  Object.assign(r, {
    status: "SUBMITTED",
    coach_user_id: coach.user_id,
    district_code: district,
    submitted_at: nowIso(),
    // Clear the previous round; it stays visible in approval_history.
    rejection_type: null,
    rejection_notes: null,
    rejected_by_role: null,
    rejected_at: null,
    validity_years: null,
    coach_notes: null,
    district_notes: null,
  });
  history(r, u, { action: resubmission ? "RESUBMITTED" : "SUBMITTED" });
  touch(r);
  sendMail({
    to: u.email, channel: "EMAIL",
    subject: `${resubmission ? "Application resubmitted" : "Application received"} - ${r.registration_no}`,
    body: `Dear ${nameOf(r, u)},\n\nWe have received your ${resubmission ? "corrected " : ""}Shooter ID application.\n\nRegistration no.: ${r.registration_no}\nIt will now be reviewed by your Coach (${coach.full_name}) and then by the District Secretary.`,
  });
  saveDb();
  return toApi(r);
});

route("POST", "/documents/upload-url", (ctx) => {
  const u = currentUser(ctx);
  const input = parse(
    z.object({ doc_type: z.enum(DOC_TYPES), file_name: z.string().min(1).max(200), content_type: z.string(), size: z.number().int() }),
    ctx.body,
  );
  const rule = DOC_RULES[input.doc_type];
  if (!rule.mimes.includes(input.content_type)) throw new HttpError(422, [{ loc: ["body", "content_type"], msg: "This file type is not allowed." }]);
  if (input.size <= 0 || input.size > rule.maxBytes) throw new HttpError(422, [{ loc: ["body", "size"], msg: "File must be 1 MB or smaller." }]);
  const ext = input.content_type === "application/pdf" ? "pdf" : input.content_type === "image/png" ? "png" : "jpg";
  const key = `users/${u.user_id}/${input.doc_type}/${uid()}.${ext}`;
  return { key, url: `mock://documents/${key}`, fields: { key, "Content-Type": input.content_type } };
});

route("POST", "/documents/confirm", async (ctx) => {
  const u = currentUser(ctx);
  const { doc_type, key } = parse(z.object({ doc_type: z.enum(DOC_TYPES), key: z.string() }), ctx.body);
  if (!key.startsWith(`users/${u.user_id}/${doc_type}/`)) throw new HttpError(403, "You do not have permission to do this.");
  const file = getObject(key);
  if (!file) throw new HttpError(400, "Upload not found. Please try again.");
  const actual = await sniffType(file);
  if (!actual || !DOC_RULES[doc_type].mimes.includes(actual)) {
    deleteObject(key);
    throw new HttpError(422, [{ loc: ["body", "file"], msg: "The file content does not match an allowed type (PDF, JPG or PNG)." }]);
  }
  const ref: DocRef = { doc_type, key, file_name: file.name, content_type: actual, size: file.size, uploaded_at: nowIso() };
  return ref;
});

function canView(viewer: UserRec, ownerId: string): boolean {
  if (viewer.user_id === ownerId || viewer.role === "SUPER_ADMIN") return true;
  const r = getDb().registrations[ownerId];
  if (!r) return false;
  if (viewer.role === "COACH") return r.coach_user_id === viewer.user_id && r.status !== "DRAFT";
  if (viewer.role === "DISTRICT_SECRETARY") return r.district_code === viewer.district_code && r.status !== "DRAFT" && r.status !== "SUBMITTED" && r.status !== "COACH_REJECTED";
  return false;
}

route("GET", "/documents/view-url", (ctx) => {
  const u = currentUser(ctx);
  const key = ctx.query.get("key") ?? "";
  const owner = key.split("/")[1] ?? "";
  if (!key.startsWith("users/") || !canView(u, owner)) throw notFound();
  const docType = key.split("/")[2] as DocType;
  const fileName = key.split("/").pop() ?? DOC_RULES[docType]?.label ?? "document";
  return { url: viewUrl(key, fileName) };
});

// ---------------------------------------------------------------------------------------------------
// Workflow (REQUIREMENTS §16.3 - §16.7)
// ---------------------------------------------------------------------------------------------------

route("GET", "/coaches", (ctx) => {
  currentUser(ctx);
  const district = ctx.query.get("district");
  const active = getDb().users.filter((u) => u.role === "COACH" && u.account_status === "ACTIVE");
  const inDistrict = district ? active.filter((u) => u.district_code === district) : active;
  return (inDistrict.length ? inDistrict : active).map((u) => ({ user_id: u.user_id, name: u.full_name ?? u.email, district_code: u.district_code }));
});

function sortList(items: StudentListItem[], pendingStatus?: string) {
  return items.sort((a, b) => {
    const pa = a.status === pendingStatus ? 0 : 1;
    const pb = b.status === pendingStatus ? 0 : 1;
    return pa - pb || b.updated_at.localeCompare(a.updated_at);
  });
}

function filterStatus(items: StudentListItem[], ctx: Ctx) {
  const status = ctx.query.get("status");
  return status ? items.filter((i) => i.status === status) : items;
}

route("GET", "/coach/students", (ctx) => {
  const me = requireRole(ctx, "COACH");
  const items = Object.values(getDb().registrations)
    .filter((r) => r.coach_user_id === me.user_id && r.status !== "DRAFT")
    .map(listItem);
  return sortList(filterStatus(items, ctx), "SUBMITTED");
});

route("GET", "/district/students", (ctx) => {
  const me = requireRole(ctx, "DISTRICT_SECRETARY");
  const visible = ["COACH_APPROVED", "DISTRICT_APPROVED", "DISTRICT_REJECTED"];
  const items = Object.values(getDb().registrations)
    .filter((r) => r.district_code === me.district_code && visible.includes(r.status))
    .map(listItem);
  return sortList(filterStatus(items, ctx), "COACH_APPROVED");
});

route("GET", "/students", (ctx) => {
  requireRole(ctx, "SUPER_ADMIN");
  const items = Object.values(getDb().registrations)
    .filter((r) => findUser(r.user_id)?.role === "STUDENT")
    .map(listItem);
  return sortList(filterStatus(items, ctx));
});

route("GET", "/students/:id", (ctx) => {
  const me = requireRole(ctx, "COACH", "DISTRICT_SECRETARY", "SUPER_ADMIN");
  if (!canView(me, ctx.params.id) || findUser(ctx.params.id)?.role !== "STUDENT") throw notFound();
  return toApi(reg(ctx.params.id));
});

function reviewable(me: UserRec, id: string): RegRec {
  const r = getDb().registrations[id];
  if (!r || !canView(me, id)) throw notFound();
  return r;
}

function wrongState(): HttpError {
  return new HttpError(409, "This application is not at a stage where you can take this action.");
}

function rejectionMail(r: RegRec, by: "Coach" | "District Secretary") {
  const u = findUser(r.user_id);
  if (!u) return;
  sendMail({
    to: u.email, channel: "EMAIL", subject: "Your Shooter ID application was not approved",
    body: `Dear ${nameOf(r, u)},\n\nYour application ${r.registration_no} was rejected by the ${by}.\n\nRejection type: ${labelOf("rejection_types", r.rejection_type)}\nNotes: ${r.rejection_notes}\n\nLog in to the portal to see the details, correct your application and resubmit it.`,
  });
}

route("POST", "/coach/students/:id/approve", (ctx) => {
  const me = requireRole(ctx, "COACH");
  const r = reviewable(me, ctx.params.id);
  const input = parse(coachApproveSchema, ctx.body);
  if (r.status !== "SUBMITTED") throw wrongState();
  r.status = "COACH_APPROVED";
  r.validity_years = input.validity_years;
  r.coach_notes = input.notes ?? null;
  history(r, me, { action: "COACH_APPROVED", validity_years: input.validity_years, notes: input.notes ?? null });
  touch(r);
  saveDb();
  return toApi(r);
});

route("POST", "/coach/students/:id/reject", (ctx) => {
  const me = requireRole(ctx, "COACH");
  const r = reviewable(me, ctx.params.id);
  const input = parse(rejectSchema, ctx.body);
  if (r.status !== "SUBMITTED") throw wrongState();
  Object.assign(r, { status: "COACH_REJECTED", rejection_type: input.rejection_type, rejection_notes: input.notes, rejected_by_role: "COACH", rejected_at: nowIso() });
  history(r, me, { action: "COACH_REJECTED", rejection_type: input.rejection_type, notes: input.notes });
  touch(r);
  rejectionMail(r, "Coach");
  saveDb();
  return toApi(r);
});

/** Atomic "UpdateItem ADD 1" on the Shooter ID counter, starting at SHOOTER_ID_SEED. */
function nextShooterId(): string {
  const db = getDb();
  if (db.counters.SHOOTER_ID === undefined) db.counters.SHOOTER_ID = SHOOTER_ID_SEED - 1;
  const next = db.counters.SHOOTER_ID + 1;
  if (next > SHOOTER_ID_MAX) throw new HttpError(500, "Shooter ID range exhausted. Contact the administrator.");
  db.counters.SHOOTER_ID = next;
  return `SAT${pad(next, 9)}`;
}

route("POST", "/district/students/:id/approve", (ctx) => {
  const me = requireRole(ctx, "DISTRICT_SECRETARY");
  const r = reviewable(me, ctx.params.id);
  const input = parse(districtApproveSchema, ctx.body);
  if (r.status !== "COACH_APPROVED") throw wrongState();
  const issued = todayIst();
  r.status = "DISTRICT_APPROVED";
  r.shooter_id = nextShooterId();
  r.id_issued_on = issued;
  r.id_expires_on = idCardExpiry(issued, r.validity_years ?? 1);
  r.district_notes = input.notes ?? null;
  history(r, me, { action: "DISTRICT_APPROVED", notes: input.notes ?? null });
  touch(r);
  const u = findUser(r.user_id);
  if (u) {
    sendMail({
      to: u.email, channel: "EMAIL", subject: `Your Shooter ID is approved - ${r.shooter_id}`,
      body: `Dear ${nameOf(r, u)},\n\nYour application ${r.registration_no} has been approved.\n\nShooter ID: ${r.shooter_id}\nValid till: ${formatDate(r.id_expires_on)}\n\nLog in to the portal to download your ID card.`,
    });
  }
  saveDb();
  return toApi(r);
});

route("POST", "/district/students/:id/reject", (ctx) => {
  const me = requireRole(ctx, "DISTRICT_SECRETARY");
  const r = reviewable(me, ctx.params.id);
  const input = parse(rejectSchema, ctx.body);
  if (r.status !== "COACH_APPROVED") throw wrongState();
  Object.assign(r, { status: "DISTRICT_REJECTED", rejection_type: input.rejection_type, rejection_notes: input.notes, rejected_by_role: "DISTRICT_SECRETARY", rejected_at: nowIso() });
  history(r, me, { action: "DISTRICT_REJECTED", rejection_type: input.rejection_type, notes: input.notes });
  touch(r);
  rejectionMail(r, "District Secretary");
  saveDb();
  return toApi(r);
});

// Super Admin: Coach / District Secretary accounts --------------------------------------------------

route("GET", "/admin/users", (ctx) => {
  requireRole(ctx, "SUPER_ADMIN");
  const role = ctx.query.get("role");
  const status = ctx.query.get("status");
  return getDb()
    .users.filter((u) => u.role === "COACH" || u.role === "DISTRICT_SECRETARY")
    .filter((u) => (!role || u.role === role) && (!status || u.account_status === status))
    .sort((a, b) => Number(b.account_status === "PENDING_ACTIVATION") - Number(a.account_status === "PENDING_ACTIVATION") || b.created_at.localeCompare(a.created_at))
    .map((u) => ({ ...publicUser(u), created_at: u.created_at }));
});

const ADMIN_ACTIONS: Record<string, { from: UserRec["account_status"][]; to: UserRec["account_status"]; mail?: string }> = {
  activate: { from: ["PENDING_ACTIVATION", "REJECTED", "DEACTIVATED"], to: "ACTIVE", mail: "Your account has been activated. You can now log in." },
  reject: { from: ["PENDING_ACTIVATION"], to: "REJECTED", mail: "Your account request was not approved. Please contact the association." },
  deactivate: { from: ["ACTIVE"], to: "DEACTIVATED", mail: "Your account has been deactivated." },
};

route("POST", "/admin/users/:id/:action", (ctx) => {
  requireRole(ctx, "SUPER_ADMIN");
  const action = ADMIN_ACTIONS[ctx.params.action];
  const u = findUser(ctx.params.id);
  if (!action || !u || (u.role !== "COACH" && u.role !== "DISTRICT_SECRETARY")) throw notFound();
  if (!action.from.includes(u.account_status)) throw new HttpError(409, "The account is not in a state that allows this action.");
  u.account_status = action.to;
  if (action.to !== "ACTIVE") revokeAllSessions(u.user_id);
  if (action.mail) sendMail({ to: u.email, channel: "EMAIL", subject: `${ROLE_LABELS[u.role]} account update`, body: `Dear ${u.full_name ?? u.email},\n\n${action.mail}` });
  saveDb();
  return { ...publicUser(u), created_at: u.created_at };
});

// Demo helpers ------------------------------------------------------------------------------------------

route("GET", "/demo/mailbox", () => getDb().mailbox);
route("POST", "/demo/reset", () => {
  resetDb();
  return { message: "Demo data has been reset." };
});

// ---------------------------------------------------------------------------------------------------

/** fetch()-compatible entry point used by apiRequest() in demo mode. */
export async function mockFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (latencyMs) await new Promise((r) => setTimeout(r, latencyMs));
  const url = new URL(path, "http://mock.local");
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  let body: unknown = undefined;
  if (typeof init.body === "string" && init.body) {
    try {
      body = JSON.parse(init.body);
    } catch {
      return respond(400, { detail: "Invalid JSON body" });
    }
  }

  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.pattern.exec(url.pathname);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    try {
      const result = await r.handler({ params, query: url.searchParams, body, headers });
      return respond(r.status ?? 200, result);
    } catch (err) {
      if (err instanceof HttpError) return respond(err.status, { detail: err.detail });
      return respond(500, { detail: "Internal server error" });
    }
  }
  return respond(404, { detail: "Not found" });
}

/** Demo stand-in for the browser -> S3 presigned POST upload. */
export async function mockS3Upload(key: string, file: File): Promise<void> {
  if (latencyMs) await new Promise((r) => setTimeout(r, latencyMs * 2));
  putObject(key, file);
}
