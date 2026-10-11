# REQUIREMENTS.md — District Shooter ID Registration Portal

> **For Claude Code:** Read `AGENTS.md` first. It defines the stack, folder structure and guardrails.
> This file defines **what** to build. If anything here conflicts with `AGENTS.md`, follow `AGENTS.md` and flag it.
> UI reference screenshots are in `docs/ui-reference/`. Match their layout and flow, not their branding.
> Items marked **[ASSUMPTION]** are defaults chosen for you. Items in §15 need product confirmation. Build with the defaults and keep them configurable.

---

## 1. Summary

| Item | Value |
|---|---|
| Product | Web portal where students (shooters) register for a **District-level Shooter ID** |
| Users | Student (shooter/applicant), Coach, District Secretary, Super Admin (§16) |
| Core flows | Register (email OTP → mobile OTP → 3-step form) · Login · Forgot password (captcha) · Save for later / resume · Final submit · Coach approval → District Secretary approval · ID card PDF (§16) |
| Stack | As per `AGENTS.md`: React + PrimeReact + React Hook Form + Zod · FastAPI on Lambda (Mangum) · DynamoDB · Azure DevOps CI/CD |
| New AWS services | S3 (private documents bucket) · SES (email) · SNS (SMS) · Secrets Manager · CloudFront (HTTPS for the frontend) |

---

## 2. User flows

### 2.1 Registration (new user)
1. User opens **Register**. Only the **Email** field and its **Verify** button are enabled. Every other field is disabled.
2. User clicks **Verify**. The system sends a 6-digit OTP to that email and opens the **OTP popup** (§4.1).
3. User enters the OTP. On success:
   - The Email field becomes **read-only** with a green "Verified" tag.
   - **Password** and **Confirm password** fields are enabled.
4. User sets a password (§4.4) and clicks **Create account**. The account is created with status `DRAFT` and the user is logged in.
5. The rest of Step 1 is enabled.
6. The **Mobile Number** field has its own **Verify** button, using the same popup with an SMS OTP.
7. **Next** on Step 1 is blocked until **both email and mobile are verified** and Step 1 is valid.
8. Steps 2 and 3 follow. **Submit** on Step 3 locks the application (status `SUBMITTED`).

**[ASSUMPTION]** Password is set right after email verification. The login is email + password, so the account must exist before "Save for Later" can work.

### 2.2 Login
- The form has **Email**, **Password**, and a **Forgot password?** link.
- On success, the user lands on the step where they left off (from `current_step` on the draft).
- If the application is already `SUBMITTED`, show a read-only summary with its status.

### 2.3 Forgot password (see `02-forgot-password-captcha.png`)
1. User enters **Email** and the **Captcha** (numeric image captcha) and clicks **Send password reset link**.
2. The response is **always the same generic message**, whether or not the email exists, to prevent account enumeration.
3. The email contains a single-use reset link (token valid 30 min).
4. The reset page asks for **New password** and **Confirm**. On success, all existing sessions are invalidated and the user is sent to Login.
- **Back to login** returns to the login screen.
- The **Admin** checkbox in the screenshot is Phase 2. Do not build it now.

### 2.4 Multi-step form navigation (see `04-stepper.png`)
- Use a left-side vertical stepper with three steps: **Basic Info**, **Personal Information**, **Membership & Other Info**.
- **Next**: validates the current step fully, saves it to the server, then moves forward.
- **Save for later**: saves the current values without enforcing required fields. Format rules still apply to any filled field.
- **Previous**: goes back with no validation. Unsaved changes are kept in form state.
- User can click a **completed** step in the stepper. They cannot jump to a step they haven't reached.
- **Role rule:** all three steps are required for **Students**. **Coach, District Secretary and Super Admin** complete only Steps 1 and 2; Step 3 is hidden for them and their profile is complete after Step 2 (§16.2).
- **Submit** (Step 3 only, Students) runs these checks:
  - All three steps are valid on the server.
  - Email and mobile are verified.
  - The declaration checkbox is ticked (§3.4).
- After submit, the application is read-only and a **Shooter Registration No.** is generated (§6.3).

---

## 3. Form fields

**Legend:** **Req** = required · **Cond** = conditionally required · component = PrimeReact.
Dates display as **DD-MM-YYYY** (PrimeReact `Calendar`, `dateFormat="dd-mm-yy"`), are stored as ISO `YYYY-MM-DD`, and use IST for "today".

### 3.1 Step 1 — Basic Info (`05-step1-basic-info.png`)

| # | Field | Component | Req | Validation / behaviour |
|---|---|---|---|---|
| 1 | Email ID | `InputText` + **Verify** button | Req | Valid email, max 254, lower-cased. Read-only after verification. Unique across users |
| 2 | Password / Confirm | `Password` (with strength meter) | Req | §4.4. Shown only until the account is created |
| 3 | State / Unit of Representation | `Dropdown` | Req | From master data (§7). Default: the configured home state |
| 4 | First Name | `InputText` | Req | 2–50 chars, letters, space, `.` `'` `-` |
| 5 | Last Name | `InputText` | — | 0–50 chars, same charset |
| 6 | Main Event (on ID card) | `RadioButton` group | Req | One of RIFLE, PISTOL, SHOTGUN, BIG BORE |
| 7 | Playing Events | `Checkbox` group | Req | At least 1 selected. **Must include the Main Event** (auto-tick it when the Main Event is chosen; show an error if the user unticks it) |
| 8 | Education | `InputText` | — | Max 100 |
| 9 | Date of Birth | `Calendar` | Req | Must be in the past. Age 5–100. Drives the §3.3 non-criminal certificate rule |
| 10 | Birth Proof | Upload (§5) | Req | Document type `BIRTH_PROOF` |
| 11 | Place of Birth | `InputText` | Req | 2–100 chars |
| 12 | Mobile Number | `InputText` (keyfilter `int`) + **Verify** button | Req | Indian mobile: 10 digits, `^[6-9]\d{9}$`, stored as `+91XXXXXXXXXX`. Must be verified (§4.2). Unique across users. Editing a verified number resets it to unverified |
| 13 | Alt. Contact Number | `InputText` | — | 10 digits if filled. Must differ from Mobile. Not verified |
| 14 | Gender | `Dropdown` | Req | MALE, FEMALE, OTHERS |
| 15 | Profile Photo | Upload (§5) | Req | `PROFILE_PHOTO`. Show a thumbnail preview |
| 16 | Action Photo | Upload (§5) | — | `ACTION_PHOTO` |

