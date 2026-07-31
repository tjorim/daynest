import { useState } from "react";
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
  const { isAuthenticated, isAccountRejected, isLoading, login, logout, oidcError } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const search = useSearch({ from: "/auth" });
  const redirectTo = buildRedirectPath(search.from);

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // The redirect to the provider is asynchronous. Without a local pending flag
  // the button stays idle and clickable while it resolves, so an impatient
  // second click starts a second authorization request.
  const startLogin = () => {
    setIsRedirecting(true);
    login();
  };

  const isBusy = isLoading || isRedirecting;

  return (
    <section className="auth-shell">
      <div className="card shadow-sm">
        <div className="card-body p-4 text-center">
          <h2 className="h4 mb-1">{m.auth_title()}</h2>
          <p className="text-muted mb-3">{m.auth_subtitle()}</p>
          {isAccountRejected ? (
            <div className="alert alert-warning text-start" role="alert">
              <p className="fw-semibold mb-1">{m.auth_no_account_title()}</p>
              <p className="mb-0">{m.auth_no_account_body()}</p>
            </div>
          ) : oidcError ? (
            <div className="alert alert-danger text-start" role="alert">
              <p className="fw-semibold mb-1">{m.auth_error_title()}</p>
              <p className="mb-0">{oidcError}</p>
            </div>
          ) : null}
          {isAccountRejected ? (
            <button type="button" className="btn btn-outline-secondary" onClick={logout}>
              {m.app_logout()}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={startLogin}
              disabled={isBusy}
            >
              {isBusy ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  />
                  {m.auth_loading()}
                </>
              ) : (
                m.auth_sign_in()
              )}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
