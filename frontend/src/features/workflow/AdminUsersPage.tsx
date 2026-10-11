import { useEffect, useMemo, useState } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { SelectButton } from "primereact/selectbutton";
import { Tag } from "primereact/tag";
import { Dialog } from "primereact/dialog";
import { Message } from "primereact/message";
import { useToast } from "@/components/ToastProvider";
import { ROLE_LABELS, type AccountStatus } from "@/features/auth/schema";
import { districtLabel } from "@/features/masterData/data";
import { errorMessage } from "@/lib/apiClient";
import { formatDate } from "@/lib/dates";
import type { StaffUser } from "./schema";
import { changeStaffStatus, fetchStaffUsers } from "./workflowApi";

type Action = "activate" | "reject" | "deactivate";

const STATUS_TAG: Record<AccountStatus, { label: string; severity: "success" | "warning" | "danger" | "secondary" }> = {
  ACTIVE: { label: "Active", severity: "success" },
  PENDING_ACTIVATION: { label: "Pending activation", severity: "warning" },
  REJECTED: { label: "Rejected", severity: "danger" },
  DEACTIVATED: { label: "Deactivated", severity: "secondary" },
};

const ACTION_COPY: Record<Action, { label: string; verb: string; icon: string; severity: "success" | "danger" | "secondary"; text: string }> = {
  activate: { label: "Activate", verb: "activated", icon: "pi pi-check", severity: "success", text: "They will be able to log in straight away." },
  reject: { label: "Reject", verb: "rejected", icon: "pi pi-times", severity: "danger", text: "They will not be able to log in." },
  deactivate: { label: "Deactivate", verb: "deactivated", icon: "pi pi-ban", severity: "secondary", text: "They will be logged out and can no longer log in." },
};

/** Super Admin: activate / reject / deactivate Coach and District Secretary logins (REQUIREMENTS §16.1). */
export function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"PENDING" | "ALL">("PENDING");
  const [confirm, setConfirm] = useState<{ user: StaffUser; action: Action } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchStaffUsers().then(setUsers).catch((err) => setError(errorMessage(err)));
  }, []);

  const pendingCount = users?.filter((u) => u.account_status === "PENDING_ACTIVATION").length ?? 0;
  const shown = useMemo(() => (users ?? []).filter((u) => view === "ALL" || u.account_status === "PENDING_ACTIVATION"), [users, view]);

  const onConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      const updated = await changeStaffStatus(confirm.user.user_id, confirm.action);
      setUsers((list) => (list ?? []).map((u) => (u.user_id === updated.user_id ? updated : u)));
      toast({ severity: "success", summary: `Account ${ACTION_COPY[confirm.action].verb}`, detail: `${updated.full_name ?? updated.email} has been emailed.` });
      setConfirm(null);
    } catch (err) {
      toast({ severity: "error", summary: "Action failed", detail: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const actions = (u: StaffUser) => {
    const list: Action[] =
      u.account_status === "PENDING_ACTIVATION" ? ["activate", "reject"] : u.account_status === "ACTIVE" ? ["deactivate"] : ["activate"];
    return (
      <div className="row-actions">
        {list.map((a) => (
          <Button key={a} label={ACTION_COPY[a].label} icon={ACTION_COPY[a].icon} size="small" severity={ACTION_COPY[a].severity} outlined={a !== "activate"} onClick={() => setConfirm({ user: u, action: a })} />
        ))}
      </div>
    );
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Staff accounts</h1>
          <p className="muted">Only the Super Admin can activate Coach and District Secretary logins.</p>
        </div>
      </div>
      {error && <Message severity="error" text={error} className="w-full" />}
      <section className="card">
        <div className="toolbar">
          <SelectButton
            value={view}
            onChange={(e) => e.value && setView(e.value)}
            options={[
              { label: `Pending activation (${pendingCount})`, value: "PENDING" },
              { label: "All staff", value: "ALL" },
            ]}
            allowEmpty={false}
          />
        </div>
        <DataTable value={shown} loading={users === null && !error} dataKey="user_id" stripedRows size="small" emptyMessage={view === "PENDING" ? "No accounts are waiting for activation." : "No staff accounts."} responsiveLayout="stack" breakpoint="820px">
          <Column
            header="Name"
            body={(u: StaffUser) => (
              <div>
                <strong>{u.full_name ?? "-"}</strong>
                <div className="muted small">{u.email}</div>
              </div>
            )}
          />
          <Column header="Role" body={(u: StaffUser) => ROLE_LABELS[u.role]} />
          <Column header="District" body={(u: StaffUser) => districtLabel(u.state_code ?? undefined, u.district_code ?? undefined)} />
          <Column header="Registered" body={(u: StaffUser) => formatDate(u.created_at)} />
          <Column header="Status" body={(u: StaffUser) => <Tag value={STATUS_TAG[u.account_status].label} severity={STATUS_TAG[u.account_status].severity} />} />
          <Column header="Actions" body={actions} />
        </DataTable>
      </section>

      <Dialog
        header={confirm ? `${ACTION_COPY[confirm.action].label} ${ROLE_LABELS[confirm.user.role]} account?` : ""}
        visible={!!confirm}
        onHide={() => setConfirm(null)}
        modal
        style={{ width: "28rem" }}
        breakpoints={{ "640px": "95vw" }}
        footer={
          <div className="dialog-actions">
            <Button label="Cancel" text onClick={() => setConfirm(null)} />
            {confirm && <Button label={ACTION_COPY[confirm.action].label} icon={ACTION_COPY[confirm.action].icon} severity={ACTION_COPY[confirm.action].severity} loading={busy} onClick={onConfirm} />}
          </div>
        }
      >
        {confirm && (
          <p>
            <strong>{confirm.user.full_name ?? confirm.user.email}</strong> ({confirm.user.email}). {ACTION_COPY[confirm.action].text}
          </p>
        )}
      </Dialog>
    </div>
  );
}
