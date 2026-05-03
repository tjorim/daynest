import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { AuthPage } from "../../features/auth/AuthPage";
import { TodayPage } from "../../features/today/TodayPage";
import { CalendarPage } from "../../features/calendar/CalendarPage";
import { MedicationPage } from "../../features/medication/MedicationPage";
import { SettingsPage } from "../../features/settings/SettingsPage";
import { TemplatesPage } from "../../features/templates/TemplatesPage";

function RequireAuth() {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="alert alert-info py-2">Loading session...</div>;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/auth"
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
  }

  return <Outlet />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/today" element={<TodayPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/medication" element={<MedicationPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}
