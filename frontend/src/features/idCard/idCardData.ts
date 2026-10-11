import { districtLabel, labelOf } from "@/features/masterData/data";
import { fullName, step1Values, step2Values, type Registration } from "@/features/registration/model";

/** Everything printed on the ID card (REQUIREMENTS §16.6). */
export interface IdCardData {
  name: string;
  address: string;
  shooterId: string;
  mainEvent: string;
  issuedOn: string;
  expiresOn: string;
  registrationNo: string;
  district: string;
}

/** Returns null unless the application is District-approved and has a Shooter ID. */
export function idCardData(r: Registration): IdCardData | null {
  if (r.status !== "DISTRICT_APPROVED" || !r.shooter_id || !r.id_expires_on || !r.id_issued_on) return null;
  const b = step1Values(r);
  const p = step2Values(r);
  const address = [p.address, districtLabel(p.state, p.city), `${labelOf("states", p.state)} - ${p.pincode}`].filter(Boolean).join(", ");
  return {
    name: fullName(r),
    address,
    shooterId: r.shooter_id,
    mainEvent: labelOf("main_events", b.main_event),
    issuedOn: r.id_issued_on,
    expiresOn: r.id_expires_on,
    registrationNo: r.registration_no ?? "-",
    district: districtLabel(p.state, p.city),
  };
}
