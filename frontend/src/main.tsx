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

function App() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();

  return (
    <main className="container py-3 py-md-4">
      <header className="mb-3 mb-md-4 d-flex flex-column gap-3">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
          <div>
            <h1 className="mb-1">Daynest</h1>
            <p className="text-muted mb-0">
              Daily flow, calendar planning, and household tracking.
            </p>
          </div>
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
  } catch {
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
            <App />
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
