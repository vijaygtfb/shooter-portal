import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { IconField } from "primereact/iconfield";
import { InputIcon } from "primereact/inputicon";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { ExpiryText, StatusTag } from "@/components/StatusTag";
import { useToast } from "@/components/ToastProvider";
import { downloadIdCardPdf } from "@/features/idCard/idCardPdf";
import { idCardData } from "@/features/idCard/idCardData";
import { districtLabel, labelOf } from "@/features/masterData/data";
import { STATUS_LABELS, type RegStatus } from "@/features/registration/model";
import { errorMessage } from "@/lib/apiClient";
import { formatDate, isExpired } from "@/lib/dates";
import type { StudentListItem } from "./schema";
import { fetchStudent, fetchStudents, type ReviewerScope } from "./workflowApi";

const COPY: Record<ReviewerScope, { title: string; subtitle: string; pending: RegStatus | null; pendingLabel: string }> = {
  coach: {
    title: "My students",
    subtitle: "Students who chose you as their Coach. Review new applications, then download ID cards once the District Secretary approves.",
    pending: "SUBMITTED",
    pendingLabel: "Awaiting my approval",
  },
  district: {
    title: "District queue",
    subtitle: "Applications approved by a Coach in your district. Approve to issue the Shooter ID, or reject with a reason.",
    pending: "COACH_APPROVED",
    pendingLabel: "Awaiting my approval",
  },
  admin: {
    title: "All students",
    subtitle: "Every student application in the portal.",
    pending: null,
    pendingLabel: "",
  },
};

/** Coach / District Secretary / Super Admin list of students with status (REQUIREMENTS §16.4). */
export function StudentListPage({ scope }: { scope: ReviewerScope }) {
  const navigate = useNavigate();
  const toast = useToast();
  const copy = COPY[scope];
  const [rows, setRows] = useState<StudentListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RegStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    fetchStudents(scope)
      .then(setRows)
      .catch((err) => setError(errorMessage(err)));
  }, [scope]);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, expired: 0, total: rows?.length ?? 0 };
    rows?.forEach((r) => {
      if (r.status === copy.pending) c.pending += 1;
      if (r.status === "DISTRICT_APPROVED") c.approved += 1;
      if (r.status.endsWith("REJECTED")) c.rejected += 1;
      if (r.status === "DISTRICT_APPROVED" && isExpired(r.id_expires_on)) c.expired += 1;
    });
    return c;
  }, [rows, copy.pending]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (status === "ALL" || r.status === status) &&
        (!q || [r.name, r.email, r.registration_no, r.shooter_id].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [rows, status, search]);

  const statusOptions = [
    { label: "All statuses", value: "ALL" },
    ...Array.from(new Set((rows ?? []).map((r) => r.status))).map((s) => ({ label: STATUS_LABELS[s], value: s })),
  ];

  const onDownload = async (row: StudentListItem) => {
    setDownloading(row.user_id);
    try {
      const card = idCardData(await fetchStudent(row.user_id));
      if (!card) throw new Error("not approved");
      await downloadIdCardPdf(card);
    } catch (err) {
      toast({ severity: "error", summary: "Download failed", detail: errorMessage(err, "Could not create the ID card PDF.") });
    } finally {
      setDownloading(null);
    }
  };

  const stat = (label: string, value: number, icon: string, onClick?: () => void, tone = "") => (
    <button type="button" className={`stat ${tone}`} onClick={onClick} disabled={!onClick}>
      <i className={icon} aria-hidden="true" />
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </button>
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{copy.title}</h1>
          <p className="muted">{copy.subtitle}</p>
        </div>
      </div>

      {error && <Message severity="error" text={error} className="w-full" />}

      <div className="stats">
        {copy.pending && stat(copy.pendingLabel, counts.pending, "pi pi-inbox", () => setStatus(copy.pending ?? "ALL"), "tone-warn")}
        {stat("Approved (ID issued)", counts.approved, "pi pi-verified", () => setStatus("DISTRICT_APPROVED"), "tone-ok")}
        {stat("Rejected", counts.rejected, "pi pi-times-circle", undefined, "tone-bad")}
        {stat("Expired cards", counts.expired, "pi pi-calendar-times")}
        {stat("Total", counts.total, "pi pi-users", () => setStatus("ALL"))}
      </div>

      <section className="card">
        <div className="toolbar">
          <IconField iconPosition="left">
            <InputIcon className="pi pi-search" />
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, reg. no or Shooter ID" aria-label="Search students" className="search-input" />
          </IconField>
          <Dropdown value={status} options={statusOptions} onChange={(e) => setStatus(e.value)} aria-label="Filter by status" />
        </div>
        <DataTable
          value={filtered}
          loading={rows === null && !error}
          dataKey="user_id"
          paginator
          rows={10}
          rowsPerPageOptions={[10, 25, 50]}
          stripedRows
          size="small"
          emptyMessage="No students match."
          onRowClick={(e) => navigate(`/review/${(e.data as StudentListItem).user_id}`)}
          rowClassName={(r: StudentListItem) => (r.status === copy.pending ? "row-pending clickable" : "clickable")}
          responsiveLayout="stack"
          breakpoint="820px"
        >
          <Column
            header="Student"
            sortable
            sortField="name"
            body={(r: StudentListItem) => (
              <div>
                <strong>{r.name}</strong>
                <div className="muted small">{r.email}</div>
              </div>
            )}
          />
          <Column field="registration_no" header="Reg. no." sortable body={(r: StudentListItem) => r.registration_no ?? <span className="muted">Draft</span>} />
          <Column header="Main event" body={(r: StudentListItem) => labelOf("main_events", r.main_event)} />
          {scope !== "coach" && <Column header="Coach" body={(r: StudentListItem) => r.coach_name ?? "-"} />}
          {scope === "admin" && <Column header="District" body={(r: StudentListItem) => districtLabel(undefined, r.district_code ?? undefined)} />}
          <Column field="status" header="Status" sortable body={(r: StudentListItem) => <StatusTag status={r.status} />} />
          <Column field="submitted_at" header="Submitted" sortable body={(r: StudentListItem) => formatDate(r.submitted_at)} />
          <Column field="shooter_id" header="Shooter ID" body={(r: StudentListItem) => r.shooter_id ?? <span className="muted">-</span>} />
          <Column header="Valid till" body={(r: StudentListItem) => <ExpiryText expiresOn={r.id_expires_on} />} />
          <Column
            header="Actions"
            body={(r: StudentListItem) => (
              <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                <Button
                  label={r.status === copy.pending ? "Review" : "View"}
                  icon={r.status === copy.pending ? "pi pi-check-square" : "pi pi-eye"}
                  size="small"
                  className={r.status === copy.pending ? "btn-primary" : undefined}
                  outlined={r.status !== copy.pending}
                  onClick={() => navigate(`/review/${r.user_id}`)}
                />
                {r.status === "DISTRICT_APPROVED" && scope !== "district" && (
                  <Button icon="pi pi-download" rounded text aria-label={`Download ID card for ${r.name}`} tooltip="Download ID card (PDF)" tooltipOptions={{ position: "left" }} loading={downloading === r.user_id} onClick={() => onDownload(r)} />
                )}
              </div>
            )}
          />
        </DataTable>
      </section>
    </div>
  );
}
