/**
 * Master data (REQUIREMENTS §7). In production this JSON is served by GET /master-data from
 * backend/app/master_data/. Code arrays below drive the Zod enums and must match the backend exactly.
 */

export interface Option<T extends string = string> {
  code: T;
  label: string;
}

export const MAIN_EVENTS = ["RIFLE", "PISTOL", "SHOTGUN", "BIG_BORE"] as const;
export type MainEvent = (typeof MAIN_EVENTS)[number];

export const WEAPON_TYPES = [
  "10M_AIR_PISTOL",
  "50M_PISTOL",
  "10M_AIR_RIFLE",
  "50M_RIFLE_MEN",
  "50M_RIFLE_WOMEN",
  "25M_RIM_FIRE_PISTOL",
  "25M_CENTER_FIRE_PISTOL",
] as const;

export const GENDERS = ["MALE", "FEMALE", "OTHERS"] as const;
export const MARITAL_STATUSES = ["MARRIED", "UNMARRIED", "DIVORCED", "WIDOWED"] as const;
export const APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;
export const GUARDIAN_RELATIONSHIPS = ["FATHER", "MOTHER", "LEGAL_GUARDIAN"] as const;
export const REJECTION_TYPES = ["DOCUMENT_ISSUE", "INCORRECT_DETAILS", "NOT_ELIGIBLE", "OTHER"] as const;
export type RejectionType = (typeof REJECTION_TYPES)[number];
export const DEFAULT_REJECTION_TYPE: RejectionType = "DOCUMENT_ISSUE";

const MH_DISTRICTS = [
  "Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara", "Buldhana", "Chandrapur",
  "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur",
  "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar",
  "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur",
  "Thane", "Wardha", "Washim", "Yavatmal",
];

function toOptions(labels: string[]): Option[] {
  return labels.map((label) => ({ code: label.toUpperCase().replace(/[^A-Z]+/g, "_"), label }));
}

const label = (codes: readonly string[], labels: Record<string, string> = {}): Option[] =>
  codes.map((code) => ({
    code,
    label: labels[code] ?? code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, " "),
  }));

export const MASTER_DATA = {
  version: "2026.09.1",
  states: [
    { code: "MH", label: "Maharashtra" },
    { code: "GA", label: "Goa" },
    { code: "GJ", label: "Gujarat" },
    { code: "KA", label: "Karnataka" },
    { code: "DL", label: "Delhi" },
  ],
  districts: {
    MH: toOptions(MH_DISTRICTS),
    GA: toOptions(["North Goa", "South Goa"]),
    GJ: toOptions(["Ahmedabad", "Gandhinagar", "Rajkot", "Surat", "Vadodara"]),
    KA: toOptions(["Bengaluru Urban", "Belagavi", "Dharwad", "Mysuru"]),
    DL: toOptions(["New Delhi", "North Delhi", "South Delhi"]),
  } as Record<string, Option[]>,
  state_units: [
    { code: "MAHARASHTRA", label: "MAHARASHTRA" },
    { code: "GOA", label: "GOA" },
    { code: "GUJARAT", label: "GUJARAT" },
    { code: "KARNATAKA", label: "KARNATAKA" },
    { code: "DELHI", label: "DELHI" },
  ],
  main_events: label(MAIN_EVENTS, { BIG_BORE: "Big Bore" }),
  weapon_types: label(WEAPON_TYPES, {
    "10M_AIR_PISTOL": "10m Air Pistol",
    "50M_PISTOL": "50m Pistol",
    "10M_AIR_RIFLE": "10m Air Rifle",
    "50M_RIFLE_MEN": "50m Rifle Men",
    "50M_RIFLE_WOMEN": "50m Rifle Women",
    "25M_RIM_FIRE_PISTOL": "25m Rim Fire Pistol",
    "25M_CENTER_FIRE_PISTOL": "25m Center Fire Pistol",
  }),
  genders: label(GENDERS),
  marital_statuses: label(MARITAL_STATUSES),
  apparel_sizes: APPAREL_SIZES.map((code) => ({ code, label: code })),
  guardian_relationships: label(GUARDIAN_RELATIONSHIPS),
  rejection_types: label(REJECTION_TYPES, { NOT_ELIGIBLE: "Not eligible" }),
};

export type MasterData = typeof MASTER_DATA;

export const STATE_CODES = MASTER_DATA.states.map((s) => s.code);
export const STATE_UNIT_CODES = MASTER_DATA.state_units.map((s) => s.code);

export function districtLabel(stateCode: string | undefined, districtCode: string | undefined): string {
  if (!districtCode) return "-";
  const all = stateCode ? MASTER_DATA.districts[stateCode] ?? [] : Object.values(MASTER_DATA.districts).flat();
  return all.find((d) => d.code === districtCode)?.label ?? districtCode;
}

export function isDistrictOf(stateCode: string, districtCode: string): boolean {
  return (MASTER_DATA.districts[stateCode] ?? []).some((d) => d.code === districtCode);
}

/** Label for any code in a master-data list, e.g. labelOf("weapon_types", "10M_AIR_RIFLE"). */
export function labelOf(
  list: "states" | "state_units" | "main_events" | "weapon_types" | "genders" | "marital_statuses" | "apparel_sizes" | "guardian_relationships" | "rejection_types",
  code: string | null | undefined,
): string {
  if (!code) return "-";
  return (MASTER_DATA[list] as Option[]).find((o) => o.code === code)?.label ?? code;
}
