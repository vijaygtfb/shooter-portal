/**
 * DEMO ONLY - dummy accounts and applications used to present the workflow.
 * Every account's password is DEMO_PASSWORD. See DEMO_ACCOUNTS for the list shown on the login page.
 */
import type { DocRef, DocType } from "@/features/documents/schema";
import type { Role } from "@/features/auth/schema";
import { idCardExpiry } from "@/lib/dates";
import { verhoeffAppend } from "@/lib/validators";
import type { Db, Mail, RegRec, UserRec } from "./db";
import { DB_VERSION } from "./db";
import { DEMO_PASSWORD } from "./demoAccounts";
import { demoHash } from "./util";

export { DEMO_OTP, DEMO_PASSWORD } from "./demoAccounts";

/** REQUIREMENTS §16.5: the first Shooter ID issued is the seed; each approval adds 1. */
export const SHOOTER_ID_SEED = 1;

const T0 = "2026-01-05T09:00:00.000Z";

function doc(userId: string, docType: DocType, fileName: string, contentType = "application/pdf", size = 245_760): DocRef {
  return {
    doc_type: docType,
    key: `users/${userId}/${docType}/seed-${fileName}`,
    file_name: fileName,
    content_type: contentType,
    size,
    uploaded_at: T0,
  };
}

function user(
  id: string,
  email: string,
  role: Role,
  fullName: string,
  mobile: string | null,
  district: string,
  status: UserRec["account_status"] = "ACTIVE",
): UserRec {
  return {
    user_id: id,
    email,
    password: DEMO_PASSWORD,
    role,
    account_status: status,
    full_name: fullName,
    state_code: "MH",
    district_code: district,
    mobile,
    failed_logins: 0,
    locked_until: null,
    created_at: T0,
  };
}

function emptyReg(userId: string): RegRec {
  return {
    user_id: userId,
    status: "DRAFT",
    current_step: 1,
    basic_info: null,
    personal_info: null,
    membership: null,
    submit_info: null,
    aadhaar_hash: null,
    registration_no: null,
    coach_user_id: null,
    district_code: null,
    validity_years: null,
    coach_notes: null,
    district_notes: null,
    rejection_type: null,
    rejection_notes: null,
    rejected_by_role: null,
    rejected_at: null,
    shooter_id: null,
    id_issued_on: null,
    id_expires_on: null,
    approval_history: [],
    created_at: T0,
    updated_at: T0,
    submitted_at: null,
  };
}

interface PersonSpec {
  id: string;
  first: string;
  last: string;
  dob: string;
  gender: "MALE" | "FEMALE";
  event: "RIFLE" | "PISTOL" | "SHOTGUN";
  mobile10: string;
  aadhaarBase: string; // 11 digits; the Verhoeff check digit is appended
  address: string;
  city?: string;
  pincode?: string;
}

function profile(p: PersonSpec): Pick<RegRec, "basic_info" | "personal_info" | "aadhaar_hash"> {
  const aadhaar = verhoeffAppend(p.aadhaarBase);
  return {
    basic_info: {
      state_unit: "MAHARASHTRA",
      first_name: p.first,
      last_name: p.last,
      main_event: p.event,
      playing_events: p.event === "PISTOL" ? ["PISTOL", "RIFLE"] : [p.event],
      education: "B.Com",
      dob: p.dob,
      birth_proof: doc(p.id, "BIRTH_PROOF", "birth-certificate.pdf"),
      place_of_birth: p.city === "NAGPUR" ? "Nagpur" : "Pune",
      mobile: p.mobile10,
      alt_mobile: "",
      gender: p.gender,
      profile_photo: doc(p.id, "PROFILE_PHOTO", "photo.jpg", "image/jpeg", 184_320),
      action_photo: null,
    },
    personal_info: {
      mother_name: "Sunita " + p.last,
      father_name: "Ramesh " + p.last,
      marital_status: "UNMARRIED",
      spouse_name: "",
      address: p.address,
      state: "MH",
      city: p.city ?? "PUNE",
      pincode: p.pincode ?? "411004",
      aadhaar_no: "",
      aadhaar_on_file: true,
      aadhaar_last4: aadhaar.slice(-4),
      address_proof: doc(p.id, "ADDRESS_PROOF", "electricity-bill.pdf"),
      mailing_same: true,
      mailing_address: p.address,
      height_cm: 172,
      weight_kg: 64,
      track_suit_size: "M",
      tshirt_size: "M",
      shoe_size_uk: 8,
    },
    aadhaar_hash: demoHash(aadhaar),
  };
}

