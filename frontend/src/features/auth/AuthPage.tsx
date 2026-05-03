import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthApiError } from "../../lib/api/auth";
import { useAuth } from "../../app/providers/AuthProvider";

type AuthMode = "login" | "register";

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
  const { isAuthenticated, login, register } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = buildRedirectPath(location.state);

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(fullName, email, password);
      }
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      if (submitError instanceof AuthApiError) {
        setError(submitError.message);
      } else if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("Authentication failed.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-shell">
      <div className="card shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
            <div>
              <h2 className="h4 mb-1">Sign in to Daynest</h2>
              <p className="text-muted mb-0">
                Use your account to sync Today, Calendar, and future planning modules.
              </p>
            </div>
          </div>

          <div className="btn-group w-100 mb-3" role="group" aria-label="Authentication mode">
            <button
              type="button"
              className={`btn ${mode === "login" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => {
                setMode("login");
                setError(null);
              }}
            >
              Login
            </button>
            <button
              type="button"
              className={`btn ${mode === "register" ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => {
                setMode("register");
                setError(null);
              }}
            >
              Register
            </button>
          </div>

          <form className="d-grid gap-3" onSubmit={onSubmit}>
            {mode === "register" ? (
              <label className="form-label mb-0">
                <span className="small fw-semibold d-block mb-1">Full name</span>
                <input
                  className="form-control"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
            ) : null}

            <label className="form-label mb-0">
              <span className="small fw-semibold d-block mb-1">Email</span>
              <input
                className="form-control"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label className="form-label mb-0">
              <span className="small fw-semibold d-block mb-1">Password</span>
              <input
                className="form-control"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                required
              />
            </label>

            {error ? <div className="alert alert-danger py-2 mb-0">{error}</div> : null}

            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting
                ? mode === "login"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "login"
                  ? "Login"
                  : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
