import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { PageSpinner } from "@/components/RequireAuth";
import { StatusTag } from "@/components/StatusTag";
import { ROLE_LABELS } from "@/features/auth/schema";
import { IdCardPanel } from "@/features/idCard/IdCard";
import { idCardData } from "@/features/idCard/idCardData";
import { labelOf } from "@/features/masterData/data";
import { errorMessage } from "@/lib/apiClient";
import { formatDate, formatDateTime } from "@/lib/dates";
import { ApplicationView, HistoryTimeline } from "./ApplicationView";
import { fullName, isRejected, type Registration } from "./model";
import { fetchRegistration } from "./registrationApi";
import { WorkflowProgress } from "./WorkflowProgress";

/** Read-only summary after submit, with status, rejection reason or the ID card (REQUIREMENTS §2.2, §16.3.2). */
export function SummaryPage() {
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRegistration().then(setRegistration).catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <Message severity="error" text={error} className="w-full" />;
  if (!registration) return <PageSpinner />;
  if (registration.role !== "STUDENT" || registration.status === "DRAFT") return <Navigate to="/application" replace />;

  const card = idCardData(registration);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>My application</h1>
          <p className="muted">
            {fullName(registration)} · Registration no. <strong>{registration.registration_no}</strong> · submitted {formatDateTime(registration.submitted_at)}
          </p>
        </div>
        <StatusTag status={registration.status} />
      </div>

      <section className="card">
        <WorkflowProgress status={registration.status} />
        <StatusBanner registration={registration} />
      </section>

      {card && <IdCardPanel card={card} />}

      <div className="two-col">
        <section className="card">
          <ApplicationView registration={registration} />
        </section>
        <section className="card side-card">
          <h3 className="section-title">History</h3>
          <HistoryTimeline history={registration.approval_history} />
        </section>
      </div>
    </div>
  );
}

function EditAndResubmit() {
  const navigate = useNavigate();
  return <Button label="Edit and resubmit" icon="pi pi-pencil" className="btn-primary" onClick={() => navigate("/application", { state: { edit: true } })} />;
}

function StatusBanner({ registration: r }: { registration: Registration }) {
  if (isRejected(r.status)) {
    return (
      <div className="status-banner rejected" role="alert">
        <i className="pi pi-times-circle" aria-hidden="true" />
        <div>
          <h3>Your application was rejected</h3>
          <dl className="dl-inline">
            <div>
              <dt>Rejected by</dt>
              <dd>{r.rejected_by_role ? ROLE_LABELS[r.rejected_by_role] : "-"}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatDate(r.rejected_at)}</dd>
            </div>
            <div>
              <dt>Rejection type</dt>
              <dd>{labelOf("rejection_types", r.rejection_type)}</dd>
            </div>
          </dl>
          <p className="rejection-notes">
            <strong>Reason: </strong>
            {r.rejection_notes}
          </p>
          <div className="row-between">
            <p className="muted small">Correct the details or documents mentioned above, then resubmit. Your application will go to your Coach again.</p>
            <EditAndResubmit />
          </div>
        </div>
      </div>
    );
  }
  if (r.status === "DISTRICT_APPROVED") {
    return (
      <div className="status-banner approved">
        <i className="pi pi-verified" aria-hidden="true" />
        <div>
          <h3>Approved. Your Shooter ID is {r.shooter_id}</h3>
          <p>
            Valid till <strong>{formatDate(r.id_expires_on)}</strong> ({r.validity_years} year{r.validity_years === 1 ? "" : "s"} from {formatDate(r.id_issued_on)}). Download your ID card below.
          </p>
        </div>
      </div>
    );
  }
  if (r.status === "COACH_APPROVED") {
    return (
      <div className="status-banner pending">
        <i className="pi pi-hourglass" aria-hidden="true" />
        <div>
          <h3>Approved by your Coach, awaiting District Secretary approval</h3>
          <p>You will receive an email once the District Secretary has reviewed your application.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="status-banner pending">
      <i className="pi pi-hourglass" aria-hidden="true" />
      <div>
        <h3>Submitted, awaiting Coach approval</h3>
        <p>Your application is with {r.coach_name ?? "your Coach"}. You can no longer edit it.</p>
      </div>
    </div>
  );
}