function membership(p: PersonSpec, coachId: string, adult: boolean): Record<string, unknown> {
  return {
    coach_user_id: coachId,
    passport_number: "",
    passport_file: null,
    passport_issue_date: "",
    passport_expiry_date: "",
    passport_issuing_authority: "",
    passport_place_of_issue: "",
    weapons: [
      {
        type: p.event === "PISTOL" ? "10M_AIR_PISTOL" : "10M_AIR_RIFLE",
        make: p.event === "PISTOL" ? "Morini" : "Walther",
        model: p.event === "PISTOL" ? "CM 162EI" : "LG400",
        caliber: ".177",
        serial_no: `SN-${p.id.slice(-5).toUpperCase()}-01`,
      },
    ],
    coaches: [{ name: "Vikram Rathod", from: "2023-06-01", to: "" }],
    non_criminal_cert: adult ? doc(p.id, "NON_CRIMINAL_CERT", "police-clearance.pdf") : null,
  };
}

const COACH = "u-coach-1";
const DS = "u-ds-1";

function submitted(reg: RegRec, regNo: string, at: string, name: string): RegRec {
  return {
    ...reg,
    status: "SUBMITTED",
    current_step: 3,
    registration_no: regNo,
    coach_user_id: COACH,
    district_code: "PUNE",
    submitted_at: at,
    updated_at: at,
    submit_info: { declaration: true, guardian_name: "", guardian_relationship: "", guardian_consent: false },
    approval_history: [{ action: "SUBMITTED", by_user_id: reg.user_id, by_role: "STUDENT", by_name: name, at }],
  };
}

function coachApproved(reg: RegRec, years: 1 | 2, notes: string, at: string): RegRec {
  return {
    ...reg,
    status: "COACH_APPROVED",
    validity_years: years,
    coach_notes: notes,
    updated_at: at,
    approval_history: [
      ...reg.approval_history,
      { action: "COACH_APPROVED", by_user_id: COACH, by_role: "COACH", by_name: "Vikram Rathod", validity_years: years, notes, at },
    ],
  };
}

function districtApproved(reg: RegRec, shooterId: string, issuedOn: string, at: string): RegRec {
  return {
    ...reg,
    status: "DISTRICT_APPROVED",
    shooter_id: shooterId,
    id_issued_on: issuedOn,
    id_expires_on: idCardExpiry(issuedOn, reg.validity_years ?? 1),
    district_notes: "Documents verified.",
    updated_at: at,
    approval_history: [
      ...reg.approval_history,
      { action: "DISTRICT_APPROVED", by_user_id: DS, by_role: "DISTRICT_SECRETARY", by_name: "Suresh Jadhav", notes: "Documents verified.", at },
    ],
  };
}

