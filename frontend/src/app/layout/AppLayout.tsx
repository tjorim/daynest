import React from "react";
import { Link, Outlet } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";
import { useAuth } from "@/app/providers/AuthProvider";
import { useTheme } from "@/app/theme/ThemeContext";
import { useOnlineStatus } from "@/app/pwa/useOnlineStatus";
import { drain as drainOfflineQueue, getQueuedCount } from "@/lib/offlineQueue";
import { SearchOverlay } from "@/features/search/SearchOverlay";

export function AppLayout() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isOnline = useOnlineStatus();
  const [queuedCount, setQueuedCount] = React.useState(() => getQueuedCount());
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    if (isOnline && getQueuedCount() > 0) {
      drainOfflineQueue()
        .then((replayed) => {
          if (replayed > 0) setQueuedCount(getQueuedCount());
        })
        .catch(() => undefined);
    }
    setQueuedCount(getQueuedCount());
  }, [isOnline]);

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      if ((event.data as { type?: string })?.type === "DRAIN_QUEUE") {
        drainOfflineQueue()
          .then(() => setQueuedCount(getQueuedCount()))
          .catch(() => undefined);
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
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {!isOnline ? (
        <div className="alert alert-warning py-2 mb-3 d-flex align-items-center gap-2">
          <span>⚠️ {m.app_offline_banner()}</span>
          {queuedCount > 0 ? (
            <span className="text-muted small">{m.app_offline_queued({ count: queuedCount })}</span>
          ) : null}
        </div>
      ) : queuedCount > 0 ? (
        <div className="alert alert-info py-2 mb-3">
          {m.app_syncing_queued({ count: queuedCount })}
        </div>
      ) : null}
      {searchOpen && isAuthenticated ? (
        <SearchOverlay onClose={() => setSearchOpen(false)} />
      ) : null}
      <header className="mb-3 mb-md-4 d-flex flex-column gap-3">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
          <div>
            <h1 className="mb-1">Daynest</h1>
            <p className="text-muted mb-0">{m.app_subtitle()}</p>
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
                <i className="bi bi-search" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              aria-label={themeLabel}
              title={themeTitle}
              onClick={toggleTheme}
            >
              <i
                className={`bi ${theme === "auto" ? "bi-circle-half" : theme === "light" ? "bi-moon-stars-fill" : "bi-sun-fill"}`}
                aria-hidden="true"
              />
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
              <Link
                to="/auth"
                activeProps={{ className: "btn btn-sm btn-primary" }}
                inactiveProps={{ className: "btn btn-sm btn-outline-primary" }}
              >
                {m.app_login()}
              </Link>
            ) : null}
          </div>
        </div>
        {isAuthenticated ? (
          <nav className="nav nav-pills gap-2">
            <Link
              to="/today"
              activeProps={{ className: "nav-link active" }}
              inactiveProps={{ className: "nav-link" }}
            >
              {m.nav_today()}
            </Link>
            <Link
              to="/calendar"
              activeProps={{ className: "nav-link active" }}
              inactiveProps={{ className: "nav-link" }}
            >
              {m.nav_calendar()}
            </Link>
            <Link
              to="/medication"
              activeProps={{ className: "nav-link active" }}
              inactiveProps={{ className: "nav-link" }}
            >
              {m.nav_medication()}
            </Link>
            <Link
              to="/meal-plan"
              activeProps={{ className: "nav-link active" }}
              inactiveProps={{ className: "nav-link" }}
            >
              {m.nav_meal_plan()}
            </Link>
            <Link
              to="/shopping"
              activeProps={{ className: "nav-link active" }}
              inactiveProps={{ className: "nav-link" }}
            >
              {m.nav_shopping()}
            </Link>
            <Link
              to="/shopping/recurring"
              activeProps={{ className: "nav-link active" }}
              inactiveProps={{ className: "nav-link" }}
            >
              {m.nav_recurring_groceries()}
            </Link>
            <Link
              to="/templates"
              activeProps={{ className: "nav-link active" }}
              inactiveProps={{ className: "nav-link" }}
            >
              {m.nav_templates()}
            </Link>
            <Link
              to="/stats"
              activeProps={{ className: "nav-link active" }}
              inactiveProps={{ className: "nav-link" }}
            >
              {m.nav_stats()}
            </Link>
            <Link
              to="/settings"
              activeProps={{ className: "nav-link active" }}
              inactiveProps={{ className: "nav-link" }}
            >
              {m.nav_settings()}
            </Link>
          </nav>
        ) : null}
      </header>
      <Outlet />
    </>
  );
}
