import { useEffect, useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import * as m from "@/paraglide/messages";
import { useLanguage } from "@/i18n/LanguageProvider";
import {
  getDeferredInstallPrompt,
  promptToInstallApp,
  subscribeInstallPrompt,
} from "@/app/pwa/installPrompt";
import {
  isRetryableApiError,
  type IntegrationClient,
  type IntegrationClientCreateResponse,
} from "@/lib/api/today";
import {
  listOAuthSessions,
  revokeOAuthSession,
  type OAuthSession,
} from "@/lib/api/auth";
import { getCustomServerUrl, setCustomServerUrl } from "@/lib/api/serverConfig";
import {
  useCalendarFeedQuery,
  useCreateIntegrationClientMutation,
  useIntegrationClientsQuery,
  useRegenerateCalendarFeedMutation,
  useRevokeIntegrationClientMutation,
  useRotateIntegrationClientMutation,
  useUpdateUserSettingsMutation,
  useUserSettingsQuery,
} from "@/features/settings/useSettingsQueries";

const HA_ENDPOINTS = [
  "GET /api/integrations/home-assistant/summary",
  "GET /api/integrations/home-assistant/dashboard",
  "POST /api/integrations/home-assistant/actions/complete-task",
  "POST /api/integrations/home-assistant/actions/snooze-task",
  "POST /api/integrations/home-assistant/actions/mark-medication-taken",
  "POST /api/integrations/home-assistant/actions/skip-task",
  "POST /api/integrations/home-assistant/actions/skip-medication",
];

const HOME_ASSISTANT_REDIRECT_URI = "https://my.home-assistant.io/redirect/oauth";
const integrationClientColumnHelper = createColumnHelper<IntegrationClient>();

export function SettingsPage() {
  const { language, setLanguage } = useLanguage();
  const [createdClient, setCreatedClient] = useState<IntegrationClientCreateResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [canInstallApp, setCanInstallApp] = useState(() => Boolean(getDeferredInstallPrompt()));

  const [name, setName] = useState("Home Assistant");
  const [rateLimit, setRateLimit] = useState("120");

  const [revokingClient, setRevokingClient] = useState<number | null>(null);
  const [revokeClientError, setRevokeClientError] = useState<string | null>(null);
  const [rotatingClient, setRotatingClient] = useState<number | null>(null);
  const [rotateClientError, setRotateClientError] = useState<string | null>(null);
  const [clientSorting, setClientSorting] = useState<SortingState>([]);
  const [clientColumnFilters, setClientColumnFilters] = useState<ColumnFiltersState>([]);
  const [clientColumnVisibility, setClientColumnVisibility] = useState<VisibilityState>({
    rateLimit: true,
    status: true,
  });

  const [oauthSessions, setOauthSessions] = useState<OAuthSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const [serverMode, setServerMode] = useState<"default" | "custom">(() =>
    getCustomServerUrl() ? "custom" : "default",
  );
  const [customServerInput, setCustomServerInput] = useState(() => getCustomServerUrl() ?? "");
  const [serverUrlError, setServerUrlError] = useState<string | null>(null);
  const [backendBaseUrl, setBackendBaseUrl] = useState(() => {
    const custom = getCustomServerUrl();
    return custom ?? window.location.origin;
  });

  const [timezone, setTimezone] = useState("");
  const [hasInitializedUserSettings, setHasInitializedUserSettings] = useState(false);
  const [timezoneSaving, setTimezoneSaving] = useState(false);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);
  const [timezoneSuccess, setTimezoneSuccess] = useState<string | null>(null);
  const [pushOverdueChores, setPushOverdueChores] = useState(true);
  const [pushMedicationReminders, setPushMedicationReminders] = useState(true);
  const [pushMissedMedications, setPushMissedMedications] = useState(true);
  const [serverConfirmedOverdue, setServerConfirmedOverdue] = useState(true);
  const [serverConfirmedMedReminders, setServerConfirmedMedReminders] = useState(true);
  const [serverConfirmedMissedMed, setServerConfirmedMissedMed] = useState(true);
  const [medicationReminderMinutes, setMedicationReminderMinutes] = useState(30);
  const [quietHoursStart, setQuietHoursStart] = useState("");
  const [quietHoursEnd, setQuietHoursEnd] = useState("");
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [notificationSuccess, setNotificationSuccess] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof Notification === "undefined" ? "denied" : Notification.permission,
  );
  const [calendarFeedCopyStatus, setCalendarFeedCopyStatus] = useState<string | null>(null);
  const [calendarFeedError, setCalendarFeedError] = useState<string | null>(null);
  const clientsQuery = useIntegrationClientsQuery();
  const calendarFeedQuery = useCalendarFeedQuery();
  const userSettingsQuery = useUserSettingsQuery();
  const createClientMutation = useCreateIntegrationClientMutation();
  const rotateClientMutation = useRotateIntegrationClientMutation();
  const revokeClientMutation = useRevokeIntegrationClientMutation();
  const regenerateCalendarFeedMutation = useRegenerateCalendarFeedMutation();
  const updateUserSettingsMutation = useUpdateUserSettingsMutation();
  const clients = clientsQuery.data ?? [];
  const loading = clientsQuery.isPending;
  const error = clientsQuery.error instanceof Error
    ? clientsQuery.error.message
    : clientsQuery.error
      ? "Unable to load integration clients."
      : null;
  const canRetry = clientsQuery.error ? isRetryableApiError(clientsQuery.error) : false;
  const timezoneLoading = userSettingsQuery.isPending && !hasInitializedUserSettings;
  const timezones = useMemo<string[]>(() => {
    try {
      return (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    } catch {
      return [];
    }
  }, []);

  const timezoneOptions = useMemo(
    () =>
      timezones.map((tz) => {
        let label = tz;
        try {
          const parts = new Intl.DateTimeFormat("en", {
            timeZone: tz,
            timeZoneName: "shortOffset",
          }).formatToParts(new Date());
          const tzPart = parts.find((p) => p.type === "timeZoneName");
          if (tzPart) label = `${tz} (${tzPart.value})`;
        } catch {
          // ignore
        }
        return { value: tz, label };
      }),
    [timezones],
  );

  const applyServerUrl = () => {
    if (serverMode === "default") {
      setCustomServerUrl(null);
      setBackendBaseUrl(window.location.origin);
      setServerUrlError(null);
      return;
    }
    const trimmed = customServerInput.trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      setServerUrlError("Enter a valid absolute URL.");
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      setServerUrlError("URL must use https:// or http://.");
      return;
    }
    setCustomServerUrl(parsed.origin);
    setBackendBaseUrl(parsed.origin);
    setServerUrlError(null);
  };

  const loadClients = async () => {
    await clientsQuery.refetch();
  };

  const loadSessions = async (signal?: AbortSignal) => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const sessions = await listOAuthSessions();
      if (!signal?.aborted) {
        setOauthSessions(sessions);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setSessionsError(err instanceof Error ? err.message : "Unable to load OAuth sessions.");
      }
    } finally {
      if (!signal?.aborted) {
        setSessionsLoading(false);
      }
    }
  };

  const onRotateClient = async (clientId: number) => {
    setRotatingClient(clientId);
    setRotateClientError(null);
    try {
      const rotated = await rotateClientMutation.mutateAsync(clientId);
      setCreatedClient(rotated);
      setCopyStatus(null);
      setSuccessMessage("OAuth client secret rotated. Copy the new secret now; it will not be shown again.");
    } catch (err) {
      setRotateClientError(err instanceof Error ? err.message : "Failed to rotate integration client key.");
    } finally {
      setRotatingClient(null);
    }
  };

  const onRevokeClient = async (clientId: number) => {
    setRevokingClient(clientId);
    setRevokeClientError(null);
    try {
      await revokeClientMutation.mutateAsync(clientId);
    } catch (err) {
      setRevokeClientError(err instanceof Error ? err.message : "Failed to revoke integration client.");
    } finally {
      setRevokingClient(null);
    }
  };

  const onRevokeSession = async (sessionId: string) => {
    setRevokingSession(sessionId);
    setRevokeError(null);
    try {
      await revokeOAuthSession(sessionId);
      await loadSessions();
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : "Failed to revoke session.");
    } finally {
      setRevokingSession(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadSessions(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeInstallPrompt(() =>
      setCanInstallApp(Boolean(getDeferredInstallPrompt())),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (hasInitializedUserSettings) return;
    if (!userSettingsQuery.data) {
      if (userSettingsQuery.error) {
        const msg = userSettingsQuery.error instanceof Error
          ? userSettingsQuery.error.message
          : m.settings_timezone_load_error();
        setTimezoneError(msg);
      }
      return;
    }
    const settings = userSettingsQuery.data;
    setTimezoneError(null);
    const overdueEnabled = settings.push_overdue_chores_enabled ?? true;
    const medRemindersEnabled = settings.push_medication_reminders_enabled ?? true;
    const missedMedEnabled = settings.push_missed_medications_enabled ?? true;
    setTimezone(settings.timezone);
    setPushOverdueChores(overdueEnabled);
    setPushMedicationReminders(medRemindersEnabled);
    setPushMissedMedications(missedMedEnabled);
    setServerConfirmedOverdue(overdueEnabled);
    setServerConfirmedMedReminders(medRemindersEnabled);
    setServerConfirmedMissedMed(missedMedEnabled);
    setMedicationReminderMinutes(settings.medication_reminder_minutes ?? 30);
    setQuietHoursStart(settings.quiet_hours_start ?? "");
    setQuietHoursEnd(settings.quiet_hours_end ?? "");
    setHasInitializedUserSettings(true);
  }, [userSettingsQuery.data, userSettingsQuery.error, hasInitializedUserSettings]);

  const onSaveTimezone = async () => {
    if (!timezone) return;
    setTimezoneSaving(true);
    setTimezoneError(null);
    setTimezoneSuccess(null);
    try {
      await updateUserSettingsMutation.mutateAsync({ timezone });
      setTimezoneSuccess(m.settings_timezone_saved());
    } catch (err) {
      setTimezoneError(err instanceof Error ? err.message : m.settings_timezone_save_error());
    } finally {
      setTimezoneSaving(false);
    }
  };

  const handlePushToggle = async (
    field:
      | "push_overdue_chores_enabled"
      | "push_medication_reminders_enabled"
      | "push_missed_medications_enabled",
    checked: boolean,
  ) => {
    setNotificationError(null);
    setNotificationSuccess(null);
    if (field === "push_overdue_chores_enabled") setPushOverdueChores(checked);
    if (field === "push_medication_reminders_enabled") setPushMedicationReminders(checked);
    if (field === "push_missed_medications_enabled") setPushMissedMedications(checked);

    const serverValue =
      field === "push_overdue_chores_enabled" ? serverConfirmedOverdue :
      field === "push_medication_reminders_enabled" ? serverConfirmedMedReminders :
      serverConfirmedMissedMed;
    if (checked === serverValue) return;

    const prevOverdue = pushOverdueChores;
    const prevMed = pushMedicationReminders;
    const prevMissed = pushMissedMedications;
    try {
      await updateUserSettingsMutation.mutateAsync({ [field]: checked });
      if (field === "push_overdue_chores_enabled") setServerConfirmedOverdue(checked);
      if (field === "push_medication_reminders_enabled") setServerConfirmedMedReminders(checked);
      if (field === "push_missed_medications_enabled") setServerConfirmedMissedMed(checked);
    } catch (err) {
      setPushOverdueChores(prevOverdue);
      setPushMedicationReminders(prevMed);
      setPushMissedMedications(prevMissed);
      setNotificationError(
        err instanceof Error ? err.message : m.settings_notification_prefs_save_error(),
      );
    }
  };

  const onSaveNotificationPreferences = async () => {
    setNotificationSaving(true);
    setNotificationError(null);
    setNotificationSuccess(null);
    try {
      await updateUserSettingsMutation.mutateAsync({
        medication_reminder_minutes: medicationReminderMinutes,
        quiet_hours_start: quietHoursStart || null,
        quiet_hours_end: quietHoursEnd || null,
      });
      setNotificationSuccess(m.settings_notification_prefs_saved());
    } catch (err) {
      setNotificationError(
        err instanceof Error ? err.message : m.settings_notification_prefs_save_error(),
      );
    } finally {
      setNotificationSaving(false);
    }
  };

  const requestPushPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
  };

  const onCreateClient = async () => {
    if (!name.trim()) {
      setSubmitError("Client name is required.");
      return;
    }

    const parsedRateLimit = parseInt(rateLimit, 10);
    if (isNaN(parsedRateLimit) || parsedRateLimit < 10 || parsedRateLimit > 600) {
      setSubmitError("Rate limit must be an integer between 10 and 600.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const created = await createClientMutation.mutateAsync({
        name: name.trim(),
        rate_limit_per_minute: parsedRateLimit,
      });
      setCreatedClient(created);
      setSuccessMessage(
        "Integration client created. Copy the OAuth client secret now; it will not be shown again.",
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create integration client.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyApiKey = async () => {
    if (!createdClient?.client_secret) {
      return;
    }
    try {
      await navigator.clipboard.writeText(createdClient.client_secret);
      setCopyStatus("Client secret copied.");
    } catch {
      setCopyStatus("Clipboard copy failed.");
    }
  };

  const copyCalendarFeedUrl = async () => {
    const feedUrl = calendarFeedQuery.data?.feed_url;
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCalendarFeedCopyStatus("Calendar feed URL copied.");
    } catch {
      setCalendarFeedCopyStatus("Clipboard copy failed.");
    }
  };

  const onRegenerateCalendarFeed = async () => {
    const confirmed = window.confirm(
      "Regenerating your calendar feed URL will immediately break existing calendar subscriptions. Continue?",
    );
    if (!confirmed) return;
    setCalendarFeedError(null);
    setCalendarFeedCopyStatus(null);
    try {
      await regenerateCalendarFeedMutation.mutateAsync();
      setCalendarFeedCopyStatus("Calendar feed URL regenerated. Copy the new URL into your calendar app.");
    } catch (err) {
      setCalendarFeedError(err instanceof Error ? err.message : "Failed to regenerate calendar feed URL.");
    }
  };

  const onInstallApp = async () => {
    setIsInstalling(true);
    try {
      await promptToInstallApp();
    } catch (error) {
      console.error("PWA install prompt failed:", error);
    } finally {
      setIsInstalling(false);
    }
  };

  const clientColumns = useMemo(
    () => [
      integrationClientColumnHelper.accessor("name", {
        id: "name",
        header: m.settings_client_column_name(),
        cell: (info) => <span className="fw-semibold">{info.getValue()}</span>,
      }),
      integrationClientColumnHelper.accessor("rate_limit_per_minute", {
        id: "rateLimit",
        header: m.settings_rate_limit_label(),
        cell: (info) => (
          <small className="text-muted d-block">
            {info.getValue()}/min
          </small>
        ),
      }),
      integrationClientColumnHelper.accessor("is_active", {
        id: "status",
        header: m.status_active(),
        cell: (info) => (
          <span className={`badge ${info.getValue() ? "text-bg-success" : "text-bg-secondary"}`}>
            {info.getValue() ? m.status_active() : m.status_inactive()}
          </span>
        ),
      }),
      integrationClientColumnHelper.display({
        id: "actions",
        header: m.settings_client_column_actions(),
        cell: (info) => {
          const client = info.row.original;
          return (
            <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={rotatingClient === client.id || revokingClient === client.id}
                onClick={() => void onRotateClient(client.id)}
              >
                {rotatingClient === client.id ? m.settings_rotating() : m.settings_rotate_secret()}
              </button>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                disabled={revokingClient === client.id || rotatingClient === client.id}
                onClick={() => void onRevokeClient(client.id)}
              >
                {revokingClient === client.id ? m.settings_revoking() : m.settings_revoke()}
              </button>
            </div>
          );
        },
      }),
    ],
    [revokingClient, rotatingClient, language],
  );

  const clientsTable = useReactTable({
    data: clients,
    columns: clientColumns,
    state: {
      sorting: clientSorting,
      columnFilters: clientColumnFilters,
      columnVisibility: clientColumnVisibility,
    },
    onSortingChange: setClientSorting,
    onColumnFiltersChange: setClientColumnFilters,
    onColumnVisibilityChange: setClientColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-2">
        <h2 className="h4 mb-0">{m.settings_title()}</h2>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          {canInstallApp ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={isInstalling}
              onClick={() => void onInstallApp()}
            >
              {m.settings_install_app()}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            disabled={loading}
            onClick={() => void loadClients()}
          >
            {m.settings_refresh()}
          </button>
        </div>
      </div>
      <p className="text-muted mb-3">
        {m.settings_subtitle()}
      </p>

      {loading ? <div className="alert alert-info py-2">{m.settings_loading()}</div> : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => void loadClients()}
            >
              {m.settings_retry()}
            </button>
          ) : null}
        </div>
      ) : null}
      {successMessage ? <div className="alert alert-success py-2">{successMessage}</div> : null}

      <div className="row g-3">
        <div className="col-lg-5">
          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">{m.settings_backend_server_header()}</div>
            <div className="card-body d-grid gap-2">
              <div className="d-flex gap-3">
                <label className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="server-mode"
                    checked={serverMode === "default"}
                    onChange={() => {
                      setServerMode("default");
                      setServerUrlError(null);
                    }}
                  />
                  <span className="form-check-label">{m.settings_default()}</span>
                </label>
                <label className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="server-mode"
                    checked={serverMode === "custom"}
                    onChange={() => setServerMode("custom")}
                  />
                  <span className="form-check-label">{m.settings_custom_self_hosted()}</span>
                </label>
              </div>
              {serverMode === "custom" ? (
                <div>
                  <input
                    className={`form-control${serverUrlError ? " is-invalid" : ""}`}
                    value={customServerInput}
                    onChange={(event) => {
                      setCustomServerInput(event.target.value);
                      setServerUrlError(null);
                    }}
                    placeholder={m.settings_custom_placeholder()}
                  />
                  {serverUrlError ? (
                    <div className="invalid-feedback">{serverUrlError}</div>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={applyServerUrl}
              >
                {m.settings_apply()}
              </button>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">{m.settings_user_prefs_header()}</div>
            <div className="card-body d-grid gap-2">
              <label className="form-label small fw-semibold mb-1">{m.settings_language()}</label>
              <select
                className="form-select mb-2"
                value={language}
                onChange={(event) => setLanguage(event.target.value as "en" | "nl")}
                aria-label={m.settings_language()}
              >
                <option value="en">{m.settings_language_english()}</option>
                <option value="nl">{m.settings_language_dutch()}</option>
              </select>
              <label className="form-label small fw-semibold mb-1">{m.settings_timezone()}</label>
              {timezoneLoading ? (
                <div className="text-muted small">{m.settings_timezone_loading()}</div>
              ) : (
                <div className="d-flex gap-2 flex-wrap">
                  <select
                    className="form-select flex-fill"
                    value={timezone}
                    onChange={(e) => {
                      setTimezone(e.target.value);
                      setTimezoneSuccess(null);
                      setTimezoneError(null);
                    }}
                    aria-label={m.settings_timezone()}
                  >
                    {timezone && !timezones.includes(timezone) ? (
                      <option value={timezone}>{timezone}</option>
                    ) : null}
                    {timezoneOptions.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    disabled={timezoneSaving || !timezone}
                    onClick={() => void onSaveTimezone()}
                  >
                    {timezoneSaving ? m.settings_saving() : m.settings_save()}
                  </button>
                </div>
              )}
              {timezoneError ? (
                <div className="text-danger small">{timezoneError}</div>
              ) : null}
              {timezoneSuccess ? (
                <div className="text-success small">{timezoneSuccess}</div>
              ) : null}
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">{m.settings_notifications_header()}</div>
            <div className="card-body d-grid gap-2">
              <div className="form-check form-switch">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="pushOverdueChores"
                  checked={pushOverdueChores}
                  onChange={(e) =>
                    void handlePushToggle("push_overdue_chores_enabled", e.target.checked)
                  }
                />
                <label className="form-check-label" htmlFor="pushOverdueChores">
                  {m.settings_overdue_chore_reminders()}
                </label>
              </div>
              <div className="form-check form-switch">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="pushMedReminders"
                  checked={pushMedicationReminders}
                  onChange={(e) =>
                    void handlePushToggle("push_medication_reminders_enabled", e.target.checked)
                  }
                />
                <label className="form-check-label" htmlFor="pushMedReminders">
                  {m.settings_medication_reminders()}
                </label>
              </div>
              <div className="form-check form-switch">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="pushMissedMed"
                  checked={pushMissedMedications}
                  onChange={(e) =>
                    void handlePushToggle("push_missed_medications_enabled", e.target.checked)
                  }
                />
                <label className="form-check-label" htmlFor="pushMissedMed">
                  {m.settings_missed_medication_alerts()}
                </label>
              </div>

              <label className="form-label small fw-semibold" htmlFor="medicationReminderMinutes">
                {m.settings_medication_reminder_minutes()}
              </label>
              <input
                id="medicationReminderMinutes"
                type="number"
                className="form-control"
                min={1}
                max={120}
                value={medicationReminderMinutes}
                onChange={(e) => setMedicationReminderMinutes(Number(e.target.value))}
              />

              <label className="form-label small fw-semibold">{m.settings_quiet_hours()}</label>
              <div className="d-flex gap-2">
                <div className="flex-fill">
                  <label htmlFor="quietHoursStart" className="form-label small mb-1">
                    {m.settings_quiet_hours_from()}
                  </label>
                  <input
                    id="quietHoursStart"
                    type="time"
                    className="form-control"
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(e.target.value)}
                  />
                </div>
                <div className="flex-fill">
                  <label htmlFor="quietHoursEnd" className="form-label small mb-1">
                    {m.settings_quiet_hours_to()}
                  </label>
                  <input
                    id="quietHoursEnd"
                    type="time"
                    className="form-control"
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => void onSaveNotificationPreferences()}
                disabled={notificationSaving}
              >
                {notificationSaving ? m.settings_saving() : m.settings_save_notification_prefs()}
              </button>
              {notificationError ? <div className="text-danger small">{notificationError}</div> : null}
              {notificationSuccess ? <div className="text-success small">{notificationSuccess}</div> : null}

              {notificationPermission === "default" ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => void requestPushPermission()}
                >
                  {m.settings_enable_browser_notifications()}
                </button>
              ) : null}
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">Calendar subscription</div>
            <div className="card-body d-grid gap-2">
              <p className="text-muted small mb-1">
                Add this URL to Google Calendar, Apple Calendar, or Outlook to see your Daynest items there.
              </p>
              <label className="form-label small fw-semibold mb-0" htmlFor="calendarFeedUrl">
                iCal feed URL
              </label>
              <div className="input-group input-group-sm">
                <input
                  id="calendarFeedUrl"
                  className="form-control"
                  readOnly
                  value={calendarFeedQuery.data?.feed_url ?? ""}
                  placeholder={calendarFeedQuery.isPending ? "Loading calendar feed URL…" : "Calendar feed unavailable"}
                />
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  disabled={!calendarFeedQuery.data?.feed_url}
                  onClick={() => void copyCalendarFeedUrl()}
                >
                  Copy
                </button>
              </div>
              <div className="d-flex gap-2 align-items-center flex-wrap">
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  disabled={regenerateCalendarFeedMutation.isPending}
                  onClick={() => void onRegenerateCalendarFeed()}
                >
                  {regenerateCalendarFeedMutation.isPending ? "Regenerating…" : "Regenerate"}
                </button>
                <small className="text-muted">Rotating the URL invalidates existing subscriptions.</small>
              </div>
              {calendarFeedQuery.error ? (
                <div className="text-danger small">
                  {calendarFeedQuery.error instanceof Error
                    ? calendarFeedQuery.error.message
                    : "Failed to load calendar feed URL."}
                </div>
              ) : null}
              {calendarFeedError ? <div className="text-danger small">{calendarFeedError}</div> : null}
              {calendarFeedCopyStatus ? <div className="text-success small">{calendarFeedCopyStatus}</div> : null}
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">{m.settings_create_client_header()}</div>
            <div className="card-body d-grid gap-3">
              <input
                className="form-control"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSubmitError(null);
                }}
                placeholder={m.settings_client_name_placeholder()}
              />
              <div>
                <label className="form-label small fw-semibold mb-1">{m.settings_rate_limit_label()}</label>
                <input
                  className="form-control"
                  type="number"
                  min={10}
                  max={600}
                  value={rateLimit}
                  onChange={(event) => {
                    setRateLimit(event.target.value);
                    setSubmitError(null);
                  }}
                />
                <small className="text-muted d-block mt-1">
                  {m.settings_rate_limit_hint()}
                </small>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSubmitting}
                onClick={() => void onCreateClient()}
              >
                {isSubmitting ? m.settings_creating() : m.settings_create_client()}
              </button>
            </div>
            {submitError ? (
              <div className="card-footer text-danger py-2 small">{submitError}</div>
            ) : null}
          </div>

          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">{m.settings_ha_header()}</div>
            <div className="card-body">
              <p className="text-muted small mb-2">
                {m.settings_ha_description()}
              </p>
              <dl className="row small mb-0">
                <dt className="col-sm-4">{m.settings_ha_base_url()}</dt>
                <dd className="col-sm-8">
                  <code>{backendBaseUrl}</code>
                </dd>
                <dt className="col-sm-4">{m.settings_ha_oauth_callback()}</dt>
                <dd className="col-sm-8">
                  <code>{HOME_ASSISTANT_REDIRECT_URI}</code>
                </dd>
                <dt className="col-sm-4">{m.settings_ha_contract()}</dt>
                <dd className="col-sm-8">
                  <code>home-assistant; version=ha.v1</code>
                </dd>
              </dl>
              <details className="mt-3">
                <summary className="small fw-semibold">{m.settings_ha_endpoints_summary()}</summary>
                <ul className="settings-endpoint-list mt-2 mb-0">
                  {HA_ENDPOINTS.map((endpoint) => (
                    <li key={endpoint}>
                      <code>{endpoint}</code>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>

          {createdClient ? (
            <div className="card">
              <div className="card-header fw-semibold py-2">
                {createdClient.name} — Legacy integration client fallback
              </div>
              <div className="card-body">
                <div className="alert alert-warning py-2">
                  The Home Assistant integration now uses browser OAuth redirect and does not
                  require these values for normal setup. Keep this secret only for legacy
                  compatibility.
                </div>
                <dl className="row small mb-0">
                  <dt className="col-sm-4">Client ID</dt>
                  <dd className="col-sm-8">
                    <code>{createdClient.client_id}</code>
                  </dd>
                  <dt className="col-sm-4">Client secret</dt>
                  <dd className="col-sm-8">
                    <code className="settings-api-key">{createdClient.client_secret}</code>
                  </dd>
                  <dt className="col-sm-4">Token URL</dt>
                  <dd className="col-sm-8">
                    <code>{createdClient.token_url}</code>
                  </dd>
                  <dt className="col-sm-4">Fallback key header</dt>
                  <dd className="col-sm-8">
                    <code>X-Integration-Key</code>
                  </dd>
                </dl>
                <div className="d-flex gap-2 mt-3 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => void copyApiKey()}
                  >
                    Copy client secret
                  </button>
                  {copyStatus ? (
                    <small className="text-muted align-self-center">{copyStatus}</small>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="col-lg-7">
          <div className="card">
            <div className="card-header fw-semibold py-2">{m.settings_integration_clients_header()}</div>
            <div className="card-body border-bottom d-grid gap-2">
              <label className="form-label small fw-semibold mb-0" htmlFor="integration-client-filter">
                {m.settings_search_clients()}
              </label>
              <input
                id="integration-client-filter"
                className="form-control form-control-sm"
                value={(clientsTable.getColumn("name")?.getFilterValue() as string | undefined) ?? ""}
                onChange={(event) => clientsTable.getColumn("name")?.setFilterValue(event.target.value)}
                placeholder={m.settings_filter_by_client_name()}
              />
              <div className="d-flex gap-3 flex-wrap small">
                <label className="form-check m-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={clientsTable.getColumn("rateLimit")?.getIsVisible() ?? true}
                    onChange={(event) => clientsTable.getColumn("rateLimit")?.toggleVisibility(event.target.checked)}
                  />
                  <span className="form-check-label">{m.settings_rate_limit_label()}</span>
                </label>
                <label className="form-check m-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={clientsTable.getColumn("status")?.getIsVisible() ?? true}
                    onChange={(event) => clientsTable.getColumn("status")?.toggleVisibility(event.target.checked)}
                  />
                  <span className="form-check-label">{m.status_active()}</span>
                </label>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  {clientsTable.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} scope="col">
                          {header.isPlaceholder ? null : header.column.getCanSort() ? (
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 text-decoration-none"
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {({ asc: " ↑", desc: " ↓" } as Record<string, string>)[header.column.getIsSorted() as string] ?? null}
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {clientsTable.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td className="py-2 text-muted" colSpan={clientsTable.getVisibleLeafColumns().length}>
                        {m.settings_no_clients()}
                      </td>
                    </tr>
                  ) : (
                    clientsTable.getRowModel().rows.map((row) => (
                      <tr key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {revokeClientError ? (
              <div className="card-footer text-danger py-2 small">{revokeClientError}</div>
            ) : null}
            {rotateClientError ? (
              <div className="card-footer text-danger py-2 small">{rotateClientError}</div>
            ) : null}
          </div>

          <div className="card mt-3">
            <div className="card-header d-flex justify-content-between align-items-center py-2">
              <span className="fw-semibold">{m.settings_oauth_sessions_header()}</span>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={sessionsLoading}
                onClick={() => void loadSessions()}
              >
                {m.settings_refresh()}
              </button>
            </div>
            {sessionsLoading ? (
              <div className="card-body py-2 text-muted small">{m.settings_loading_sessions()}</div>
            ) : sessionsError ? (
              <div className="card-body py-2 text-danger small">{sessionsError}</div>
            ) : (
              <ul className="list-group list-group-flush">
                {oauthSessions.length === 0 ? (
                  <li className="list-group-item py-2 text-muted">{m.settings_no_sessions()}</li>
                ) : (
                  oauthSessions.map((session) => {
                    const clientNames = session.clients.map((c) => c.clientName ?? c.clientId);
                    const lastAccess = session.last_access
                      ? new Date(session.last_access).toLocaleString()
                      : null;
                    const metaParts = [
                      session.ip_address ? m.settings_ip_address({ ip: session.ip_address }) : null,
                      lastAccess ? m.settings_last_active({ date: lastAccess }) : null,
                    ].filter(Boolean);
                    return (
                      <li key={session.id} className="list-group-item py-2">
                        <div className="d-flex justify-content-between align-items-start gap-3">
                          <div>
                            <div className="fw-semibold">
                              {clientNames.length > 0 ? clientNames.join(", ") : m.settings_unknown_client()}
                            </div>
                            {metaParts.length > 0 ? (
                              <small className="text-muted d-block">{metaParts.join(" • ")}</small>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm flex-shrink-0"
                            disabled={revokingSession === session.id}
                            onClick={() => void onRevokeSession(session.id)}
                          >
                            {revokingSession === session.id ? m.settings_revoking() : m.settings_revoke()}
                          </button>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
            {revokeError ? (
              <div className="card-footer text-danger py-2 small">{revokeError}</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
