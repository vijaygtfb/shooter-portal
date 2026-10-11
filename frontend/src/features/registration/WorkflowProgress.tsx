import type { RegStatus } from "./model";

const STAGES = ["Submitted", "Coach approval", "District approval", "ID card issued"];

function stageState(status: RegStatus, i: number): "done" | "current" | "failed" | "todo" {
  const reachedIndex: Record<RegStatus, number> = {
    DRAFT: -1,
    PROFILE_COMPLETE: -1,
    SUBMITTED: 1,
    COACH_APPROVED: 2,
    COACH_REJECTED: 1,
    DISTRICT_APPROVED: 4,
    DISTRICT_REJECTED: 2,
  };
  const at = reachedIndex[status];
  if (i < at) return "done";
  if (i === at) return status.endsWith("REJECTED") ? "failed" : "current";
  return "todo";
}

/** Horizontal progress of the approval workflow (REQUIREMENTS §16.3). */
export function WorkflowProgress({ status }: { status: RegStatus }) {
  return (
    <ol className="workflow" aria-label="Approval progress">
      {STAGES.map((label, i) => {
        const s = stageState(status, i);
        return (
          <li key={label} className={`workflow-step ${s}`} aria-current={s === "current" ? "step" : undefined}>
            <span className="workflow-dot">
              {s === "done" ? <i className="pi pi-check" /> : s === "failed" ? <i className="pi pi-times" /> : i + 1}
            </span>
            <span className="workflow-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
