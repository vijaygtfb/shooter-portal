import { NavLink, Outlet, useNavigate } from "react-router";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { config } from "@/config";
import { useAuth } from "@/features/auth/AuthContext";
import { ROLE_LABELS, type Role } from "@/features/auth/schema";
import { Logo } from "./Logo";

const NAV: Record<Role, { to: string; label: string; icon: string }[]> = {
  STUDENT: [{ to: "/application", label: "My application", icon: "pi pi-id-card" }],
  COACH: [
    { to: "/coach", label: "My students", icon: "pi pi-users" },
    { to: "/application", label: "My profile", icon: "pi pi-user" },
  ],
  DISTRICT_SECRETARY: [
    { to: "/district", label: "District queue", icon: "pi pi-inbox" },
    { to: "/application", label: "My profile", icon: "pi pi-user" },
  ],
  SUPER_ADMIN: [
    { to: "/admin", label: "Staff accounts", icon: "pi pi-user-plus" },
    { to: "/admin/students", label: "All students", icon: "pi pi-users" },
    { to: "/application", label: "My profile", icon: "pi pi-user" },
  ],
};

export function DemoBanner() {
  if (!config.useMockApi) return null;
  return (
    <div className="demo-banner" role="note">
      <i className="pi pi-info-circle" aria-hidden="true" /> Demo mode: dummy data, no real emails or SMS. OTP is always{" "}
      <strong>123456</strong>.
      <NavLink to="/demo/mailbox" className="demo-banner-link">
        Open demo mailbox
      </NavLink>
    </div>
  );
}

/** Layout for signed-in pages: header with role navigation, then the page. */
export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app">
      <DemoBanner />
      <header className="app-header">
        <NavLink to="/" className="app-brand" aria-label="Home">
          <Logo size={34} />
        </NavLink>
        <nav className="app-nav" aria-label="Main">
          {NAV[user.role].map((item) => (
            <NavLink key={item.to} to={item.to} end className={({ isActive }) => `app-nav-link${isActive ? " active" : ""}`}>
              <i className={item.icon} aria-hidden="true" /> {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="app-user">
          <span className="app-user-name">
            {user.full_name ?? user.email}
            <Tag value={ROLE_LABELS[user.role]} className="app-role-tag" />
          </span>
          <Button label="Log out" icon="pi pi-sign-out" text size="small" onClick={onLogout} className="app-logout" />
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
