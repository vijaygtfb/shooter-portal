import { useState, type ReactNode } from "react";
import { Button } from "primereact/button";
import { Timeline } from "primereact/timeline";
import { Tag } from "primereact/tag";
import { ROLE_LABELS } from "@/features/auth/schema";
import { DocumentPreview } from "@/features/documents/DocumentPreview";
import { DOC_RULES, formatBytes, type DocRef } from "@/features/documents/schema";
import { districtLabel, labelOf } from "@/features/masterData/data";
import { ageOn, formatDate, formatDateTime, todayIst } from "@/lib/dates";
import { maskAadhaar } from "@/lib/validators";
import { step1Values, step2Values, step3Values, submitValues, type HistoryEntry, type Registration } from "./model";

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="dl-item">
      <dt>{label}</dt>
      <dd>{children === "" || children === null || children === undefined ? <span className="muted">-</span> : children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="view-section">
      <h3 className="section-title">{title}</h3>
      {children}
    </section>
  );
}

/** Read-only view of an application (student summary and reviewer pages). Aadhaar is always masked. */
export function ApplicationView({ registration }: { registration: Registration }) {
  const [preview, setPreview] = useState<DocRef | null>(null);
  const b = step1Values(registration);
  const p = step2Values(registration);
  const m = step3Values(registration);
  const s = submitValues(registration);
  const isStudent = registration.role === "STUDENT";
  const age = b.dob ? ageOn(b.dob, todayIst()) : null;

  const docs = [b.birth_proof, b.profile_photo, b.action_photo, p.address_proof, m.passport_file, m.non_criminal_cert].filter((d): d is DocRef => !!d);

  return (
    <div className="application-view">
      <Section title="Basic Info">
        <dl className="dl-grid">
          <Item label="Name">{[b.first_name, b.last_name].filter(Boolean).join(" ")}</Item>
          <Item label="State / Unit">{b.state_unit}</Item>
          <Item label="Main event">{labelOf("main_events", b.main_event)}</Item>
          <Item label="Playing events">{b.playing_events.map((e) => labelOf("main_events", e)).join(", ")}</Item>
          <Item label="Date of birth">{b.dob ? `${formatDate(b.dob)} (age ${age})` : ""}</Item>
          <Item label="Place of birth">{b.place_of_birth}</Item>
          <Item label="Gender">{labelOf("genders", b.gender)}</Item>
          <Item label="Education">{b.education}</Item>
          <Item label="Email">{registration.email}</Item>
          <Item label="Mobile">
            {b.mobile ? (
              <>
                +91 {b.mobile} {registration.mobile_verified && <Tag value="Verified" severity="success" className="ml-1" />}
              </>
            ) : (
              ""
            )}
          </Item>
          <Item label="Alt. contact">{b.alt_mobile}</Item>
        </dl>
      </Section>

      <Section title="Personal Information">
        <dl className="dl-grid">
          <Item label="Mother name">{p.mother_name}</Item>
          <Item label="Father name">{p.father_name}</Item>
          <Item label="Marital status">{labelOf("marital_statuses", p.marital_status)}</Item>
          {p.marital_status === "MARRIED" && <Item label="Spouse name">{p.spouse_name}</Item>}
          <Item label="Address">{p.address}</Item>
          <Item label="City / District">{districtLabel(p.state, p.city)}</Item>
          <Item label="State">{labelOf("states", p.state)}</Item>
          <Item label="Pincode">{p.pincode}</Item>
          <Item label="Aadhaar">{p.aadhaar_on_file ? maskAadhaar(p.aadhaar_last4) : ""}</Item>
          <Item label="Mailing address">{p.mailing_same ? "Same as address" : p.mailing_address}</Item>
          <Item label="Height / Weight">{[p.height_cm && `${p.height_cm} cm`, p.weight_kg && `${p.weight_kg} kg`].filter(Boolean).join(" / ")}</Item>
          <Item label="Track suit / T-shirt / Shoe">{[p.track_suit_size, p.tshirt_size, p.shoe_size_uk && `UK ${p.shoe_size_uk}`].filter(Boolean).join(" / ")}</Item>
        </dl>
      </Section>

      {isStudent && (
        <Section title="Membership & Other Info">
          <dl className="dl-grid">
            <Item label="Approving coach">{registration.coach_name}</Item>
            <Item label="Passport">
              {m.passport_number
                ? `${m.passport_number} · issued ${formatDate(m.passport_issue_date)} · expires ${formatDate(m.passport_expiry_date)} · ${m.passport_issuing_authority}, ${m.passport_place_of_issue}`
                : "Not provided"}
            </Item>
          </dl>
          <h4 className="sub-title">Weapons</h4>
          {m.weapons.length ? (
            <div className="table-scroll">
              <table className="simple-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Make</th>
                    <th>Model</th>
                    <th>Caliber</th>
                    <th>Serial no.</th>
                  </tr>
                </thead>
                <tbody>
                  {m.weapons.map((w, i) => (
                    <tr key={i}>
                      <td>{labelOf("weapon_types", w.type)}</td>
                      <td>{w.make}</td>
                      <td>{w.model || "-"}</td>
                      <td>{w.caliber || "-"}</td>
                      <td>{w.serial_no}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">None</p>
          )}
          <h4 className="sub-title">Coaching history</h4>
          {m.coaches.length ? (
            <ul className="plain-list">
              {m.coaches.map((c, i) => (
                <li key={i}>
                  {c.name}: {formatDate(c.from)} to {c.to ? formatDate(c.to) : "present"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">None</p>
          )}
          {s.guardian_name && (
            <>
              <h4 className="sub-title">Guardian consent</h4>
              <p>
                {s.guardian_name} ({labelOf("guardian_relationships", s.guardian_relationship)}) {s.guardian_consent && <Tag value="Consent given" severity="success" />}
              </p>
            </>
          )}
        </Section>
      )}

      <Section title="Documents">
        {docs.length ? (
          <ul className="doc-list">
            {docs.map((d) => (
              <li key={d.key}>
                <i className={d.content_type === "application/pdf" ? "pi pi-file-pdf" : "pi pi-image"} aria-hidden="true" />
                <span className="doc-type">{DOC_RULES[d.doc_type].label}</span>
                <span className="muted small">
                  {d.file_name} ({formatBytes(d.size)})
                </span>
                <Button icon="pi pi-eye" label="View" text size="small" onClick={() => setPreview(d)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No documents uploaded.</p>
        )}
      </Section>
      <DocumentPreview doc={preview} onHide={() => setPreview(null)} />
    </div>
  );
}

const ACTION_TEXT: Record<HistoryEntry["action"], { label: string; icon: string; color: string }> = {
  SUBMITTED: { label: "Submitted", icon: "pi pi-send", color: "#3b82f6" },
  RESUBMITTED: { label: "Resubmitted after correction", icon: "pi pi-replay", color: "#6366f1" },
  COACH_APPROVED: { label: "Approved by Coach", icon: "pi pi-check", color: "#22c55e" },
  COACH_REJECTED: { label: "Rejected by Coach", icon: "pi pi-times", color: "#ef4444" },
  DISTRICT_APPROVED: { label: "Approved by District Secretary", icon: "pi pi-verified", color: "#16a34a" },
  DISTRICT_REJECTED: { label: "Rejected by District Secretary", icon: "pi pi-times", color: "#ef4444" },
};

/** Approval history (REQUIREMENTS §16.3): every action, never edited. */
export function HistoryTimeline({ history }: { history: HistoryEntry[] }) {
  if (!history.length) return <p className="muted">No actions yet.</p>;
  return (
    <Timeline
      value={history}
      className="history"
      marker={(h: HistoryEntry) => (
        <span className="history-marker" style={{ background: ACTION_TEXT[h.action].color }}>
          <i className={ACTION_TEXT[h.action].icon} aria-hidden="true" />
        </span>
      )}
      content={(h: HistoryEntry) => (
        <div className="history-item">
          <strong>{ACTION_TEXT[h.action].label}</strong>
          <div className="muted small">
            {h.by_name} ({ROLE_LABELS[h.by_role]}) · {formatDateTime(h.at)}
          </div>
          {h.validity_years && <div className="small">ID card validity: {h.validity_years} year{h.validity_years > 1 ? "s" : ""}</div>}
          {h.rejection_type && <div className="small">Rejection type: {labelOf("rejection_types", h.rejection_type)}</div>}
          {h.notes && <blockquote className="history-notes">{h.notes}</blockquote>}
        </div>
      )}
    />
  );
}
