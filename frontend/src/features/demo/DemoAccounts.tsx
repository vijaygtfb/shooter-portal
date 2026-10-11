import { useState } from "react";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { config } from "@/config";
import { ROLE_LABELS } from "@/features/auth/schema";
import { useToast } from "@/components/ToastProvider";
import { errorMessage } from "@/lib/apiClient";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/mocks/demoAccounts";
import { resetDemoData } from "./demoApi";

/** DEMO ONLY - one-click sign-in for the presentation. Hidden when useMockApi is false. */
export function DemoAccounts({ onPick }: { onPick: (email: string, password: string) => void }) {
  const toast = useToast();
  const [resetting, setResetting] = useState(false);
  if (!config.useMockApi) return null;

  const onReset = async () => {
    setResetting(true);
    try {
      const r = await resetDemoData();
      toast({ severity: "success", summary: "Demo reset", detail: r.message });
    } catch (err) {
      toast({ severity: "error", summary: "Reset failed", detail: errorMessage(err) });
    } finally {
      setResetting(false);
    }
  };

  return (
    <aside className="demo-accounts" aria-labelledby="demo-accounts-title">
      <h3 id="demo-accounts-title">Demo accounts</h3>
      <p className="muted">
        Password for every account: <code>{DEMO_PASSWORD}</code>. Click one to fill the form.
      </p>
      <ul>
        {DEMO_ACCOUNTS.map((a) => (
          <li key={a.email}>
            <button type="button" className="demo-account" onClick={() => onPick(a.email, DEMO_PASSWORD)}>
              <span className="demo-account-top">
                <strong>{a.name}</strong>
                <Tag value={ROLE_LABELS[a.role]} severity={a.role === "STUDENT" ? "info" : a.role === "SUPER_ADMIN" ? "danger" : "warning"} />
              </span>
              <span className="demo-account-email">{a.email}</span>
              <span className="muted small">{a.note}</span>
            </button>
          </li>
        ))}
      </ul>
      <Button label="Reset demo data" icon="pi pi-refresh" outlined size="small" onClick={onReset} loading={resetting} />
    </aside>
  );
}
