import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "@/components/AppShell";
import { PageSpinner, RequireAuth } from "@/components/RequireAuth";
import { config } from "@/config";
import { AuthProvider, homePath, useAuth } from "@/features/auth/AuthContext";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { MailboxPage } from "@/features/demo/MailboxPage";
import { ApplicationPage } from "@/features/registration/ApplicationPage";
import { SummaryPage } from "@/features/registration/SummaryPage";
import { AdminUsersPage } from "@/features/workflow/AdminUsersPage";
import { ReviewPage } from "@/features/workflow/ReviewPage";
import { StudentListPage } from "@/features/workflow/StudentListPage";

function Home() {
  const { user, restoring } = useAuth();
  if (restoring) return <PageSpinner />;
  return <Navigate to={user ? homePath(user.role) : "/login"} replace />;
}

/** Routes (REQUIREMENTS §10, §16). Role checks here are for UX; the API enforces them. */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          {config.useMockApi && <Route path="/demo/mailbox" element={<MailboxPage />} />}

          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/application" element={<ApplicationPage />} />
            <Route
              path="/application/summary"
              element={
                <RequireAuth roles={["STUDENT"]}>
                  <SummaryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/coach"
              element={
                <RequireAuth roles={["COACH"]}>
                  <StudentListPage scope="coach" />
                </RequireAuth>
              }
            />
            <Route
              path="/district"
              element={
                <RequireAuth roles={["DISTRICT_SECRETARY"]}>
                  <StudentListPage scope="district" />
                </RequireAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth roles={["SUPER_ADMIN"]}>
                  <AdminUsersPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/students"
              element={
                <RequireAuth roles={["SUPER_ADMIN"]}>
                  <StudentListPage scope="admin" />
                </RequireAuth>
              }
            />
            <Route
              path="/review/:userId"
              element={
                <RequireAuth roles={["COACH", "DISTRICT_SECRETARY", "SUPER_ADMIN"]}>
                  <ReviewPage />
                </RequireAuth>
              }
            />
          </Route>
          <Route path="*" element={<Home />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
