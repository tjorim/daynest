import { useEffect, useState } from 'react';
import {
  createIntegrationClient,
  isRetryableApiError,
  listIntegrationClients,
  type IntegrationClient,
  type IntegrationClientCreateResponse,
} from '../../lib/api/today';

const AVAILABLE_SCOPES = [
  {
    key: 'ha:read',
    label: 'Home Assistant',
    description: 'Allows Home Assistant summary, entities, and dashboard reads.',
  },
  {
    key: 'mcp:read',
    label: 'MCP Adapter',
    description: 'Allows MCP-compatible reads for Today and Calendar day data.',
  },
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

  const [name, setName] = useState('Home Assistant');
  const [rateLimit, setRateLimit] = useState('120');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['ha:read']);

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
        setError(err instanceof Error ? err.message : 'Unable to load integration clients.');
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadClients(controller.signal);
    return () => controller.abort();
  }, []);

  const toggleScope = (scope: string) => {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );
    setSubmitError(null);
  };

  const onCreateClient = async () => {
    if (!name.trim()) {
      setSubmitError('Client name is required.');
      return;
    }

    if (selectedScopes.length === 0) {
      setSubmitError('Select at least one scope.');
      return;
    }

    const parsedRateLimit = parseInt(rateLimit, 10);
    if (isNaN(parsedRateLimit) || parsedRateLimit < 10 || parsedRateLimit > 600) {
      setSubmitError('Rate limit must be an integer between 10 and 600.');
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
      setSuccessMessage('Integration client created. Copy the API key now; it will not be shown again.');
      await loadClients();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create integration client.');
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
      setCopyStatus('API key copied.');
    } catch {
      setCopyStatus('Clipboard copy failed.');
    }
  };

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-2">
        <h2 className="h4 mb-0">Settings</h2>
        <button type="button" className="btn btn-outline-primary btn-sm" disabled={loading} onClick={() => void loadClients()}>
          Refresh
        </button>
      </div>
      <p className="text-muted mb-3">Configure integration clients for Home Assistant and MCP consumers. API keys are shown only once when created.</p>

      {loading ? <div className="alert alert-info py-2">Loading settings...</div> : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => void loadClients()}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      {successMessage ? <div className="alert alert-success py-2">{successMessage}</div> : null}

      <div className="row g-3">
        <div className="col-lg-5">
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
                <small className="text-muted d-block mt-1">Default is 120/min. Lower this for stricter external clients or testing.</small>
              </div>
              <button type="button" className="btn btn-primary" disabled={isSubmitting} onClick={() => void onCreateClient()}>
                {isSubmitting ? 'Creating…' : 'Create client'}
              </button>
            </div>
            {submitError ? <div className="card-footer text-danger py-2 small">{submitError}</div> : null}
          </div>

          {createdClient ? (
            <div className="card">
              <div className="card-header fw-semibold py-2">New API key</div>
              <div className="card-body">
                <div className="alert alert-warning py-2">
                  This key is shown once. Store it in your integration client before leaving this page.
                </div>
                <code className="settings-api-key">{createdClient.api_key}</code>
                <div className="d-flex gap-2 mt-3 flex-wrap">
                  <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void copyApiKey()}>
                    Copy key
                  </button>
                  {copyStatus ? <small className="text-muted align-self-center">{copyStatus}</small> : null}
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
                          {client.scopes.join(', ')} • {client.rate_limit_per_minute}/min
                        </small>
                        <small className="text-muted d-block mt-1">
                          {client.scopes.includes('ha:read') ? 'Home Assistant ready.' : ''}
                          {client.scopes.includes('ha:read') && client.scopes.includes('mcp:read') ? ' ' : ''}
                          {client.scopes.includes('mcp:read') ? 'MCP adapter ready.' : ''}
                        </small>
                      </div>
                      <span className={`badge ${client.is_active ? 'text-bg-success' : 'text-bg-secondary'}`}>
                        {client.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
