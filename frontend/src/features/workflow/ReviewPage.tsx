import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { PageSpinner } from "@/components/RequireAuth";
import { StatusTag } from "@/components/StatusTag";
import { useToast } from "@/components/ToastProvider";
import { homePath, useAuth } from "@/features/auth/AuthContext";
import { ROLE_LABELS } from "@/features/auth/schema";
import { IdCardPanel } from "@/features/idCard/IdCard";
import { idCardData } from "@/features/idCard/idCardData";
import { labelOf } from "@/features/masterData/data";
import { ApplicationView, HistoryTimeline } from "@/features/registration/ApplicationView";
import { fullName, isRejected, type Registration } from "@/features/registration/model";
import { WorkflowProgress } from "@/features/registration/WorkflowProgress";
import { errorMessage } from "@/lib/apiClient";
import { formatDate, formatDateTime } from "@/lib/dates";
import { CoachApproveDialog, DistrictApproveDialog, RejectDialog } from "./DecisionDialogs";
import { coachApprove, coachReject, districtApprove, districtReject, fetchStudent } from "./workflowApi";

/** A reviewer's view of one student, with the actions their role may take (REQUIREMENTS §16.3). */
export function ReviewPage() {
  const { userId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [reg, setReg] = useState<Registration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    fetchStudent(userId).then(setReg).catch((err) => setError(errorMessage(err)));
  }, [userId]);

  if (!user) return null;
  if (error) {
    return (
      <div className="page">
        <Message severity="error" text={error} className="w-full" />
        <Button label="Back" icon="pi pi-arrow-left" text onClick={() => navigate(homePath(user.role))} className="mt-3" />
      </div>
    );
  }
  if (!reg) return <PageSpinner />;

  const name = fullName(reg);
  const canCoach = user.role === "COACH" && reg.status === "SUBMITTED";
  const canDistrict = user.role === "DISTRICT_SECRETARY" && reg.status === "COACH_APPROVED";
  const canAct = canCoach || canDistrict;
  const card = user.role !== "DISTRICT_SECRETARY" ? idCardData(reg) : null;

  const run = async (action: () => Promise<Registration>, success: string) => {
    try {
      const updated = await action();
      setReg(updated);
      setDialog(null);
      toast({ severity: "success", summary: success, detail: updated.shooter_id && updated.status === "DISTRICT_APPROVED" ? `Shooter ID ${updated.shooter_id} issued.` : undefined });
    } catch (err) {
      toast({ severity: "error", summary: "Action failed", detail: errorMessage(err) });
    }
  };

  return (
    <div className="page">
      <Button label="Back to list" icon="pi pi-arrow-left" text onClick={() => navigate(user.role === "SUPER_ADMIN" ? "/admin/students" : homePath(user.role))} className="back-link" />
      <div className="page-head">
        <div>
          <h1>{name}</h1>
          <p className="muted">
            Registration no. <strong>{reg.registration_no ?? "-"}</strong> · {reg.email} · submitted {formatDateTime(reg.submitted_at)}
          </p>
        </div>
        <StatusTag status={reg.status} />
      </div>

      <section className="card">
        <WorkflowProgress status={reg.status} />
        {canAct && (
          <div className="decision-bar">
            <div>
              <strong>{canCoach ? "Your approval is needed" : "Awaiting your approval"}</strong>
              <p className="muted small">
                {canCoach
                  ? "Check the details and documents. On approval you choose how long the ID card is valid (1 or 2 years)."
                  : `Approved by the Coach with ${reg.validity_years} year validity. Approving issues the Shooter ID.`}
              </p>
            </div>
            <div className="decision-buttons">
              <Button label="Reject" icon="pi pi-times" severity="danger" outlined onClick={() => setDialog("reject")} />
              <Button label="Approve" icon="pi pi-check" severity="success" onClick={() => setDialog("approve")} />
            </div>
          </div>
        )}
        {isRejected(reg.status) && (
          <Message
            severity="error"
            className="w-full mt-3"
            content={
              <div>
                <strong>Rejected by {reg.rejected_by_role ? ROLE_LABELS[reg.rejected_by_role] : "-"}</strong> on {formatDate(reg.rejected_at)} · {labelOf("rejection_types", reg.rejection_type)}
                <div>{reg.rejection_notes}</div>
              </div>
            }
          />
        )}
        {reg.status === "COACH_APPROVED" && reg.coach_notes && (
          <Message severity="info" className="w-full mt-3" text={`Coach notes: ${reg.coach_notes}`} />
        )}
      </section>

      {card && <IdCardPanel card={card} />}
      {user.role === "DISTRICT_SECRETARY" && reg.status === "DISTRICT_APPROVED" && (
        <Message severity="success" className="w-full" text={`Shooter ID ${reg.shooter_id} issued on ${formatDate(reg.id_issued_on)}, valid till ${formatDate(reg.id_expires_on)}. The Coach and student can download the ID card.`} />
      )}

      <div className="two-col">
        <section className="card">
          <ApplicationView registration={reg} />
        </section>
        <section className="card side-card">
          <h3 className="section-title">History</h3>
          <HistoryTimeline history={reg.approval_history} />
        </section>
      </div>

      {canCoach && (
        <CoachApproveDialog visible={dialog === "approve"} studentName={name} onHide={() => setDialog(null)} onConfirm={(v) => run(() => coachApprove(reg.user_id, v), "Approved and sent to the District Secretary")} />
      )}
      {canDistrict && (
        <DistrictApproveDialog visible={dialog === "approve"} studentName={name} validityYears={reg.validity_years} onHide={() => setDialog(null)} onConfirm={(v) => run(() => districtApprove(reg.user_id, v), "Application approved")} />
      )}
      {canAct && (
        <RejectDialog
          visible={dialog === "reject"}
          studentName={name}
          onHide={() => setDialog(null)}
          onConfirm={(v) => run(() => (canCoach ? coachReject(reg.user_id, v) : districtReject(reg.user_id, v)), "Application rejected. The student has been emailed.")}
        />
      )}
    </div>
  );
}
