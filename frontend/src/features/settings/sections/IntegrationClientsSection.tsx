import { useMemo, useState } from "react";
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
import { FeedbackBanner } from "@/components/common/FeedbackBanner";
import {
  type IntegrationClient,
  type IntegrationClientCreateResponse,
} from "@/lib/api/integrationClients";
import { isRetryableApiError } from "@/lib/api/http";
import {
  useCreateIntegrationClientMutation,
  useIntegrationClientsQuery,
  useRevokeIntegrationClientMutation,
  useRotateIntegrationClientMutation,
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

interface IntegrationClientsSectionProps {
  backendBaseUrl: string;
}

export function IntegrationClientsSection({ backendBaseUrl }: IntegrationClientsSectionProps) {
  const [createdClient, setCreatedClient] = useState<IntegrationClientCreateResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
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

  const clientsQuery = useIntegrationClientsQuery();
  const createClientMutation = useCreateIntegrationClientMutation();
  const rotateClientMutation = useRotateIntegrationClientMutation();
  const revokeClientMutation = useRevokeIntegrationClientMutation();
  const clients = clientsQuery.data ?? [];
  const loading = clientsQuery.isPending;
  const error = clientsQuery.error instanceof Error
    ? clientsQuery.error.message
    : clientsQuery.error
      ? "Unable to load integration clients."
      : null;
  const canRetry = clientsQuery.error ? isRetryableApiError(clientsQuery.error) : false;

  const loadClients = async () => {
    await clientsQuery.refetch();
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
    if (!createdClient?.client_secret) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(createdClient.client_secret);
        setCopyStatus("Client secret copied.");
      } else {
        setCopyStatus("Clipboard copy failed.");
      }
    } catch {
      setCopyStatus("Clipboard copy failed.");
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
        cell: (info) => <small className="text-muted d-block">{info.getValue()}/min</small>,
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
    [revokingClient, rotatingClient],
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
    <>
      <div className="d-flex justify-content-end mb-2">
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={loading}
          onClick={() => void loadClients()}
        >
          {m.settings_refresh()}
        </button>
      </div>
      <FeedbackBanner message={loading ? m.settings_loading() : null} tone="info" />
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
      <FeedbackBanner
        message={successMessage}
        tone="success"
        onDismiss={() => setSuccessMessage(null)}
      />

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
            <small className="text-muted d-block mt-1">{m.settings_rate_limit_hint()}</small>
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
          <div className="card-footer">
            <FeedbackBanner message={submitError} tone="danger" onDismiss={() => setSubmitError(null)} />
          </div>
        ) : null}
      </div>

      <div className="card mb-3">
        <div className="card-header fw-semibold py-2">{m.settings_ha_header()}</div>
        <div className="card-body">
          <p className="text-muted small mb-2">{m.settings_ha_description()}</p>
          <dl className="row small mb-0">
            <dt className="col-sm-4">{m.settings_ha_base_url()}</dt>
            <dd className="col-sm-8"><code>{backendBaseUrl}</code></dd>
            <dt className="col-sm-4">{m.settings_ha_oauth_callback()}</dt>
            <dd className="col-sm-8"><code>{HOME_ASSISTANT_REDIRECT_URI}</code></dd>
            <dt className="col-sm-4">{m.settings_ha_contract()}</dt>
            <dd className="col-sm-8"><code>home-assistant; version=ha.v1</code></dd>
          </dl>
          <details className="mt-3">
            <summary className="small fw-semibold">{m.settings_ha_endpoints_summary()}</summary>
            <ul className="settings-endpoint-list mt-2 mb-0">
              {HA_ENDPOINTS.map((endpoint) => (
                <li key={endpoint}><code>{endpoint}</code></li>
              ))}
            </ul>
          </details>
        </div>
      </div>

      {createdClient ? (
        <div className="card mb-3">
          <div className="card-header fw-semibold py-2">
            {createdClient.name} - Legacy integration client fallback
          </div>
          <div className="card-body">
            <div className="alert alert-warning py-2">
              The Home Assistant integration now uses browser OAuth redirect and does not
              require these values for normal setup. Keep this secret only for legacy
              compatibility.
            </div>
            <dl className="row small mb-0">
              <dt className="col-sm-4">Client ID</dt>
              <dd className="col-sm-8"><code>{createdClient.client_id}</code></dd>
              <dt className="col-sm-4">Client secret</dt>
              <dd className="col-sm-8"><code className="settings-api-key">{createdClient.client_secret}</code></dd>
              <dt className="col-sm-4">Token URL</dt>
              <dd className="col-sm-8"><code>{createdClient.token_url}</code></dd>
              <dt className="col-sm-4">Fallback key header</dt>
              <dd className="col-sm-8"><code>X-Integration-Key</code></dd>
            </dl>
            <div className="d-flex gap-2 mt-3 flex-wrap">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => void copyApiKey()}
              >
                Copy client secret
              </button>
              {copyStatus ? <small className="text-muted align-self-center">{copyStatus}</small> : null}
            </div>
          </div>
        </div>
      ) : null}

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
          <div className="card-footer">
            <FeedbackBanner
              message={revokeClientError}
              tone="danger"
              onDismiss={() => setRevokeClientError(null)}
            />
          </div>
        ) : null}
        {rotateClientError ? (
          <div className="card-footer">
            <FeedbackBanner
              message={rotateClientError}
              tone="danger"
              onDismiss={() => setRotateClientError(null)}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
