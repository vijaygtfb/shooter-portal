import type { ReactNode } from "react";
import { DemoBanner } from "./AppShell";
import { Logo } from "./Logo";

/** Layout for signed-out pages (login, register, forgot/reset password). */
export function AuthLayout({ title, subtitle, children, aside, wide }: { title: string; subtitle?: string; children: ReactNode; aside?: ReactNode; wide?: boolean }) {
  return (
    <div className="auth-page">
      <DemoBanner />
      <div className="auth-body">
        <div className="auth-brand">
          <Logo size={48} />
          <h1>New Shooter ID Registration</h1>
        </div>
        <div className={`auth-columns${aside ? " with-aside" : ""}`}>
          <section className={`auth-card${wide ? " wide" : ""}`} aria-labelledby="auth-title">
            <header className="auth-card-header">
              <h2 id="auth-title">{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </header>
            <div className="auth-card-body">{children}</div>
          </section>
          {aside}
        </div>
      </div>
    </div>
  );
}