**Buttons:** Save for later · Next.
**Next is enabled only when:** email is verified, mobile is verified, and the form is valid.

### 3.2 Step 2 — Personal Information (`06-step2-personal-info.png`)

| # | Field | Component | Req | Validation / behaviour |
|---|---|---|---|---|
| 1 | Mother Name | `InputText` | — | Max 100, name charset |
| 2 | Father Name | `InputText` | — | Max 100, name charset |
| 3 | Marital Status | `Dropdown` | Req | MARRIED, UNMARRIED, DIVORCED, WIDOWED |
| 4 | Spouse Name | `InputText` | Cond | Enabled only when MARRIED, otherwise disabled and cleared. **[ASSUMPTION]** optional even when enabled |
| 5 | Address | `InputTextarea` | Req | 5–250 chars |
| 6 | State | `Dropdown` | Req | Master data |
| 7 | City / District | `Dropdown` (filter on) | Req | Options depend on State. Reset when State changes |
| 8 | Pincode | `InputText` | Req | `^[1-9]\d{5}$` |
| 9 | Aadhaar No | `InputMask` `9999 9999 9999` | Req | 12 digits, first digit not 0 or 1, **Verhoeff checksum**. Unique across users. Stored encrypted; displayed masked `XXXX XXXX 1234` after save (§9) |
| 10 | Address Proof | Upload (§5) | Req | `ADDRESS_PROOF` |
| 11 | Mailing Address | `InputTextarea` + **Same as address** `Checkbox` | — | Ticked: copy Address and disable the field. Unticked: editable, max 250 |
| 12 | Height (cm) | `InputNumber` | — | 50–250 |
| 13 | Weight (kg) | `InputNumber` | — | 15–200 |
| 14 | Track Suit Size | `Dropdown` | — | XS, S, M, L, XL, XXL, XXXL |
| 15 | T-Shirt Size | `Dropdown` | — | XS, S, M, L, XL, XXL, XXXL |
| 16 | Shoe Size (UK) | `InputNumber` | — | 1–15 |

**Buttons:** Previous · Save for later · Next.

### 3.3 Step 3 — Membership & Other Info (`07-step3-weapon-coach.png`)

**Passport** (all optional; becomes a group rule once a passport number is entered)

