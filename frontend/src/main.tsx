import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, NavLink } from "react-router-dom";
import { AuthProvider as OidcProvider } from "react-oidc-context";
import "bootstrap/dist/css/bootstrap.min.css";
import "./app.css";

import {
  setDeferredInstallPrompt,
  type BeforeInstallPromptEvent,
} from "@/app/pwa/installPrompt";
import { AppRouter } from "@/app/router/AppRouter";
import { AuthProvider, useAuth } from "@/app/providers/AuthProvider";
import { fetchOidcConfig } from "@/config/oidc";
import { ThemeProvider, useTheme } from "@/app/theme/ThemeContext";
import { useOnlineStatus } from "@/app/pwa/useOnlineStatus";
import { drain as drainOfflineQueue, getQueuedCount } from "@/lib/offlineQueue";
import { SearchOverlay } from "@/features/search/SearchOverlay";

function App() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isOnline = useOnlineStatus();
  const [queuedCount, setQueuedCount] = React.useState(() => getQueuedCount());
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    if (isOnline && getQueuedCount() > 0) {
      drainOfflineQueue().then((replayed) => {
        if (replayed > 0) setQueuedCount(getQueuedCount());
      }).catch(() => undefined);
    }
    setQueuedCount(getQueuedCount());
  }, [isOnline]);

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      if ((event.data as { type?: string })?.type === "DRAIN_QUEUE") {
        drainOfflineQueue().then(() => setQueuedCount(getQueuedCount())).catch(() => undefined);
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () => navigator.serviceWorker?.removeEventListener("message", handler);
  }, []);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "/" && document.activeElement?.tagName === "BODY") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isAuthenticated]);

  return (
    <main className="container py-3 py-md-4">
      {!isOnline ? (
        <div className="alert alert-warning py-2 mb-3 d-flex align-items-center gap-2">
          <span>⚠️ You are offline.</span>
          {queuedCount > 0 ? (
            <span className="text-muted small">{queuedCount} action{queuedCount === 1 ? "" : "s"} will sync when reconnected.</span>
          ) : null}
        </div>
      ) : queuedCount > 0 ? (
        <div className="alert alert-info py-2 mb-3">
          Syncing {queuedCount} queued action{queuedCount === 1 ? "" : "s"}…
        </div>
      ) : null}
      {searchOpen && isAuthenticated ? <SearchOverlay onClose={() => setSearchOpen(false)} /> : null}
      <header className="mb-3 mb-md-4 d-flex flex-column gap-3">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
          <div>
            <h1 className="mb-1">Daynest</h1>
            <p className="text-muted mb-0">
              Daily flow, calendar planning, and household tracking.
            </p>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            {isAuthenticated ? (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                aria-label="Search"
                title="Search (Ctrl+K)"
                onClick={() => setSearchOpen(true)}
              >
                🔍
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              aria-label={theme === "auto" ? "Switch to light mode" : theme === "light" ? "Switch to dark mode" : "Switch to auto mode"}
              title={theme === "auto" ? "Auto (follows system)" : theme === "light" ? "Light mode" : "Dark mode"}
              onClick={toggleTheme}
            >
              {theme === "auto" ? "🌓" : theme === "light" ? "🌙" : "☀️"}
            </button>
            {isAuthenticated && user ? (
              <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center gap-2">
                <div className="small text-muted text-sm-end">
                  <div className="fw-semibold text-body">{user.full_name}</div>
                  <div>{user.email}</div>
                </div>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={logout}>
                  Logout
                </button>
              </div>
            ) : !isLoading ? (
              <NavLink
                className={({ isActive }) =>
                  `btn btn-sm ${isActive ? "btn-primary" : "btn-outline-primary"}`
                }
                to="/auth"
              >
                Login
              </NavLink>
            ) : null}
          </div>
        </div>
        {isAuthenticated ? (
          <nav className="nav nav-pills gap-2">
            <NavLink
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              to="/today"
            >
              Today
            </NavLink>
            <NavLink
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              to="/calendar"
            >
              Calendar
            </NavLink>
            <NavLink
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              to="/medication"
            >
              Medication
            </NavLink>
            <NavLink
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              to="/templates"
            >
              Templates
            </NavLink>
            <NavLink
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              to="/stats"
            >
              Stats
            </NavLink>
            <NavLink
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              to="/settings"
            >
              Settings
            </NavLink>
          </nav>
        ) : null}
      </header>
      <AppRouter />
    </main>
  );
}

async function bootstrap() {
  let oidcConfig;
  try {
    oidcConfig = await fetchOidcConfig();
  } catch (err) {
    console.error("Failed to fetch OIDC config", err);
    const root = document.getElementById("root");
    if (root) {
      root.textContent =
        "Cannot connect to Daynest server. Please check your connection and try again.";
    }
    return;
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <OidcProvider {...oidcConfig}>
        <BrowserRouter>
          <AuthProvider>
            <ThemeProvider>
              <App />
            </ThemeProvider>
          </AuthProvider>
        </BrowserRouter>
      </OidcProvider>
    </React.StrictMode>,
  );
}

bootstrap();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  const appVersion = __APP_VERSION__;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
  });

  window.addEventListener("appinstalled", () => {
    setDeferredInstallPrompt(null);
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`/sw.js?appVersion=${encodeURIComponent(appVersion)}`)
      .catch((err) => {
        console.error("Service worker registration failed:", err);
      });
  });
}
