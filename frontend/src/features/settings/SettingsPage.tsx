import { useEffect, useMemo, useState } from "react";
import {
  getDeferredInstallPrompt,
  promptToInstallApp,
  subscribeInstallPrompt,
} from "@/app/pwa/installPrompt";
import {
  createIntegrationClient,
  fetchUserSettings,
  isRetryableApiError,
  listIntegrationClients,
  revokeIntegrationClient,
  rotateIntegrationClient,
  updateUserSettings,
  type IntegrationClient,
  type IntegrationClientCreateResponse,
} from "@/lib/api/today";
import {
  listOAuthSessions,
  revokeOAuthSession,
  type OAuthSession,
} from "@/lib/api/auth";
import { getCustomServerUrl, setCustomServerUrl } from "@/lib/api/serverConfig";

const HA_ENDPOINTS = [
  "GET /api/v1/integrations/home-assistant/summary",
  "GET /api/v1/integrations/home-assistant/dashboard",
  "POST /api/v1/integrations/home-assistant/actions/complete-task",
  "POST /api/v1/integrations/home-assistant/actions/snooze-task",
  "POST /api/v1/integrations/home-assistant/actions/mark-medication-taken",
  "POST /api/v1/integrations/home-assistant/actions/skip-task",
  "POST /api/v1/integrations/home-assistant/actions/skip-medication",
];

const HOME_ASSISTANT_REDIRECT_URI = "https://my.home-assistant.io/redirect/oauth";

