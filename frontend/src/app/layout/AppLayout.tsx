import React from "react";
import { Link, Outlet } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";
import { useAuth } from "@/app/providers/AuthProvider";
import { useTheme } from "@/app/theme/ThemeContext";
import { useOnlineStatus } from "@/app/pwa/useOnlineStatus";
import { drain as drainOfflineQueue, getQueuedCount } from "@/lib/offlineQueue";
import { SearchOverlay } from "@/features/search/SearchOverlay";

export function AppLayout() {
  const { isAuthenticated, isLoading, logout, refreshUser, sessionError, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isOnline = useOnlineStatus();
  const [queuedCount, setQueuedCount] = React.useState(() => getQueuedCount());
  const [isRetryingSession, setIsRetryingSession] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

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

  const navLinks = [
    { to: "/today", label: m.nav_today() },
    { to: "/calendar", label: m.nav_calendar() },
    { to: "/medication", label: m.nav_medication() },
    { to: "/meal-plan", label: m.nav_meal_plan() },
    { to: "/shopping", label: m.nav_shopping() },
    { to: "/shopping/recurring", label: m.nav_recurring_groceries() },
    { to: "/templates", label: m.nav_templates() },
    { to: "/stats", label: m.nav_stats() },
    { to: "/settings", label: m.nav_settings() },
  ] as const;

  const renderNavLinks = (onNavigate?: () => void) =>
    navLinks.map((link) => (
      <Link
        key={link.to}
        to={link.to}
        activeProps={{ className: "nav-link active" }}
        inactiveProps={{ className: "nav-link" }}
        onClick={(event) => {
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          ) {
            return;
          }

          if (mobileNavOpen) {
            onNavigate?.();
          }
        }}
      >
        {link.label}
      </Link>
    ));

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
      {sessionError ? (
        <div className="alert alert-danger py-2 mb-3 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{m.app_session_retry_banner()}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            disabled={isRetryingSession}
            onClick={async () => {
              setIsRetryingSession(true);
              try {
                await refreshUser();
              } finally {
                setIsRetryingSession(false);
              }
            }}
          >
            {m.action_retry()}
          </button>
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
            {isAuthenticated ? (
              <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center gap-2">
                {user ? (
                  <div className="small text-muted text-sm-end">
                    <div className="fw-semibold text-body">{user.full_name}</div>
                    <div>{user.email}</div>
                  </div>
                ) : null}
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
          <div className="d-flex flex-column gap-2">
            <button
              type="button"
              className="btn btn-outline-primary d-md-none align-self-start"
              aria-controls="primary-navigation"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((isOpen) => !isOpen)}
            >
              <i
                className={`bi ${mobileNavOpen ? "bi-x-lg" : "bi-list"} me-2`}
                aria-hidden="true"
              />
              {m.nav_menu()}
            </button>
            <nav
              id="primary-navigation"
              className={`${mobileNavOpen ? "d-flex" : "d-none"} d-md-flex nav nav-pills flex-column flex-md-row gap-2`}
              aria-label={m.nav_menu()}
            >
              {renderNavLinks(() => setMobileNavOpen(false))}
            </nav>
          </div>
        ) : null}
      </header>
      <Outlet />
      <footer className="mt-4 pt-3 border-top text-center text-muted small">
        <Link to="/privacy">{m.app_footer_privacy_policy()}</Link>
      </footer>
    </>
  );
}
