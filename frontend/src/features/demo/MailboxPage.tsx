import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { Message } from "primereact/message";
import { DemoBanner } from "@/components/AppShell";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/features/auth/AuthContext";
import { errorMessage } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/dates";
import { fetchMailbox, type DemoMail } from "./demoApi";

/** DEMO ONLY - shows the emails and SMS the system would have sent (OTP, reset link, approval, rejection). */
export function MailboxPage() {
  const { user } = useAuth();
  const [mails, setMails] = useState<DemoMail[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchMailbox().then(setMails).catch((err) => setError(errorMessage(err)));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="app">
      <DemoBanner />
      <header className="app-header">
        <Link to="/" className="app-brand">
          <Logo size={34} />
        </Link>
        <div className="app-user">
          <Link to={user ? "/" : "/login"}>{user ? "Back to portal" : "Back to login"}</Link>
        </div>
      </header>
      <main className="app-main">
        <div className="page narrow">
          <div className="page-head">
            <div>
              <h1>Demo mailbox</h1>
              <p className="muted">Every email and SMS the portal "sent" during the demo, newest first. The real system delivers these through Amazon SES / SNS.</p>
            </div>
            <Button label="Refresh" icon="pi pi-refresh" outlined onClick={load} />
          </div>
          {error && <Message severity="error" text={error} className="w-full" />}
          {mails?.length === 0 && <p className="muted">No messages yet.</p>}
          <ul className="mail-list">
            {mails?.map((m) => (
              <li key={m.id} className="card mail">
                <div className="row-between">
                  <div>
                    <Tag value={m.channel} severity={m.channel === "SMS" ? "warning" : "info"} className="mr-2" />
                    <strong>{m.channel === "SMS" ? "SMS" : m.subject}</strong>
                  </div>
                  <span className="muted small">{formatDateTime(m.at)}</span>
                </div>
                <div className="muted small">To: {m.to}</div>
                <pre className="mail-body">{m.body}</pre>
                {m.link && (
                  <a href={m.link} className="mail-link">
                    <i className="pi pi-external-link" aria-hidden="true" /> {m.link.includes("reset-password") ? "Reset password" : "Open link"}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
