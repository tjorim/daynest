import React from "react";
import { Link, Outlet } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";
import { useAuth } from "@/app/providers/AuthProvider";
import { useTheme } from "@/app/theme/ThemeContext";
import { useOnlineStatus } from "@/app/pwa/useOnlineStatus";
import { drain as drainOfflineQueue, getQueuedCount, hasLegacyQueue } from "@/lib/offlineQueue";
import { SearchOverlay } from "@/features/search/SearchOverlay";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";

const navLinkClass = cn(
  "tw:block tw:min-h-11 tw:rounded-md tw:px-4 tw:py-2 tw:text-link tw:no-underline tw:hover:text-link-hover tw:focus:text-link-hover",
);
const navLinkActiveClass = "tw:bg-primary tw:text-white tw:hover:text-white tw:focus:text-white";

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
  }, [isOnline, isAuthenticated, user]);

  React.useEffect(() => {
    const refreshCount = () => setQueuedCount(getQueuedCount());
    window.addEventListener("daynest-queue-changed", refreshCount);
    window.addEventListener("storage", refreshCount);
    return () => {
      window.removeEventListener("daynest-queue-changed", refreshCount);
      window.removeEventListener("storage", refreshCount);
    };
  }, []);

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
        activeProps={{ className: `${navLinkClass} ${navLinkActiveClass}` }}
        inactiveProps={{ className: navLinkClass }}
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
        {m.ui_skip_to_main()}
      </a>
      {hasLegacyQueue() ? (
        <Alert variant="warning" role="alert">
          {m.app_offline_legacy()}
        </Alert>
      ) : null}
      {!isOnline ? (
        <Alert variant="warning" className="tw:py-2 tw:mb-4 tw:flex tw:items-center tw:gap-2">
          <span>⚠️ {m.app_offline_banner()}</span>
          {queuedCount > 0 ? (
            <span className="tw:text-muted-foreground tw:text-small">
              {m.app_offline_queued({ count: queuedCount })}
            </span>
          ) : null}
        </Alert>
      ) : queuedCount > 0 ? (
        <Alert variant="info" className="tw:py-2 tw:mb-4">
          {m.app_saved_queued({ count: queuedCount })}
          <Button
            variant="outline-primary"
            size="sm"
            className="tw:ms-2"
            onClick={() => {
              void drainOfflineQueue()
                .then(() => setQueuedCount(getQueuedCount()))
                .catch(() => undefined);
            }}
          >
            {m.action_retry()}
          </Button>
        </Alert>
      ) : null}
      {sessionError ? (
        <Alert
          variant="danger"
          className="tw:py-2 tw:mb-4 tw:flex tw:justify-between tw:items-center tw:gap-2 tw:flex-wrap"
        >
          <span>{m.app_session_retry_banner()}</span>
          <Button
            variant="outline-danger"
            size="sm"
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
          </Button>
        </Alert>
      ) : null}
      {searchOpen && isAuthenticated ? (
        <SearchOverlay onClose={() => setSearchOpen(false)} />
      ) : null}
      <header className="tw:mb-4 tw:md:mb-6 tw:flex tw:flex-col tw:gap-4">
        <div className="tw:flex tw:flex-col tw:md:flex-row tw:justify-between tw:items-start tw:md:items-center tw:gap-2">
          <div>
            <h1 className="tw:mb-1">Daynest</h1>
            <p className="tw:text-muted-foreground tw:mb-0">{m.app_subtitle()}</p>
          </div>
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            {isAuthenticated ? (
              <Button
                variant="outline-secondary"
                size="sm"
                aria-label={m.app_search()}
                title={m.app_search_shortcut()}
                onClick={() => setSearchOpen(true)}
              >
                <i className="bi bi-search" aria-hidden="true" />
              </Button>
            ) : null}
            <Button
              variant="outline-secondary"
              size="sm"
              aria-label={themeLabel}
              title={themeTitle}
              onClick={toggleTheme}
            >
              <i
                className={`bi ${theme === "auto" ? "bi-circle-half" : theme === "light" ? "bi-moon-stars-fill" : "bi-sun-fill"}`}
                aria-hidden="true"
              />
            </Button>
            {isAuthenticated ? (
              <div className="tw:flex tw:flex-col tw:sm:flex-row tw:items-start tw:sm:items-center tw:gap-2">
                {user ? (
                  <div className="tw:text-small tw:text-muted-foreground tw:sm:text-end">
                    <div className="tw:font-semibold tw:text-foreground">{user.full_name}</div>
                    <div>{user.email}</div>
                  </div>
                ) : null}
                <Button variant="outline-secondary" size="sm" onClick={logout}>
                  {m.app_logout()}
                </Button>
              </div>
            ) : !isLoading ? (
              <Link
                to="/auth"
                activeProps={{ className: buttonVariants({ size: "sm" }) }}
                inactiveProps={{
                  className: buttonVariants({ variant: "outline-primary", size: "sm" }),
                }}
              >
                {m.app_login()}
              </Link>
            ) : null}
          </div>
        </div>
        {isAuthenticated ? (
          <div className="tw:flex tw:flex-col tw:gap-2">
            <Button
              variant="outline-primary"
              className="tw:md:hidden tw:self-start"
              aria-controls="primary-navigation"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((isOpen) => !isOpen)}
            >
              <i
                className={`bi ${mobileNavOpen ? "bi-x-lg" : "bi-list"} tw:me-2`}
                aria-hidden="true"
              />
              {m.nav_menu()}
            </Button>
            <nav
              id="primary-navigation"
              className={`${mobileNavOpen ? "tw:flex" : "tw:hidden"} tw:md:flex tw:mb-0 tw:list-none tw:flex-col tw:flex-wrap tw:gap-2 tw:ps-0 tw:md:flex-row`}
              aria-label={m.nav_menu()}
            >
              {renderNavLinks(() => setMobileNavOpen(false))}
            </nav>
          </div>
        ) : null}
      </header>
      <Outlet />
      <footer className="tw:mt-6 tw:pt-4 tw:border-t tw:border-border tw:text-center tw:text-muted-foreground tw:text-small">
        <Link to="/privacy">{m.app_footer_privacy_policy()}</Link>
      </footer>
    </>
  );
}
