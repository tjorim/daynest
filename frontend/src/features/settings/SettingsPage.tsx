import { useEffect, useState } from "react";
import {
  getDeferredInstallPrompt,
  promptToInstallApp,
  subscribeInstallPrompt,
} from "@/app/pwa/installPrompt";
import {
  createIntegrationClient,
  isRetryableApiError,
  listIntegrationClients,
  type IntegrationClient,
  type IntegrationClientCreateResponse,
} from "@/lib/api/today";
import {
  listOAuthSessions,
  revokeOAuthSession,
  type OAuthSession,
} from "@/lib/api/auth";

const AVAILABLE_SCOPES = [
  {
    key: "ha:read",
    label: "Home Assistant dashboard",
    description: "Allows Home Assistant summary, entity, and dashboard reads.",
  },
  {
    key: "ha:write",
    label: "Home Assistant actions",
    description:
      "Allows Home Assistant services to complete tasks, snooze tasks, and mark medication taken.",
  },
  {
    key: "mcp:read",
    label: "MCP Adapter",
    description: "Allows MCP-compatible reads for Today and Calendar day data.",
  },
];

const INTEGRATION_PRESETS = [
  {
    key: "ha-dashboard",
    label: "Home Assistant dashboard",
    name: "Home Assistant",
    scopes: ["ha:read"],
    rateLimit: "120",
    description: "Sensors, dashboard metrics, setup validation, and entity reads.",
  },
  {
    key: "ha-automation",
    label: "Home Assistant automations",
    name: "Home Assistant Automations",
    scopes: ["ha:read", "ha:write"],
    rateLimit: "120",
    description: "Everything in dashboard mode plus write services for household automations.",
  },
  {
    key: "mcp-reader",
    label: "MCP read-only",
    name: "MCP Adapter",
    scopes: ["mcp:read"],
    rateLimit: "60",
    description: "Least-privilege read access for MCP consumers.",
  },
];

const HA_ENDPOINTS = [
  "GET /api/v1/integrations/home-assistant/summary",
  "GET /api/v1/integrations/home-assistant/dashboard",
  "POST /api/v1/integrations/home-assistant/actions/complete-task",
  "POST /api/v1/integrations/home-assistant/actions/snooze-task",
  "POST /api/v1/integrations/home-assistant/actions/mark-medication-taken",
  "POST /api/v1/integrations/home-assistant/actions/skip-task",
  "POST /api/v1/integrations/home-assistant/actions/skip-medication",
];

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
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["ha:read"]);

  const [oauthSessions, setOauthSessions] = useState<OAuthSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const backendBaseUrl = window.location.origin;

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

  const toggleScope = (scope: string) => {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );
    setSubmitError(null);
  };

  const applyPreset = (preset: (typeof INTEGRATION_PRESETS)[number]) => {
    setName(preset.name);
    setRateLimit(preset.rateLimit);
    setSelectedScopes(preset.scopes);
    setSubmitError(null);
    setSuccessMessage(null);
  };

  const onCreateClient = async () => {
    if (!name.trim()) {
      setSubmitError("Client name is required.");
      return;
    }

    if (selectedScopes.length === 0) {
      setSubmitError("Select at least one scope.");
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
        scopes: selectedScopes,
        rate_limit_per_minute: parsedRateLimit,
      });
      setCreatedClient(created);
      setSuccessMessage(
        "Integration client created. Copy the API key now; it will not be shown again.",
      );
      await loadClients();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create integration client.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyApiKey = async () => {
    if (!createdClient?.api_key) {
      return;
    }
    try {
      await navigator.clipboard.writeText(createdClient.api_key);
      setCopyStatus("API key copied.");
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
        Configure integration clients for Home Assistant and MCP consumers. API keys are shown only
        once when created.
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
            <div className="card-header fw-semibold py-2">Integration presets</div>
            <div className="card-body d-grid gap-2">
              {INTEGRATION_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className="btn btn-outline-primary text-start"
                  onClick={() => applyPreset(preset)}
                >
                  <span className="fw-semibold d-block">{preset.label}</span>
                  <span className="small text-muted">{preset.description}</span>
                </button>
              ))}
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
                <label className="form-label small fw-semibold mb-2">Scopes</label>
                <div className="d-grid gap-2">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <label key={scope.key} className="border rounded p-2">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={selectedScopes.includes(scope.key)}
                          onChange={() => toggleScope(scope.key)}
                          id={`scope-${scope.key}`}
                        />
                        <span className="form-check-label fw-semibold">{scope.label}</span>
                      </div>
                      <small className="text-muted d-block mt-1">{scope.description}</small>
                    </label>
                  ))}
                </div>
              </div>
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
                Use these values when adding the Daynest custom integration in Home Assistant.
              </p>
              <dl className="row small mb-0">
                <dt className="col-sm-4">Base URL</dt>
                <dd className="col-sm-8">
                  <code>{backendBaseUrl}</code>
                </dd>
                <dt className="col-sm-4">Header</dt>
                <dd className="col-sm-8">
                  <code>X-Integration-Key</code>
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
              <div className="card-header fw-semibold py-2">New API key</div>
              <div className="card-body">
                <div className="alert alert-warning py-2">
                  This key is shown once. Store it in your integration client before leaving this
                  page.
                </div>
                <code className="settings-api-key">{createdClient.api_key}</code>
                <div className="d-flex gap-2 mt-3 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => void copyApiKey()}
                  >
                    Copy key
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
                          {client.scopes.join(", ")} • {client.rate_limit_per_minute}/min
                        </small>
                        <small className="text-muted d-block mt-1">
                          {[
                            client.scopes.includes("ha:read") && "Home Assistant dashboard ready.",
                            client.scopes.includes("ha:write") && "HA actions enabled.",
                            client.scopes.includes("mcp:read") && "MCP adapter ready.",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        </small>
                      </div>
                      <span
                        className={`badge ${client.is_active ? "text-bg-success" : "text-bg-secondary"}`}
                      >
                        {client.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </li>
                ))
              )}
            </ul>
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
                    const clientNames = Object.values(session.clients);
                    const lastAccess = session.last_access
                      ? new Date(session.last_access).toLocaleString()
                      : null;
                    return (
                      <li key={session.id} className="list-group-item py-2">
                        <div className="d-flex justify-content-between align-items-start gap-3">
                          <div>
                            <div className="fw-semibold">
                              {clientNames.length > 0 ? clientNames.join(", ") : "Unknown client"}
                            </div>
                            <small className="text-muted d-block">
                              {session.ip_address ? `IP: ${session.ip_address}` : null}
                              {session.ip_address && lastAccess ? " • " : null}
                              {lastAccess ? `Last active: ${lastAccess}` : null}
                            </small>
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