export function SettingsPage() {
  const [clients, setClients] = useState<IntegrationClient[]>([]);
  const [createdClient, setCreatedClient] = useState<IntegrationClientCreateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
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

  // Timezone settings
  const [timezone, setTimezone] = useState("");
  const [timezoneLoading, setTimezoneLoading] = useState(true);
  const [timezoneSaving, setTimezoneSaving] = useState(false);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);
  const [timezoneSuccess, setTimezoneSuccess] = useState<string | null>(null);
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

  const loadClients = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setCanRetry(false);
    try {
      const nextClients = await listIntegrationClients(signal);
      if (!signal?.aborted) {
        setClients(nextClients);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setCanRetry(isRetryableApiError(err));
        setError(err instanceof Error ? err.message : "Unable to load integration clients.");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
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
      const rotated = await rotateIntegrationClient(clientId);
      setCreatedClient(rotated);
      setCopyStatus(null);
      setSuccessMessage("OAuth client secret rotated. Copy the new secret now; it will not be shown again.");
      await loadClients();
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
      await revokeIntegrationClient(clientId);
      await loadClients();
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
    void loadClients(controller.signal);
    return () => controller.abort();
  }, []);

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
    const controller = new AbortController();
    fetchUserSettings(controller.signal)
      .then((settings) => {
        if (!controller.signal.aborted) {
          setTimezone(settings.timezone);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setTimezoneError(err instanceof Error ? err.message : "Failed to load timezone.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setTimezoneLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  const onSaveTimezone = async () => {
    if (!timezone) return;
    setTimezoneSaving(true);
    setTimezoneError(null);
    setTimezoneSuccess(null);
    try {
      await updateUserSettings({ timezone });
      setTimezoneSuccess("Timezone saved.");
    } catch (err) {
      setTimezoneError(err instanceof Error ? err.message : "Failed to save timezone.");
    } finally {
      setTimezoneSaving(false);
    }
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
      const created = await createIntegrationClient({
        name: name.trim(),
        rate_limit_per_minute: parsedRateLimit,
      });
      setCreatedClient(created);
      setSuccessMessage(
        "Integration client created. Copy the OAuth client secret now; it will not be shown again.",
      );
      await loadClients();
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

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-2">
        <h2 className="h4 mb-0">Settings</h2>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          {canInstallApp ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={isInstalling}
              onClick={() => void onInstallApp()}
            >
              Install app
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            disabled={loading}
            onClick={() => void loadClients()}
          >
            Refresh
          </button>
        </div>
      </div>
      <p className="text-muted mb-3">
        Configure integration clients for Home Assistant and MCP consumers. OAuth client secrets are
        shown only once when created.
      </p>

      {loading ? <div className="alert alert-info py-2">Loading settings...</div> : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => void loadClients()}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      {successMessage ? <div className="alert alert-success py-2">{successMessage}</div> : null}

      <div className="row g-3">
        <div className="col-lg-5">
          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">Backend server</div>
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
                  <span className="form-check-label">Default</span>
                </label>
                <label className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="server-mode"
                    checked={serverMode === "custom"}
                    onChange={() => setServerMode("custom")}
                  />
                  <span className="form-check-label">Custom (self-hosted)</span>
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
                    placeholder="https://your-server.example.com"
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
                Apply
              </button>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">User preferences</div>
            <div className="card-body d-grid gap-2">
              <label className="form-label small fw-semibold mb-1">Timezone</label>
              {timezoneLoading ? (
                <div className="text-muted small">Loading…</div>
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
                    aria-label="Timezone"
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
                    {timezoneSaving ? "Saving…" : "Save"}
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
            <div className="card-header fw-semibold py-2">Create integration client</div>
            <div className="card-body d-grid gap-3">
              <input
                className="form-control"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSubmitError(null);
                }}
                placeholder="Client name"
              />
              <div>
                <label className="form-label small fw-semibold mb-1">Rate limit per minute</label>
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
                  Default is 120/min. Lower this for stricter external clients or testing.
                </small>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSubmitting}
                onClick={() => void onCreateClient()}
              >
                {isSubmitting ? "Creating…" : "Create client"}
              </button>
            </div>
            {submitError ? (
              <div className="card-footer text-danger py-2 small">{submitError}</div>
            ) : null}
          </div>

          <div className="card mb-3">
            <div className="card-header fw-semibold py-2">Home Assistant connection details</div>
            <div className="card-body">
              <p className="text-muted small mb-2">
                Setup now uses browser-based OAuth redirect. Enter the Daynest base URL in Home
                Assistant and it will open the Daynest sign-in page automatically.
              </p>
              <dl className="row small mb-0">
                <dt className="col-sm-4">Base URL</dt>
                <dd className="col-sm-8">
                  <code>{backendBaseUrl}</code>
                </dd>
                <dt className="col-sm-4">OAuth callback</dt>
                <dd className="col-sm-8">
                  <code>{HOME_ASSISTANT_REDIRECT_URI}</code>
                </dd>
                <dt className="col-sm-4">Contract</dt>
                <dd className="col-sm-8">
                  <code>home-assistant; version=ha.v1</code>
                </dd>
              </dl>
              <details className="mt-3">
                <summary className="small fw-semibold">Home Assistant endpoints</summary>
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
            <div className="card-header fw-semibold py-2">Integration clients</div>
            <ul className="list-group list-group-flush">
              {clients.length === 0 ? (
                <li className="list-group-item py-2 text-muted">No integration clients yet.</li>
              ) : (
                clients.map((client) => (
                  <li key={client.id} className="list-group-item py-2">
                    <div className="d-flex justify-content-between align-items-start gap-3">
                      <div>
                        <div className="fw-semibold">{client.name}</div>
                        <small className="text-muted d-block">
                          {client.rate_limit_per_minute}/min
                        </small>
                      </div>
                      <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
                        <span
                          className={`badge ${client.is_active ? "text-bg-success" : "text-bg-secondary"}`}
                        >
                          {client.is_active ? "Active" : "Inactive"}
                        </span>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          disabled={rotatingClient === client.id || revokingClient === client.id}
                          onClick={() => void onRotateClient(client.id)}
                        >
                          {rotatingClient === client.id ? "Rotating…" : "Rotate secret"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          disabled={revokingClient === client.id || rotatingClient === client.id}
                          onClick={() => void onRevokeClient(client.id)}
                        >
                          {revokingClient === client.id ? "Revoking…" : "Revoke"}
                        </button>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
            {revokeClientError ? (
              <div className="card-footer text-danger py-2 small">{revokeClientError}</div>
            ) : null}
            {rotateClientError ? (
              <div className="card-footer text-danger py-2 small">{rotateClientError}</div>
            ) : null}
          </div>

          <div className="card mt-3">
            <div className="card-header d-flex justify-content-between align-items-center py-2">
              <span className="fw-semibold">Active OAuth sessions</span>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={sessionsLoading}
                onClick={() => void loadSessions()}
              >
                Refresh
              </button>
            </div>
            {sessionsLoading ? (
              <div className="card-body py-2 text-muted small">Loading sessions…</div>
            ) : sessionsError ? (
              <div className="card-body py-2 text-danger small">{sessionsError}</div>
            ) : (
              <ul className="list-group list-group-flush">
                {oauthSessions.length === 0 ? (
                  <li className="list-group-item py-2 text-muted">No active OAuth sessions.</li>
                ) : (
                  oauthSessions.map((session) => {
                    const clientNames = session.clients.map((c) => c.clientName ?? c.clientId);
                    const lastAccess = session.last_access
                      ? new Date(session.last_access).toLocaleString()
                      : null;
                    const metaParts = [
                      session.ip_address ? `IP: ${session.ip_address}` : null,
                      lastAccess ? `Last active: ${lastAccess}` : null,
                    ].filter(Boolean);
                    return (
                      <li key={session.id} className="list-group-item py-2">
                        <div className="d-flex justify-content-between align-items-start gap-3">
                          <div>
                            <div className="fw-semibold">
                              {clientNames.length > 0 ? clientNames.join(", ") : "Unknown client"}
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
                            {revokingSession === session.id ? "Revoking…" : "Revoke"}
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
