import { useState } from "react";
import { Navigate, useSearch } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";
import { useAuth } from "@/app/providers/AuthProvider";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
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
    <section className="grid min-h-auth place-items-center">
      <Card className="w-full max-w-lg shadow-sm">
        <CardContent className="p-6 text-center">
          <h2 className="mb-1 text-h4 font-medium">{m.auth_title()}</h2>
          <p className="mb-4 text-muted-foreground">{m.auth_subtitle()}</p>
          {isAccountRejected ? (
            <Alert variant="warning" className="text-start" role="alert">
              <p className="mb-1 font-semibold">{m.auth_no_account_title()}</p>
              <p className="mb-0">{m.auth_no_account_body()}</p>
            </Alert>
          ) : oidcError ? (
            <Alert variant="danger" className="text-start" role="alert">
              <p className="mb-1 font-semibold">{m.auth_error_title()}</p>
              <p className="mb-0">{oidcError}</p>
            </Alert>
          ) : null}
          {isAccountRejected ? (
            <Button variant="outline-secondary" onClick={logout}>
              {m.app_logout()}
            </Button>
          ) : (
            <Button onClick={startLogin} disabled={isBusy}>
              {isBusy ? (
                <>
                  <Spinner className="me-2" />
                  {m.auth_loading()}
                </>
              ) : (
                m.auth_sign_in()
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
