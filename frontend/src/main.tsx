import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, NavLink } from "react-router-dom";
import { AuthProvider as OidcProvider } from "react-oidc-context";
import "bootstrap/dist/css/bootstrap.min.css";
import "./app.css";

import * as m from "@/paraglide/messages";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import {
  setDeferredInstallPrompt,
  type BeforeInstallPromptEvent,
} from "@/app/pwa/installPrompt";
import { AppRouter } from "@/app/router/AppRouter";
import { AuthProvider, useAuth } from "@/app/providers/AuthProvider";
import { QueryProvider } from "@/app/providers/QueryProvider";
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

  const themeLabel =
    theme === "auto"
      ? m.app_theme_switch_to_light()
      : theme === "light"
        ? m.app_theme_switch_to_dark()
        : m.app_theme_switch_to_auto();

  const themeTitle =
    theme === "auto"
      ? m.app_theme_auto()
      : theme === "light"
        ? m.app_theme_light()
        : m.app_theme_dark();

  return (
    <main className="container py-3 py-md-4">
      {!isOnline ? (
        <div className="alert alert-warning py-2 mb-3 d-flex align-items-center gap-2">
          <span>⚠️ {m.app_offline_banner()}</span>
          {queuedCount > 0 ? (
            <span className="text-muted small">
              {m.app_offline_queued({ count: queuedCount })}
            </span>
          ) : null}
        </div>
      ) : queuedCount > 0 ? (
        <div className="alert alert-info py-2 mb-3">
          {m.app_syncing_queued({ count: queuedCount })}
        </div>
      ) : null}
      {searchOpen && isAuthenticated ? <SearchOverlay onClose={() => setSearchOpen(false)} /> : null}
      <header className="mb-3 mb-md-4 d-flex flex-column gap-3">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
          <div>
            <h1 className="mb-1">Daynest</h1>
            <p className="text-muted mb-0">
              {m.app_subtitle()}
            </p>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            {isAuthenticated ? (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                aria-label={m.app_search()}
                title={m.app_search_shortcut()}
                onClick={() => setSearchOpen(true)}
              >
                🔍
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              aria-label={themeLabel}
              title={themeTitle}
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
                  {m.app_logout()}
                </button>
              </div>
            ) : !isLoading ? (
              <NavLink
                className={({ isActive }) =>
                  `btn btn-sm ${isActive ? "btn-primary" : "btn-outline-primary"}`
                }
                to="/auth"
              >
                {m.app_login()}
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
              {m.nav_today()}
            </NavLink>
            <NavLink
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              to="/calendar"
            >
              {m.nav_calendar()}
            </NavLink>
            <NavLink
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              to="/medication"
            >
              {m.nav_medication()}
            </NavLink>
            <NavLink
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              to="/templates"
            >
              {m.nav_templates()}
            </NavLink>
            <NavLink
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              to="/stats"
            >
              {m.nav_stats()}
            </NavLink>
            <NavLink
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              to="/settings"
            >
              {m.nav_settings()}
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
      root.textContent = m.app_server_unavailable();
    }
    return;
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <OidcProvider {...oidcConfig}>
        <BrowserRouter>
          <LanguageProvider>
            <AuthProvider>
              <QueryProvider>
                <ThemeProvider>
                  <App />
                </ThemeProvider>
              </QueryProvider>
            </AuthProvider>
          </LanguageProvider>
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
