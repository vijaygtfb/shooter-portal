import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Message } from "primereact/message";
import { PageSpinner } from "@/components/RequireAuth";
import { useToast } from "@/components/ToastProvider";
import { homePath, useAuth } from "@/features/auth/AuthContext";
import { ROLE_LABELS } from "@/features/auth/schema";
import { errorMessage } from "@/lib/apiClient";
import { labelOf } from "@/features/masterData/data";
import { formatDate } from "@/lib/dates";
import { isRejected, isStudentEditable, step1Values, step2Values, stepCount, type Registration } from "./model";
import { fetchRegistration } from "./registrationApi";
import { Step1Form } from "./Step1Form";
import { Step2Form } from "./Step2Form";
import { Step3Form } from "./Step3Form";
import { Stepper } from "./Stepper";

const STEP_LABELS = ["Basic Info", "Personal Information", "Membership & Other Info"];

/**
 * Multi-step application (REQUIREMENTS §2.4). Students fill 3 steps; staff roles fill 2 (§16.2).
 * All steps stay mounted so unsaved changes survive Previous / Next.
 */
export function ApplicationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  /** Rejected applications open for editing only via "Edit and resubmit"; otherwise show the summary. */
  const editRequested = (location.state as { edit?: boolean } | null)?.edit === true;
  const toast = useToast();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(1);
  const [reached, setReached] = useState(1);

  useEffect(() => {
    fetchRegistration()
      .then((r) => {
        setRegistration(r);
        // A rejected application was complete when submitted, so every step is reachable.
        const start = isRejected(r.status) ? 1 : r.current_step;
        setActive(start);
        setReached(isRejected(r.status) ? stepCount(r.role) : r.current_step);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <Message severity="error" text={error} className="w-full" />;
  if (!registration || !user) return <PageSpinner />;
  if (registration.role === "STUDENT" && (!isStudentEditable(registration.status) || (isRejected(registration.status) && !editRequested))) {
    return <Navigate to="/application/summary" replace />;
  }

  const total = stepCount(registration.role);
  const labels = STEP_LABELS.slice(0, total);
  const go = (n: number) => {
    setActive(n);
    setReached((r) => Math.max(r, n));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmitted = (r: Registration) => {
    setRegistration(r);
    if (r.role === "STUDENT") {
      const again = r.approval_history.at(-1)?.action === "RESUBMITTED";
      toast({
        severity: "success",
        summary: again ? "Application resubmitted" : "Application submitted",
        detail: `Registration no. ${r.registration_no}. It has been sent to your Coach for approval.`,
        life: 6000,
      });
      navigate("/application/summary", { replace: true });
    } else {
      toast({ severity: "success", summary: "Profile saved", detail: "Your profile is complete." });
      navigate(homePath(r.role), { replace: true });
    }
  };

  const dob = step1Values(registration).dob;
  const district = step2Values(registration).city;

  return (
    <div className="application">
      <aside className="application-side">
        <p className="application-side-title">{registration.role === "STUDENT" ? "Shooter ID Application" : `${ROLE_LABELS[registration.role]} Profile`}</p>
        <Stepper steps={labels} active={active} reached={reached} onSelect={go} />
        {registration.role !== "STUDENT" && (
          <p className="application-side-note">Staff accounts fill only Basic Info and Personal Information.</p>
        )}
      </aside>
      <div className="application-main">
        {isRejected(registration.status) && (
          <div className="status-banner rejected mb-3" role="alert">
            <i className="pi pi-pencil" aria-hidden="true" />
            <div>
              <h3>Correct your application and resubmit</h3>
              <p>
                Rejected by the {registration.rejected_by_role === "COACH" ? "Coach" : "District Secretary"} on {formatDate(registration.rejected_at)} ·{" "}
                {labelOf("rejection_types", registration.rejection_type)}
              </p>
              <p className="rejection-notes">
                <strong>Reason: </strong>
                {registration.rejection_notes}
              </p>
              <p className="small">Update any step, then press Resubmit application on the last step. It will go to your Coach for approval again.</p>
            </div>
          </div>
        )}
        {registration.status === "PROFILE_COMPLETE" && (
          <Message severity="success" text="Your profile is complete. You can update it and submit again at any time." className="w-full mb-3" />
        )}
        <div className="step-panel" hidden={active !== 1}>
          <Step1Form registration={registration} onSaved={setRegistration} onNext={() => go(2)} />
        </div>
        <div className="step-panel" hidden={active !== 2}>
          <Step2Form
            registration={registration}
            isLast={total === 2}
            onSaved={setRegistration}
            onNext={() => go(3)}
            onPrevious={() => go(1)}
            onSubmitted={onSubmitted}
          />
        </div>
        {total === 3 && (
          <div className="step-panel" hidden={active !== 3}>
            {/* Remount when DOB or district changes: they drive Step 3 rules and the coach list. */}
            <Step3Form key={`${dob}|${district}`} registration={registration} onSaved={setRegistration} onPrevious={() => go(2)} onSubmitted={onSubmitted} />
          </div>
        )}
      </div>
    </div>
  );
}
