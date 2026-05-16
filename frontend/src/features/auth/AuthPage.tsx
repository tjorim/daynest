import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";

function buildRedirectPath(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "from" in value &&
    typeof value.from === "string" &&
    value.from.startsWith("/")
  ) {
    return value.from;
  }

  return "/today";
}

export function AuthPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const location = useLocation();
  const redirectTo = buildRedirectPath(location.state);

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <section className="auth-shell">
      <div className="card shadow-sm">
        <div className="card-body p-4 text-center">
          <h2 className="h4 mb-1">Sign in to Daynest</h2>
          <p className="text-muted mb-3">
            Use your account to sync Today, Calendar, and future planning modules.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={login}
            disabled={isLoading}
          >
            {isLoading ? "Loading…" : "Sign in"}
          </button>
        </div>
      </div>
    </section>
  );
}
