import { Navigate, useSearch } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";
import { useAuth } from "@/app/providers/AuthProvider";
import { AUTH_ROUTE_PATHS } from "@/config/oidc";

function buildRedirectPath(value: unknown): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    const pathname = value.split(/[?#]/)[0] ?? "";
    return AUTH_ROUTE_PATHS.has(pathname) ? "/today" : value;
  }

  return "/today";
}

export function AuthPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const search = useSearch({ from: "/auth" });
  const redirectTo = buildRedirectPath(search.from);

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <section className="auth-shell">
      <div className="card shadow-sm">
        <div className="card-body p-4 text-center">
          <h2 className="h4 mb-1">{m.auth_title()}</h2>
          <p className="text-muted mb-3">
            {m.auth_subtitle()}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={login}
            disabled={isLoading}
          >
            {isLoading ? m.auth_loading() : m.auth_sign_in()}
          </button>
        </div>
      </div>
    </section>
  );
}