| Field | Component | Req | Validation |
|---|---|---|---|
| Passport Number | `InputText` | — | Indian format `^[A-PR-WY][1-9]\d\s?\d{4}[1-9]$` (case-insensitive, store upper) |
| Passport Upload | Upload | Cond | `PASSPORT`. Required if Passport Number is filled |
| Date of Issue | `Calendar` | Cond | Required if Passport Number is filled. Must be ≤ today and ≥ DOB |
| Date of Expiry | `Calendar` | Cond | Required if Passport Number is filled. Must be > Date of Issue. Warn (don't block) if expired |
| Issuing Authority | `InputText` | Cond | Required if Passport Number is filled. Max 100 |
| Place of Issue | `InputText` | Cond | Required if Passport Number is filled. Max 100 |

**Weapon Details** — repeatable rows (`useFieldArray`). Rows are optional; you can add up to 10.

| Field | Component | Req (per row) | Validation |
|---|---|---|---|
| Type | `Dropdown` | Req | 10m Air Pistol, 50m Pistol, 10m Air Rifle, 50m Rifle Men, 50m Rifle Women, 25m Rim Fire Pistol, 25m Center Fire Pistol |
| Make | `InputText` | Req | Max 50 |
| Model | `InputText` | — | Max 50 |
| Caliber | `InputText` | — | Max 20 |
| Serial No. | `InputText` | Req | Max 50. Unique within the user's rows |

- The `+` button adds a row and the trash button removes one. The first row can be removed.
- An entirely empty row is dropped on save and doesn't fail validation.

**Coach Details** — repeatable rows. Rows are optional; you can add up to 10.

| Field | Component | Req (per row) | Validation |
|---|---|---|---|
| Coach Name | `InputText` | Req | 2–100, name charset |
| From | `Calendar` | Req | ≤ today, ≥ DOB |
| To | `Calendar` | — | ≥ From and ≤ today. Empty means "present" |

**Non-Criminal Certificate**

| Field | Component | Req | Rule |
|---|---|---|---|
| Non-Criminal Certificate | Upload | Cond | Shown and **required only if age ≥ 18**, where age is computed from DOB as of today (IST). Evaluated on both client and server. If DOB changes, re-evaluate: hide it when under 18 and keep any uploaded file, but ignore it |

### 3.4 Final submit
- **Declaration checkbox (Req):** "I confirm the information provided is true and correct."
- **Guardian consent (Req if age < 18) [ASSUMPTION — see §15 Q2]:**
  - Guardian Name (Req)
  - Relationship (Req): FATHER, MOTHER, LEGAL GUARDIAN
  - Consent checkbox (Req)
- **Submit** runs full server-side validation of all steps, then:
  - sets status to `SUBMITTED`
  - generates the registration number
  - sends a confirmation email

---

## 4. Verification & authentication rules

### 4.1 OTP popup (UI per `01-email-otp-popup.png`)
- PrimeReact `Dialog`, modal, closable.
- **Content:**
  - "OTP has been sent to **<target>**" (mobile masked `+91 98XXXXXX21`)
  - Expiry countdown `mm:ss`
  - 6-digit `InputOtp` (`integerOnly`, `length=6`)
  - **Verify OTP** button, disabled until 6 digits are entered
  - Resend countdown, then a **Resend OTP** link
  - Footer: "OTP is valid for 10 minutes only"
- **On success:** close the dialog, show a toast, mark the field verified.
- **On failure:** show an inline error with the attempts remaining.

| Rule | Value (configurable via env) |
|---|---|
| OTP length | 6 digits, cryptographically random (`secrets`) |
| Validity | 10 min |
| Resend cooldown | 60 s **[ASSUMPTION]** (screenshot shows the full 10 min; confirm) |
| Max verify attempts per OTP | 5, then the OTP is invalidated and the user must resend |
| Max sends per target | 5 per hour, 10 per day |
| Max sends per IP | 20 per hour |
| Storage | Store the **hash** only (HMAC-SHA256 with a secret pepper). DynamoDB TTL auto-deletes |
| New OTP | Invalidates any previous OTP for the same target |

### 4.2 Channels

| Channel | Provider | Notes |
|---|---|---|
| Email | Amazon SES | HTML template like `03-otp-email-template.png` (see below) |
| Mobile (SMS) | Amazon SNS | India needs **DLT registration** (Entity ID, Sender ID, Template ID) before go-live |

- **Email template contents:** association logo, date, "Use the OTP below to verify your email address", boxed OTP, "Expires in 10 minutes", and an ignore-if-not-requested note. Branding comes from config; don't use NRAI branding.
- **Provider abstraction:** use a `NotificationProvider` interface with implementations `SesEmailProvider`, `SnsSmsProvider`, and `ConsoleProvider`.
- **ConsoleProvider rules:**
  - Allowed only when `APP_ENV=local`.
  - Logs the OTP at DEBUG.
  - Selected via `EMAIL_PROVIDER` / `SMS_PROVIDER` env vars.
  - Never enabled in test, uat, or prod.

### 4.3 Captcha (forgot password)
- Numeric image captcha, 5 digits, generated server-side as a PNG (Python `captcha` lib or Pillow), with a refresh icon.
- `GET /auth/captcha` returns `{captcha_id, image_base64}`. The answer hash is stored with a 5 min TTL and is **single-use**.
- Keep it behind a `CaptchaVerifier` interface so it can be swapped for Cloudflare Turnstile or reCAPTCHA later.
- **[ASSUMPTION]** Also require the captcha after 3 failed logins from the same IP or email.

### 4.4 Passwords & sessions

| Rule | Value |
|---|---|
| Password policy | 8–64 chars, at least 1 upper, 1 lower, 1 digit, 1 special. Must not contain the email local-part |
| Hashing | Argon2id (`argon2-cffi`) |
| Access token | JWT (HS256), 15 min, in memory on the client (not localStorage) |
| Refresh token | Random opaque token, 7 days, **httpOnly Secure SameSite=None cookie**. Stored hashed in DynamoDB. Rotated on each use |
| Logout | Revokes the refresh token and clears the cookie |
| Password reset | Revokes all refresh tokens for the user |
| Lockout | 5 failed logins leads to a 15 min lock for that email |
| JWT secret / OTP pepper | AWS Secrets Manager, read once at cold start |

---

## 5. File uploads

**Pattern:** upload directly from the browser to S3 with a **presigned POST**. Do not send file bytes through Lambda or API Gateway (payload limits).

1. `POST /documents/upload-url` with `{doc_type, file_name, content_type, size}`. The server validates type and size, then returns a presigned POST with a `content-length-range` condition, plus the key `users/{user_id}/{doc_type}/{uuid}.{ext}`.
2. The browser uploads to S3.
3. `POST /documents/confirm` with `{doc_type, key}`. The server:
   - reads the first bytes from S3 and checks **magic bytes** (PDF / JPEG / PNG)
   - records the document on the registration
   - deletes the previous file of that type
4. Preview (eye icon) calls `GET /documents/{doc_type}/view-url`, which returns a presigned GET valid for 5 min.

**Every upload is limited to 1 MB.**

| Doc type | Allowed | Max size | Req |
|---|---|---|---|
| BIRTH_PROOF | PDF, JPG, PNG | 1 MB | Req |
| PROFILE_PHOTO | JPG, PNG | 1 MB | Req. Shown on the ID card |
| ACTION_PHOTO | JPG, PNG | 1 MB | — |
| ADDRESS_PROOF | PDF, JPG, PNG | 1 MB | Req |
| PASSPORT | PDF, JPG, PNG | 1 MB | Cond |
| NON_CRIMINAL_CERT | PDF, JPG, PNG | 1 MB | Cond (age ≥ 18) |

**UI:**
- Orange **Upload** button that opens the file picker.
- After upload, show the file name, an eye icon for preview, and a replace option.
- The ⓘ tooltip shows the allowed types and max size.
- Show a progress bar while uploading.

**Client-side:** Zod `z.file().max(size).mime([...])` for each doc type.

**Documents bucket:**
- Private: block all public access.
- Encrypted with SSE-S3 or KMS.
- CORS limited to the frontend origin.
- Lifecycle rule deletes orphaned `tmp/` objects after 1 day.
- **Not** the website bucket.

---

## 6. Data model (DynamoDB)

Table names follow `${AppName}-${EnvName}-<entity>` and use `PAY_PER_REQUEST`, as per `AGENTS.md`.

### 6.1 Tables

| Table | PK | SK / GSI | TTL | Purpose |
|---|---|---|---|---|
| `users` | `user_id` | GSI `email-index` (email), GSI `mobile-index` (mobile) | — | Credentials, verification flags, lockout counters |
| `registrations` | `user_id` | GSI `status-index` (status, updated_at) | — | Full application (steps 1–3, documents, status) |
| `otps` | `target` (e.g. `EMAIL#a@b.com`, `SMS#+91…`) | — | `expires_at` | OTP hash, attempts, sent_count window |
| `auth_tokens` | `token_hash` | GSI `user-index` (user_id) | `expires_at` | Refresh tokens, password-reset tokens (`type` attribute) |
| `captchas` | `captcha_id` | — | `expires_at` | Captcha answer hash |
| `counters` | `name` | — | — | Atomic sequence for registration numbers |

**Uniqueness:**
- Enforce unique email, mobile, and Aadhaar with **guard items** written in a `TransactWriteItems`, so there is no race condition. Examples: `UNIQUE#EMAIL#…`, `UNIQUE#MOBILE#…`, and `UNIQUE#AADHAAR#<hmac>` in the `users` table.
- Aadhaar uniqueness uses its HMAC, never the plain number.

### 6.2 Registration document shape (abridged)

```json
{
  "user_id": "uuid",
  "status": "DRAFT | SUBMITTED | COACH_APPROVED | COACH_REJECTED | DISTRICT_APPROVED | DISTRICT_REJECTED",
  "current_step": 1,
  "basic_info":   { "state_unit": "MH", "first_name": "", "main_event": "RIFLE", "playing_events": ["RIFLE"], "dob": "2008-04-12", "...": "" },
  "personal_info": { "marital_status": "UNMARRIED", "aadhaar_enc": "<kms-ciphertext>", "aadhaar_last4": "1234", "...": "" },
  "membership":   { "passport": { "...": "" }, "weapons": [ { "type": "10M_AIR_RIFLE", "make": "", "serial_no": "" } ], "coaches": [ { "name": "", "from": "2024-01-01", "to": null } ] },
  "documents":    { "BIRTH_PROOF": { "key": "users/…", "file_name": "", "content_type": "", "size": 0, "uploaded_at": "" } },
  "guardian":     { "name": "", "relationship": "FATHER", "consent": true },
  "registration_no": null,
  "created_at": "", "updated_at": "", "submitted_at": null
}
```

- Use enum **codes** in storage (e.g. `10M_AIR_RIFLE`) and labels in the UI. Both come from master data.

### 6.3 Registration number
- Format: `<DISTRICT_CODE>-<YYYY>-<NNNNN>`, e.g. `STR-2026-00042`. **[ASSUMPTION]** Confirm the format.
- Generated on Submit with an atomic `UpdateItem ADD` on the `counters` table.

---

## 7. Master data

- Served by `GET /master-data`, which is public and cacheable (`Cache-Control: max-age=3600`).
- Source is a versioned JSON file in `backend/app/master_data/`. **[ASSUMPTION]** Move it to DynamoDB when admin editing is needed.
- **Contents:**
  - states
  - districts/cities per state (seed at least Maharashtra fully)
  - state units / representation units
  - main events
  - weapon types
  - genders
  - marital statuses
  - apparel sizes
  - guardian relationships
- The frontend loads it once, caches it in memory, and derives Zod enums and dropdown options from it.

---

## 8. API endpoints

All endpoints use JSON unless noted. 🔒 means a Bearer access token is required.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/email/send-otp` | Body `{email}`. Rate limited. Generic success response |
| POST | `/auth/email/verify-otp` | Body `{email, otp}`. Returns a short-lived `email_verification_token` (JWT, 15 min) |
| POST | `/auth/register` | Body `{email_verification_token, password}`. Creates the user and a draft, returns tokens |
| POST | `/auth/login` | Body `{email, password, captcha?}` |
| POST | `/auth/refresh` | Uses the refresh cookie. Rotates the token |
| POST | `/auth/logout` 🔒 | Revokes the refresh token |
| GET | `/auth/captcha` | Returns a new captcha |
| POST | `/auth/forgot-password` | Body `{email, captcha_id, captcha_answer}`. Always returns a generic 200 |
| POST | `/auth/reset-password` | Body `{token, new_password}` |
| POST | `/verification/mobile/send-otp` 🔒 | Body `{mobile}` |
| POST | `/verification/mobile/verify-otp` 🔒 | Body `{mobile, otp}` |
| GET | `/master-data` | Dropdown data |
| GET | `/registration` 🔒 | Current user's application (Aadhaar masked) |
| PUT | `/registration/steps/{1\|2\|3}` 🔒 | Query `?mode=draft\|complete`. `draft` = Save for later (format checks only). `complete` = Next (full step validation) |
| POST | `/registration/submit` 🔒 | Full validation, then SUBMITTED + registration number |
| POST | `/documents/upload-url` 🔒 | Presigned POST |
| POST | `/documents/confirm` 🔒 | Magic-byte check and attach |
| GET | `/documents/{doc_type}/view-url` 🔒 | Presigned GET |
| DELETE | `/documents/{doc_type}` 🔒 | Remove an optional doc (draft only) |

**API rules:**
- Every mutating registration endpoint returns **409** unless the status is `DRAFT`, `COACH_REJECTED` or `DISTRICT_REJECTED` (a rejected application can be edited and resubmitted, §16.3.3).
- Approval, user-management and ID card endpoints are listed in §16.7.
- Validation errors return **422** in FastAPI format. The frontend maps `loc` to field errors with RHF `setError`.

---

## 9. Security & privacy

| Area | Requirement |
|---|---|
| Transport | HTTPS only. Add **CloudFront + ACM** in front of the website bucket (Origin Access Control, the bucket is no longer public). Required for Secure cookies and PII |
| Aadhaar | Encrypt with KMS (envelope or `kms:Encrypt`). Store only ciphertext, last-4, and an HMAC for uniqueness. Never return the full number after save. Never log it |
| PII in logs | Never log OTPs, passwords, tokens, Aadhaar, passport number, full DOB, or file contents. Mask email/mobile in logs |
| Authorization | A user can read and write only their own registration and documents. The S3 key prefix is derived from the token's `user_id`, never from the client |
| Rate limiting | App-level counters in DynamoDB (§4.1) plus API Gateway throttling. **[ASSUMPTION]** Add AWS WAF rate-based rules in prod |
| Enumeration | Forgot-password and send-OTP responses must not reveal whether an email exists |
| Headers | CloudFront response headers policy: HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, strict CSP |
| Compliance | India DPDP Act 2023 (minors need verifiable parental consent) and Aadhaar storage rules. See §15 |

---

## 10. Frontend requirements

- **Routes:** `/login`, `/register`, `/forgot-password`, `/reset-password?token=`, `/application` (stepper, protected), `/application/summary` (read-only, after submit).
- **Routing:** add `react-router` (approved addition for routing only).
- **Forms:**
  - One Zod schema per step in `features/registration/schemas/`.
  - Cross-field rules via `.superRefine`: main event within playing events, passport group, age-based certificate, date ranges.
  - Draft mode uses `schema.partial()` plus format checks.
  - PrimeReact inputs follow the `register` vs `Controller` rule in `AGENTS.md`.
  - Weapons and coaches use `useFieldArray`.
- **State:** RHF per step. The server is the source of truth: load the draft on entering `/application`. No localStorage for form data or tokens.
- **Auth client:**
  - `apiRequest` attaches the access token.
  - On 401 it calls `/auth/refresh` once, then retries.
  - If the refresh fails, redirect to `/login`.
- **Look & feel:**
  - Two-column desktop layout per the screenshots, one column below 768 px.
  - Left dark sidebar with logo and vertical stepper.
  - Uppercase labels are acceptable to match the reference.
  - Required fields marked with a red `*`.
  - Accessible: labels tied to inputs, focus visible, errors announced (`aria-live`).
- **Dates:** show DD-MM-YYYY and send ISO.
- **Disabled-until-verified:** in Step 1, wrap all fields after Email in a `fieldset disabled` driven by `emailVerified`.

---

## 11. Backend requirements

- **Folder layout:** follow `AGENTS.md` (routes → services → repositories). Add a **`services/`** layer for auth, OTP, notification, captcha, document, and registration logic. Routes stay thin.
- **New dependencies (approved):** `argon2-cffi`, `PyJWT`, `captcha` (or Pillow). (`python-multipart` is not needed: uploads go direct to S3.)
- **New settings (env vars):**
  - `DOCUMENTS_BUCKET`
  - `SES_FROM_EMAIL`
  - `EMAIL_PROVIDER`
  - `SMS_PROVIDER`
  - `SNS_SENDER_ID`
  - `DLT_ENTITY_ID`
  - `DLT_TEMPLATE_ID`
  - `KMS_KEY_ID`
  - `SECRETS_ARN`
  - `OTP_TTL_SECONDS`
  - `OTP_RESEND_SECONDS`
  - `OTP_MAX_ATTEMPTS`
  - `FRONTEND_URL` (used in reset links)
  - `HOME_STATE_CODE`
  - `DISTRICT_CODE`
  - `SHOOTER_ID_SEED` (§16.5)
  - `TIMEZONE=Asia/Kolkata`
- **Validation:** Pydantic models mirror every Zod schema, including Verhoeff, pincode, mobile, passport, and cross-field rules. Server rules are authoritative.
- **Age calculation:** one helper `age_on(dob, today_ist)` used everywhere.

### Infra changes to `template-backend.yaml` / `template-frontend.yaml`
- **Backend template:**
  - New tables (§6.1) with TTL enabled on `expires_at`.
  - Documents bucket, KMS key, Secrets Manager secret.
  - Lambda IAM:
    - CRUD on the new tables
    - `s3:PutObject/GetObject/DeleteObject` on `documents/users/*`
    - `ses:SendEmail`
    - `sns:Publish`
    - `kms:Encrypt/Decrypt`
    - `secretsmanager:GetSecretValue`
  - New parameters in `env-*.yaml`: SES from-address, SMS settings, FRONTEND_URL.
- **Frontend template:**
  - CloudFront distribution with an OAC-protected private bucket.
  - SPA error mapping (403/404 → `/index.html` 200).
  - Response headers policy.
  - Optional custom domain + ACM (us-east-1 certificate).
- **Frontend pipeline:** add a CloudFront invalidation for `/index.html` and `/config.js` after sync.
- **Manual/one-time steps (document these in the README):**
  - SES domain verification and sandbox exit
  - SNS SMS spend limit and DLT registration
  - Secrets Manager secret values

---

## 12. Testing & acceptance criteria

### Tests required
- **Backend (pytest + moto):**
  - OTP send / verify / expiry / attempts / rate limit
  - register / login / lockout / refresh rotation / logout
  - forgot / reset (generic response, single-use token)
  - captcha single-use
  - step save draft vs complete
  - submit rules (age ≥ 18 certificate, guardian for minors, 409 after submit)
  - uniqueness (email, mobile, Aadhaar)
  - presigned upload + magic-byte rejection
  - Verhoeff and all validators
- **Frontend (Vitest):**
  - every step schema, valid and invalid
  - cross-field rules
  - Aadhaar Verhoeff
  - age helper
- **[ASSUMPTION]** Add Playwright E2E for the happy path in Phase 2.

### Acceptance criteria (must all pass)
1. On `/register`, only Email and Verify are enabled. All other fields are disabled until the email OTP is verified.
2. A wrong OTP shows attempts remaining. After 5 wrong attempts the OTP is invalid. An expired OTP is rejected. Resend is blocked during cooldown.
3. Step 1 **Next** stays disabled until both email and mobile are verified. Changing the mobile after verification requires re-verification.
4. Selecting a Main Event auto-ticks it in Playing Events. Submitting with it unticked shows an error.
5. Spouse Name is enabled only for MARRIED. "Same as address" copies and locks the Mailing Address.
6. City options change with State, and the selected City clears when State changes.
7. An invalid Aadhaar checksum is rejected on both client and server. A duplicate Aadhaar gets a clear error. After save, only `XXXX XXXX 1234` is ever shown.
8. Weapon and coach rows can be added and removed (max 10). Row rules apply. Coach "To" earlier than "From" is rejected.
9. The Non-Criminal Certificate field appears and is required only when age ≥ 18. The server enforces the same rule on submit.
10. Uploads over the size limit or of the wrong type are rejected client-side, and a renamed `.exe` → `.pdf` is rejected server-side. Preview opens via a short-lived link.
11. Save for later persists partial data. After logout and login, the user resumes at the saved step with data restored.
12. Forgot password returns the same message for known and unknown emails. A wrong captcha is rejected. The reset link works once and expires after 30 min.
13. After Submit, all edit endpoints return 409, the UI is read-only, and a registration number and confirmation email are issued.
14. No OTP, password, token, or Aadhaar value appears in any log line (verify with a log-capture test).

---

## 13. Build order (for Claude Code)

1. **Master data**, validators (Verhoeff, mobile, pincode, passport, age), and their tests (backend + frontend).
2. **Infra**: new tables, documents bucket, KMS, secrets, CloudFront. Update the env files and pipelines.
3. **Notification providers** (Console / SES / SNS) and the OTP service with its tests.
4. **Auth**: email OTP, register, login, refresh, logout, lockout, captcha, forgot/reset.
5. **Frontend auth screens**: login, register (email verify popup), forgot/reset, auth-aware `apiRequest`.
6. **Documents**: presigned upload/confirm/view and the reusable `DocumentUpload` component.
7. **Step 1**, including mobile verification and the disabled-until-verified behaviour.
8. **Step 2**.
9. **Step 3**, then **Submit**, the summary page, and the confirmation email.
10. **Hardening**: log redaction test, rate limits, and the README updates for manual AWS setup.

After each step, run `ruff` + `pytest` (backend) and `lint` + `typecheck` + `test` (frontend) and keep CI green.

---

## 14. Out of scope (Phase 2)

- The Admin login checkbox, advanced search by status/district, and export. (Role-based approval and the ID card are now in scope, see §16.)
- Payment of registration fee.
- Editing an application that is awaiting review or already approved. (Edit and resubmit after a rejection is in scope, see §16.3.3.)
- Multi-language UI (Marathi / Hindi).

---

## 15. Open questions (defaults already applied, confirm before go-live)

| # | Question | Default used |
|---|---|---|
| Q1 | Is a **District** field needed in Step 1 (district-level ID), in addition to State/Unit? | Not added. Registration number uses the configured `DISTRICT_CODE` |
| Q2 | For applicants **under 18**, is guardian consent required (DPDP Act 2023)? What proof? | Guardian name + relationship + consent checkbox |
| Q3 | Is storing the full **Aadhaar number** permitted for this association, or should it be last-4 + document only? | Encrypted full number + last-4 + HMAC |
| Q4 | Resend OTP cooldown: 60 s, or the full 10 min shown in the screenshot? | 60 s |
| Q5 | Registration number format | `<DISTRICT_CODE>-<YYYY>-<NNNNN>` |
| Q6 | Profile photo rules (passport-style, aspect ratio, min resolution)? | JPG/PNG ≤ 1 MB, no dimension check |
| Q7 | Age cut-off date for the certificate: today, or a fixed date (e.g. 1 Jan of the season)? | Today (IST) |
| Q8 | Captcha: self-hosted image (as in the screenshot) or Turnstile/reCAPTCHA? | Self-hosted numeric image |
| Q9 | Are Height / Weight / Size fields free text (as in the screenshot) or dropdowns/numbers? | Numbers + size dropdowns |
| Q10 | "District Admin" and "District Secretary": are these the same role? | Same role, called **District Secretary** |
| Q11 | How is a student linked to a Coach? | Student picks an active Coach from a dropdown in Step 3 |
| Q12 | How is a student linked to a District Secretary? | By the City/District the student chose in Step 2 |
| Q13 | Unique ID "12 digits starting with SAT": 12 characters in total (`SAT` + 9 digits), or `SAT` + 12 digits? | `SAT` + 9 digits = 12 characters, e.g. `SAT000000042` |
| Q14 | Can a Coach reject, or only approve? | Coach can approve or reject, with notes |
| Q15 | After a rejection, can the student edit and resubmit? | **Confirmed: yes** (§16.3.3). Resubmission restarts approval from the Coach |
| Q16 | Should the ID card also show the profile photo, main event and issue date? (Expiry date is confirmed.) | Adds photo and issue date |
| Q18 | Which Rejection Types besides "Document Issue"? | Document Issue (default), Incorrect Details, Not Eligible, Other |
| Q19 | What is the Shooter ID seed value? | `SHOOTER_ID_SEED=1` |
| Q20 | Is there a limit on how many times a rejected application can be resubmitted? | No limit |
| Q17 | Does the §6.3 registration number stay alongside the SAT Shooter ID? | Yes. The registration number is the application reference; the SAT ID is the ID card number |

---

## 16. Roles, approval workflow & ID card

### 16.1 Roles

| Role | How the account is created | Can log in when |
|---|---|---|
| **Student** | Self-registration (§2.1) | Immediately after registration |
| **Coach** | Self-registration with role "Coach" | A **Super Admin** has activated/approved the account |
| **District Secretary** | Self-registration with role "District Secretary" and the district they serve | A **Super Admin** has activated/approved the account |
| **Super Admin** | Seeded by a one-time script (not self-registrable) | Always |

- The Register screen has a **Register as** choice: Student (default), Coach, District Secretary.
- A Coach or District Secretary account starts as `PENDING_ACTIVATION`. Login returns a clear "Your account is awaiting approval" message, not a generic error. Email and mobile OTP verification still happen at registration.
- **Only the Super Admin** can activate, approve, reject or deactivate Coach and District Secretary accounts. Deactivated users cannot log in.
- Role is stored on the `users` record and included in the JWT (`role` claim). **Every endpoint checks the role on the server.**

### 16.2 Form requirements by role

| Role | Step 1 Basic Info | Step 2 Personal Info | Step 3 Membership & Other Info |
|---|---|---|---|
| Student | Required | Required | Required |
| Coach | Required | Required | **Not required (hidden)** |
| District Secretary | Required | Required | **Not required (hidden)** |
| Super Admin | Required | Required | **Not required (hidden)** |

- For non-student roles, the stepper shows two steps and the **Submit** button is on Step 2. Submitting marks the profile complete; it does not enter the approval workflow in §16.3.

### 16.3 Student approval workflow

```
DRAFT ──submit──▶ SUBMITTED ──Coach approves──▶ COACH_APPROVED ──District Secretary approves──▶ DISTRICT_APPROVED ──▶ ID card
                   ▲  │                                │
                   │  └──Coach rejects──▶ COACH_REJECTED└──District Secretary rejects──▶ DISTRICT_REJECTED
                   │                            │                                              │
                   └────── student edits and resubmits (§16.3.3) ◀──────────────────────────────┘
```

1. **Student submits** the 3-step form. Status becomes `SUBMITTED` and the application appears in the queue of the Coach the student selected.
2. **Coach reviews** the application (read-only view of all steps and documents) and either:
   - **Approves**, entering **ID card validity (1 or 2 years, required)** and **notes (optional)** → `COACH_APPROVED`. The application moves to the District Secretary of the student's district.
   - **Rejects** using the rejection form (§16.3.1) → `COACH_REJECTED`.
3. **District Secretary reviews** (sees the Coach's validity choice and notes) and either:
   - **Approves** with **notes (optional)** → `DISTRICT_APPROVED`. The system generates the **Shooter ID** (§16.5) and sets the ID card issue and expiry dates.
   - **Rejects** using the rejection form (§16.3.1) → `DISTRICT_REJECTED`.
4. The student sees their current status on `/application/summary`, and is notified as in §16.3.2.
5. **After a rejection, the student can edit the application and resubmit it** (§16.3.3). A resubmitted application starts the approval again from the Coach.

#### 16.3.1 Rejection form (Coach and District Secretary)

| Field | Component | Req | Validation |
|---|---|---|---|
| Rejection Type | `Dropdown` | Req | From master data. **Default: "Document Issue"** (`DOCUMENT_ISSUE`). Other options **[ASSUMPTION — see §15 Q18]**: Incorrect Details (`INCORRECT_DETAILS`), Not Eligible (`NOT_ELIGIBLE`), Other (`OTHER`) |
| Notes | `InputTextarea` with a character counter | Req | **Minimum 25 characters** (after trimming), max 500 |

- The **Reject** button stays disabled until the notes are at least 25 characters. The server enforces the same rules (422 otherwise).
- On approval, notes are **optional** (max 500) and there is no rejection type.

#### 16.3.2 Student notifications

- **On rejection** (by Coach or District Secretary):
  - The student receives an **email** with the rejection type and notes, and a link to log in.
  - When the student logs in, `/application/summary` shows a **Rejected** status banner with the **rejection type, notes, who rejected it (Coach / District Secretary) and the date**, and an **Edit and resubmit** button.
- **On District Secretary approval:**
  - The student receives an **email** saying the application is approved, with their Shooter ID, expiry date and a link to log in.
  - When the student logs in, `/application/summary` shows **Approved** with the Shooter ID and expiry date, and a **Download ID card (PDF)** button.
- **[ASSUMPTION]** Coach approval sends no email to the student; the summary page just shows "Approved by Coach, awaiting District approval".

#### 16.3.3 Edit and resubmit after rejection

- When the status is `COACH_REJECTED` or `DISTRICT_REJECTED`, the student can open the form again (**Edit and resubmit**) and change any field or document in all three steps. The same validation as a first submission applies.
- While editing, the rejection reason stays visible at the top of the form. The status stays rejected (and the application stays out of the reviewers' queues) until the student resubmits. **Save for later** works as usual.
- **Resubmit** runs the full submit checks (§3.4), including the declaration, then:
  - sets the status back to `SUBMITTED` and sends the application to the Coach selected in Step 3 (the student may pick a different Coach), and the full approval flow runs again
  - **keeps the same registration number**, and sets a new `submitted_at`
  - clears the previous rejection fields (`rejection_type`, `rejection_notes`, `rejected_by_role`, `rejected_at`) and the previous approval data (`validity_years`, `coach_notes`, `district_notes`)
  - appends a `RESUBMITTED` entry to the approval history. Earlier rejections stay in the history so reviewers can see them
  - emails the student a confirmation
- There is no limit on the number of resubmissions **[ASSUMPTION — see §15 Q20]**.
- A `SUBMITTED`, `COACH_APPROVED` or `DISTRICT_APPROVED` application still cannot be edited (409).

**Rules:**
- Each transition is allowed only from the previous status; the server returns **409** otherwise. Use a DynamoDB conditional update on `status` so two reviewers cannot act at once.
- A Coach can act only on students linked to them. A District Secretary can act only on students in their district.
- Every action (`SUBMITTED`, `RESUBMITTED`, approvals, rejections) is appended to an **approval history** on the registration: `{action, by_user_id, by_role, rejection_type, notes, at}`. History is never edited or deleted.

### 16.4 Coach dashboard

- List of all students linked to the Coach with **name, registration no., status, submitted date, Shooter ID (if issued), expiry date**.
- Filter by status. Default sort: most recently updated first.
- **Download ID card (PDF)** button, shown only for students in `DISTRICT_APPROVED`.
- District Secretary gets the same kind of list for their district (approval queue first). Super Admin gets a user list with **Activate / Reject / Deactivate** for Coach and District Secretary accounts.

### 16.5 Shooter ID (unique ID)

- Format: `SAT` followed by 9 digits, **12 characters in total**, e.g. `SAT000000042`. **[ASSUMPTION — see §15 Q13]**
- **Incremental from a seed value.** The first ID issued is the seed; each approval after that adds 1 (seed `1` → `SAT000000001`, `SAT000000002`, …).
  - The seed comes from the env var `SHOOTER_ID_SEED` (default `1`) and is written to the `counters` table (`name = SHOOTER_ID`) once, only if the counter doesn't exist yet. Changing the env var later does not reset or rewind an existing counter.
  - Generated only when the District Secretary approves, using an atomic `UpdateItem ADD 1` on the counter, then zero-padded to 9 digits.
  - If the counter would pass `999999999`, the approval fails with a clear error instead of issuing a malformed ID.
  - IDs are never reused, even if an approval later fails partway; gaps in the sequence are acceptable.
- Unique and never reused. Stored on the registration as `shooter_id`, with a `UNIQUE#SHOOTER_ID#…` guard item.

### 16.6 ID card validity & PDF

- **Validity:** chosen by the Coach at approval, **1 or 2 years** (`validity_years`).
- **Issue date** = date the District Secretary approved (IST).
- **Expiry date** = issue date + `validity_years` years, minus one day **[ASSUMPTION]** (e.g. approved 26-09-2026, 1 year → expires 25-09-2027). A 29 Feb issue date rolls to 28 Feb.
- After the expiry date, the card shows as **Expired** in the dashboards. Renewal is Phase 2.
- **ID card PDF contents:**
  - Student full name
  - Address (from Step 2)
  - Shooter ID (`SAT…`)
  - **Expiry date** (DD-MM-YYYY), labelled "Valid till"
  - **[ASSUMPTION — see §15 Q16]** Profile photo, issue date, association name/logo from config
- Generated on the server (e.g. `reportlab`, approved addition) on request. The endpoint streams the PDF; it is not stored in S3.
- **Who can download:** the student themselves (after logging in), the student's linked Coach, and the Super Admin. Only when the status is `DISTRICT_APPROVED`.

### 16.7 Data model & API additions

**`users` table:** add `role` (`STUDENT | COACH | DISTRICT_SECRETARY | SUPER_ADMIN`), `account_status` (`ACTIVE | PENDING_ACTIVATION | REJECTED | DEACTIVATED`), `district_code` (District Secretary). Add GSI `role-status-index` (role, account_status).

**`registrations` table:** add `coach_user_id`, `district_code`, `validity_years`, `coach_notes`, `district_notes`, `rejection_type`, `rejection_notes`, `rejected_by_role`, `rejected_at`, `shooter_id`, `id_issued_on`, `id_expires_on`, `approval_history[]`. Add GSI `coach-index` (coach_user_id, updated_at) and `district-index` (district_code, status).

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/coaches?district=` 🔒 | Student | Active coaches for the Step 3 dropdown |
| GET | `/coach/students?status=` 🔒 | Coach | Coach dashboard list |
| POST | `/coach/students/{user_id}/approve` 🔒 | Coach | Body `{validity_years: 1\|2, notes?}` |
| POST | `/coach/students/{user_id}/reject` 🔒 | Coach | Body `{rejection_type = "DOCUMENT_ISSUE", notes}`. Notes min 25 chars |
| GET | `/district/students?status=` 🔒 | District Secretary | District queue |
| POST | `/district/students/{user_id}/approve` 🔒 | District Secretary | Body `{notes?}`. Generates Shooter ID and dates |
| POST | `/district/students/{user_id}/reject` 🔒 | District Secretary | Body `{rejection_type = "DOCUMENT_ISSUE", notes}`. Notes min 25 chars |
| GET | `/students/{user_id}` 🔒 | Coach / District Secretary / Super Admin | Read-only application view (Aadhaar masked) |
| GET | `/students/{user_id}/id-card.pdf` 🔒 | Coach / Super Admin | ID card PDF, only when `DISTRICT_APPROVED` |
| GET | `/registration/id-card.pdf` 🔒 | Student | The student's own ID card PDF, only when `DISTRICT_APPROVED` |
| GET | `/admin/users?role=&status=` 🔒 | Super Admin | Coach / District Secretary accounts |
| POST | `/admin/users/{user_id}/activate` \| `/reject` \| `/deactivate` 🔒 | Super Admin | Account approval |

Wrong role → **403**. Record not linked to the caller → **404** (don't reveal it exists).

### 16.8 Acceptance criteria (additions)

15. A Coach or District Secretary cannot log in until a Super Admin activates the account. Only a Super Admin can activate them.
16. Coach, District Secretary and Super Admin see only Steps 1–2 and can complete their profile without Step 3. Students must complete all three.
17. A submitted application appears only in the selected Coach's queue. Coach approval requires validity (1 or 2 years); approval notes are optional.
18. After Coach approval, the application appears only in the correct district's queue. District approval notes are optional.
18a. The rejection form (Coach and District) defaults Rejection Type to "Document Issue". Notes under 25 characters are rejected on client and server.
18b. A rejected student receives an email, and after login sees the rejection type and notes on the summary page.
18d. A rejected student can edit all steps and resubmit. The application returns to `SUBMITTED` in the Coach's queue with the same registration number, the rejection fields are cleared, and the history shows the earlier rejection and a `RESUBMITTED` entry. Submitted or approved applications still return 409 on edit.
18c. An approved student receives an email, and after login can download their own ID card PDF.
19. Out-of-order transitions (e.g. District approving a `SUBMITTED` application) return 409. Other coaches/districts get 404.
20. On District approval a unique `SAT` + 9-digit Shooter ID is issued, incrementing by 1 from `SHOOTER_ID_SEED`, and expiry = approval date + the Coach's 1 or 2 years.
21. The Coach list shows every linked student with status. The ID card PDF downloads only for `DISTRICT_APPROVED` students and shows name, address, Shooter ID and expiry date.

### 16.9 Build order (additions, after §13 step 9)

11. Roles in `users` + JWT, role guard dependency, Super Admin seed script, Register-as choice, pending-activation login message.
12. Role-based stepper (Steps 1–2 only for staff roles) and the Step 3 coach dropdown.
13. Workflow service (status transitions, conditional updates, history) with tests.
14. Coach, District Secretary and Super Admin dashboards.
15. Shooter ID counter, expiry calculation, ID card PDF endpoint, with tests.