export function buildSeed(): Db {
  const users: UserRec[] = [
    user("u-admin", "superadmin@demo.in", "SUPER_ADMIN", "Priya Nair", "+919820000001", "PUNE"),
    user(COACH, "coach@demo.in", "COACH", "Vikram Rathod", "+919820000002", "PUNE"),
    user("u-coach-2", "coach2@demo.in", "COACH", "Anjali Mehta", "+919820000003", "PUNE"),
    user(DS, "district@demo.in", "DISTRICT_SECRETARY", "Suresh Jadhav", "+919820000004", "PUNE"),
    user("u-coach-3", "newcoach@demo.in", "COACH", "Nikhil Wagh", null, "NAGPUR", "PENDING_ACTIVATION"),
    user("u-ds-2", "district.nashik@demo.in", "DISTRICT_SECRETARY", "Kavita Bhosale", null, "NASHIK", "PENDING_ACTIVATION"),
  ];
  const registrations: Record<string, RegRec> = {};

  // Staff profiles (Steps 1-2 only).
  const staff: [string, string, string, "MALE" | "FEMALE", string][] = [
    ["u-admin", "Priya", "Nair", "FEMALE", "9820000001"],
    [COACH, "Vikram", "Rathod", "MALE", "9820000002"],
    ["u-coach-2", "Anjali", "Mehta", "FEMALE", "9820000003"],
    [DS, "Suresh", "Jadhav", "MALE", "9820000004"],
  ];
  staff.forEach(([id, first, last, gender, mobile10], i) => {
    const p: PersonSpec = {
      id, first, last, gender, dob: `198${i}-0${i + 2}-1${i}`, event: "RIFLE", mobile10,
      aadhaarBase: `5${i}0012345${i}7`, address: `${10 + i}, Model Colony, Shivajinagar`,
    };
    registrations[id] = { ...emptyReg(id), ...profile(p), status: "PROFILE_COMPLETE", current_step: 2, submit_info: { declaration: true } };
  });
  registrations["u-coach-3"] = emptyReg("u-coach-3");
  registrations["u-ds-2"] = emptyReg("u-ds-2");

  const students: (PersonSpec & { email: string })[] = [
    { id: "u-stu-sneha", email: "sneha.joshi@demo.in", first: "Sneha", last: "Joshi", dob: "2006-01-18", gender: "FEMALE", event: "RIFLE", mobile10: "9876500001", aadhaarBase: "23456789012", address: "Flat 12, Sai Residency, Kothrud" },
    { id: "u-stu-dev", email: "dev.gaikwad@demo.in", first: "Dev", last: "Gaikwad", dob: "2003-08-09", gender: "MALE", event: "PISTOL", mobile10: "9876500002", aadhaarBase: "34567890123", address: "22, Laxmi Road, Sadashiv Peth" },
    { id: "u-stu-rohan", email: "rohan.deshmukh@demo.in", first: "Rohan", last: "Deshmukh", dob: "2000-11-30", gender: "MALE", event: "PISTOL", mobile10: "9876500003", aadhaarBase: "45678901234", address: "B-4, Green Park Society, Aundh" },
    { id: "u-stu-aarav", email: "aarav.patil@demo.in", first: "Aarav", last: "Patil", dob: "2004-03-14", gender: "MALE", event: "RIFLE", mobile10: "9876500004", aadhaarBase: "56789012345", address: "7, Tilak Nagar, Hadapsar" },
    { id: "u-stu-isha", email: "isha.kulkarni@demo.in", first: "Isha", last: "Kulkarni", dob: "2011-07-02", gender: "FEMALE", event: "RIFLE", mobile10: "9876500005", aadhaarBase: "67890123456", address: "15, Prabhat Road, Erandwane" },
    { id: "u-stu-kabir", email: "kabir.shinde@demo.in", first: "Kabir", last: "Shinde", dob: "2002-05-21", gender: "MALE", event: "SHOTGUN", mobile10: "9876500006", aadhaarBase: "78901234567", address: "3, Rasta Peth, Near Post Office" },
    { id: "u-stu-meera", email: "meera.pawar@demo.in", first: "Meera", last: "Pawar", dob: "2005-12-03", gender: "FEMALE", event: "PISTOL", mobile10: "9876500007", aadhaarBase: "89012345678", address: "9, Baner Road, Baner" },
    { id: "u-stu-arjun", email: "arjun.more@demo.in", first: "Arjun", last: "More", dob: "2007-02-25", gender: "MALE", event: "RIFLE", mobile10: "9876500008", aadhaarBase: "90123456789", address: "44, Karve Nagar" },
  ];

  for (const s of students) {
    const name = `${s.first} ${s.last}`;
    users.push(user(s.id, s.email, "STUDENT", name, `+91${s.mobile10}`, "PUNE"));
    const adult = s.dob <= "2008-09-26";
    const base: RegRec = { ...emptyReg(s.id), ...profile(s), membership: membership(s, COACH, adult) };
    let reg: RegRec;
    switch (s.id) {
      case "u-stu-dev":
        reg = districtApproved(coachApproved(submitted(base, "PUNE-2024-00001", "2024-05-02T06:30:00.000Z", name), 1, "Regular at the range since 2023.", "2024-05-06T08:00:00.000Z"), "SAT000000001", "2024-05-10", "2024-05-10T10:15:00.000Z");
        break;
      case "u-stu-sneha":
        reg = districtApproved(coachApproved(submitted(base, "PUNE-2026-00001", "2026-08-20T05:30:00.000Z", name), 1, "Good attendance and discipline.", "2026-08-25T07:00:00.000Z"), "SAT000000002", "2026-09-01", "2026-09-01T09:45:00.000Z");
        break;
      case "u-stu-rohan":
        reg = coachApproved(submitted(base, "PUNE-2026-00002", "2026-09-10T04:00:00.000Z", name), 2, "Competes at state level. Recommend 2-year card.", "2026-09-15T06:20:00.000Z");
        break;
      case "u-stu-aarav":
        reg = submitted(base, "PUNE-2026-00003", "2026-09-20T11:10:00.000Z", name);
        break;
      case "u-stu-isha":
        reg = submitted(base, "PUNE-2026-00004", "2026-09-22T12:40:00.000Z", name);
        reg.submit_info = { declaration: true, guardian_name: "Mandar Kulkarni", guardian_relationship: "FATHER", guardian_consent: true };
        break;
      case "u-stu-kabir": {
        const at = "2026-09-18T10:00:00.000Z";
        const notes = "Birth proof is blurred and the date of birth is not readable. Please upload a clear scan.";
        reg = submitted(base, "PUNE-2026-00005", "2026-09-16T09:00:00.000Z", name);
        reg = {
          ...reg, status: "COACH_REJECTED", rejection_type: "DOCUMENT_ISSUE", rejection_notes: notes, rejected_by_role: "COACH", rejected_at: at, updated_at: at,
          approval_history: [...reg.approval_history, { action: "COACH_REJECTED", by_user_id: COACH, by_role: "COACH", by_name: "Vikram Rathod", rejection_type: "DOCUMENT_ISSUE", notes, at }],
        };
        break;
      }
      case "u-stu-meera": {
        const at = "2026-09-19T08:30:00.000Z";
        const notes = "The address on the address proof does not match the address entered in the application.";
        reg = coachApproved(submitted(base, "PUNE-2026-00006", "2026-09-12T07:00:00.000Z", name), 1, "Attends weekend sessions.", "2026-09-14T06:00:00.000Z");
        reg = {
          ...reg, status: "DISTRICT_REJECTED", rejection_type: "INCORRECT_DETAILS", rejection_notes: notes, rejected_by_role: "DISTRICT_SECRETARY", rejected_at: at, updated_at: at,
          approval_history: [...reg.approval_history, { action: "DISTRICT_REJECTED", by_user_id: DS, by_role: "DISTRICT_SECRETARY", by_name: "Suresh Jadhav", rejection_type: "INCORRECT_DETAILS", notes, at }],
        };
        break;
      }
      default: {
        // Arjun: draft saved at Step 2 with Step 2 partly filled.
        const personal = { ...(base.personal_info ?? {}), aadhaar_on_file: false, aadhaar_last4: "", address_proof: null, pincode: "" };
        reg = { ...base, personal_info: personal, aadhaar_hash: null, membership: null, current_step: 2, updated_at: "2026-09-24T15:00:00.000Z" };
      }
    }
    registrations[s.id] = reg;
  }

  const mailbox: Mail[] = [
    {
      id: "m-seed-3", to: "meera.pawar@demo.in", channel: "EMAIL", at: "2026-09-19T08:30:00.000Z",
      subject: "Your Shooter ID application was not approved",
      body: "Dear Meera Pawar,\n\nYour application PUNE-2026-00006 was rejected by the District Secretary.\n\nRejection type: Incorrect details\nNotes: The address on the address proof does not match the address entered in the application.\n\nLog in to the portal to see the details, correct your application and resubmit it.",
    },
    {
      id: "m-seed-2", to: "kabir.shinde@demo.in", channel: "EMAIL", at: "2026-09-18T10:00:00.000Z",
      subject: "Your Shooter ID application was not approved",
      body: "Dear Kabir Shinde,\n\nYour application PUNE-2026-00005 was rejected by your Coach.\n\nRejection type: Document issue\nNotes: Birth proof is blurred and the date of birth is not readable. Please upload a clear scan.\n\nLog in to the portal to see the details, correct your application and resubmit it.",
    },
    {
      id: "m-seed-1", to: "sneha.joshi@demo.in", channel: "EMAIL", at: "2026-09-01T09:45:00.000Z",
      subject: "Your Shooter ID is approved - SAT000000002",
      body: "Dear Sneha Joshi,\n\nYour application PUNE-2026-00001 has been approved.\n\nShooter ID: SAT000000002\nValid till: 31-08-2027\n\nLog in to the portal to download your ID card.",
    },
  ];

  return {
    version: DB_VERSION,
    users,
    registrations,
    counters: { SHOOTER_ID: 2, REG_NO: 6 },
    otps: {},
    email_tokens: {},
    access_tokens: {},
    refresh_tokens: {},
    reset_tokens: {},
    captchas: {},
    mailbox,
  };
}
