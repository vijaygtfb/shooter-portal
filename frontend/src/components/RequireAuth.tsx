import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { ProgressSpinner } from "primereact/progressspinner";
import { homePath, useAuth } from "@/features/auth/AuthContext";
import type { Role } from "@/features/auth/schema";

/** Protects a route. Wrong role -> that role's home page. The server enforces the same rules. */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, restoring } = useAuth();
  const location = useLocation();
  if (restoring) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePath(user.role)} replace />;
  return <>{children}</>;
}

export function PageSpinner() {
  return (
    <div className="page-spinner" role="status" aria-label="Loading">
      <ProgressSpinner style={{ width: 48, height: 48 }} strokeWidth="4" />
    </div>
  );
}
