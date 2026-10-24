import { useMemo, useState } from "react";
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  flexRender,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type SortingState,
  tableFeatures,
  useTable,
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
import { apiErrorMessage } from "@/lib/api/errorMessages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

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
const integrationClientTableFeatures = tableFeatures({
  columnVisibilityFeature,
  columnFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    text: sortFn_text,
  },
});
const integrationClientColumnHelper = createColumnHelper<
  typeof integrationClientTableFeatures,
  IntegrationClient
>();

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
  const [clientType, setClientType] = useState<"home_assistant" | "pebble">("home_assistant");
  const [rateLimit, setRateLimit] = useState("120");
  const [revokingClient, setRevokingClient] = useState<number | null>(null);
  const [revokeClientError, setRevokeClientError] = useState<string | null>(null);
  const [rotatingClient, setRotatingClient] = useState<number | null>(null);
  const [rotateClientError, setRotateClientError] = useState<string | null>(null);
  const [clientSorting, setClientSorting] = useState<SortingState>([]);
  const [clientColumnFilters, setClientColumnFilters] = useState<ColumnFiltersState>([]);
  const [clientColumnVisibility, setClientColumnVisibility] = useState<ColumnVisibilityState>({
    rateLimit: true,
    status: true,
  });

  const clientsQuery = useIntegrationClientsQuery();
  const createClientMutation = useCreateIntegrationClientMutation();
  const rotateClientMutation = useRotateIntegrationClientMutation();
  const revokeClientMutation = useRevokeIntegrationClientMutation();
  const clients = clientsQuery.data ?? [];
  const loading = clientsQuery.isPending;
  const error = clientsQuery.error
    ? apiErrorMessage(clientsQuery.error, m.load_integration_clients_failed())
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
      setSuccessMessage(m.settings_client_secret_rotated());
    } catch (err) {
      setRotateClientError(apiErrorMessage(err, m.settings_client_rotate_failed()));
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
      setRevokeClientError(apiErrorMessage(err, m.settings_client_revoke_failed()));
    } finally {
      setRevokingClient(null);
    }
  };

  const onCreateClient = async () => {
    if (!name.trim()) {
      setSubmitError(m.settings_client_name_required());
      return;
    }

    const parsedRateLimit = parseInt(rateLimit, 10);
    if (isNaN(parsedRateLimit) || parsedRateLimit < 10 || parsedRateLimit > 600) {
      setSubmitError(m.settings_client_rate_limit_range());
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const created = await createClientMutation.mutateAsync({
        name: name.trim(),
        rate_limit_per_minute: parsedRateLimit,
        scopes: clientType === "pebble" ? ["pebble:read", "pebble:write"] : ["home_assistant:*"],
      });
      setCreatedClient(created);
      setSuccessMessage(m.settings_client_created());
    } catch (err) {
      setSubmitError(apiErrorMessage(err, m.settings_client_create_failed()));
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyApiKey = async () => {
    if (!createdClient?.client_secret) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(createdClient.client_secret);
        setCopyStatus(m.settings_client_secret_copied());
      } else {
        setCopyStatus(m.settings_client_copy_failed());
      }
    } catch {
      setCopyStatus(m.settings_client_copy_failed());
    }
  };

  const clientColumns = useMemo(
    () =>
      integrationClientColumnHelper.columns([
        integrationClientColumnHelper.accessor("name", {
          id: "name",
          header: m.settings_client_column_name(),
          cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
        }),
        integrationClientColumnHelper.accessor("rate_limit_per_minute", {
          id: "rateLimit",
          header: m.settings_rate_limit_label(),
          enableColumnFilter: false,
          cell: (info) => (
            <small className="text-muted-foreground block">
              {m.settings_client_rate_per_minute({ count: info.getValue() })}
            </small>
          ),
        }),
        integrationClientColumnHelper.accessor("is_active", {
          id: "status",
          header: m.status_active(),
          enableColumnFilter: false,
          cell: (info) => (
            <Badge variant={info.getValue() ? "success" : "secondary"}>
              {info.getValue() ? m.status_active() : m.status_inactive()}
            </Badge>
          ),
        }),
        integrationClientColumnHelper.display({
          id: "actions",
          header: m.settings_client_column_actions(),
          enableSorting: false,
          enableColumnFilter: false,
          cell: (info) => {
            const client = info.row.original;
            return (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  disabled={rotatingClient === client.id || revokingClient === client.id}
                  onClick={() => void onRotateClient(client.id)}
                >
                  {rotatingClient === client.id
                    ? m.settings_rotating()
                    : m.settings_rotate_secret()}
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  disabled={revokingClient === client.id || rotatingClient === client.id}
                  onClick={() => void onRevokeClient(client.id)}
                >
                  {revokingClient === client.id ? m.settings_revoking() : m.settings_revoke()}
                </Button>
              </div>
            );
          },
        }),
      ]),
    [revokingClient, rotatingClient],
  );

  const clientsTable = useTable({
    features: integrationClientTableFeatures,
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
  });

  return (
    <>
      <div className="flex justify-end mb-2">
        <Button
          variant="outline-primary"
          size="sm"
          disabled={loading}
          onClick={() => void loadClients()}
        >
          {m.settings_refresh()}
        </Button>
      </div>
      <FeedbackBanner message={loading ? m.settings_loading() : null} tone="info" />
      {error ? (
        <Alert variant="danger" className="py-2 flex justify-between items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <Button variant="danger" size="sm" onClick={() => void loadClients()}>
              {m.settings_retry()}
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <FeedbackBanner
        message={successMessage}
        tone="success"
        onDismiss={() => setSuccessMessage(null)}
      />

      <Card className="mb-4">
        <CardHeader className="font-semibold py-2">{m.settings_create_client_header()}</CardHeader>
        <CardContent className="grid gap-4">
          <Input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSubmitError(null);
            }}
            placeholder={m.settings_client_name_placeholder()}
            aria-label={m.settings_client_name_placeholder()}
          />
          <div>
            <Label className="text-small font-semibold mb-1" htmlFor="client-type">
              {m.settings_client_type_label()}
            </Label>
            <Select
              id="client-type"
              value={clientType}
              onChange={(event) => {
                const value = event.target.value as "home_assistant" | "pebble";
                setClientType(value);
                setName(value === "pebble" ? "Pebble" : "Home Assistant");
              }}
            >
              <option value="home_assistant">Home Assistant</option>
              <option value="pebble">{m.settings_client_type_pebble()}</option>
            </Select>
            <small className="text-muted-foreground block mt-1">
              {m.settings_client_type_hint()}
            </small>
          </div>
          <div>
            <Label className="text-small font-semibold mb-1" htmlFor="client-rate-limit">
              {m.settings_rate_limit_label()}
            </Label>
            <Input
              id="client-rate-limit"
              type="number"
              min={10}
              max={600}
              value={rateLimit}
              onChange={(event) => {
                setRateLimit(event.target.value);
                setSubmitError(null);
              }}
            />
            <small className="text-muted-foreground block mt-1">
              {m.settings_rate_limit_hint()}
            </small>
          </div>
          <Button disabled={isSubmitting} onClick={() => void onCreateClient()}>
            {isSubmitting ? m.settings_creating() : m.settings_create_client()}
          </Button>
        </CardContent>
        {submitError ? (
          <CardFooter>
            <FeedbackBanner
              message={submitError}
              tone="danger"
              onDismiss={() => setSubmitError(null)}
            />
          </CardFooter>
        ) : null}
      </Card>

      <Card className="mb-4">
        <CardHeader className="font-semibold py-2">{m.settings_ha_header()}</CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-small mb-2">{m.settings_ha_description()}</p>
          <dl className="grid grid-cols-12 gap-x-6 text-small mb-0">
            <dt className="col-span-12 sm:col-span-4">{m.settings_ha_base_url()}</dt>
            <dd className="col-span-12 sm:col-span-8">
              <code>{backendBaseUrl}</code>
            </dd>
            <dt className="col-span-12 sm:col-span-4">{m.settings_ha_oauth_callback()}</dt>
            <dd className="col-span-12 sm:col-span-8">
              <code>{HOME_ASSISTANT_REDIRECT_URI}</code>
            </dd>
            <dt className="col-span-12 sm:col-span-4">{m.settings_ha_contract()}</dt>
            <dd className="col-span-12 sm:col-span-8">
              <code>home-assistant; version=ha.v1</code>
            </dd>
          </dl>
          <details className="mt-4">
            <summary className="text-small font-semibold">
              {m.settings_ha_endpoints_summary()}
            </summary>
            <ul className="settings-endpoint-list mt-2 mb-0">
              {HA_ENDPOINTS.map((endpoint) => (
                <li key={endpoint}>
                  <code>{endpoint}</code>
                </li>
              ))}
            </ul>
          </details>
        </CardContent>
      </Card>

      {createdClient
        ? (() => {
            const isPebbleClient = createdClient.scopes.some((scope) =>
              scope.startsWith("pebble:"),
            );
            return (
              <Card className="mb-4">
                <CardHeader className="font-semibold py-2">
                  {createdClient.name} -{" "}
                  {isPebbleClient
                    ? m.settings_client_credential_pebble()
                    : m.settings_client_credential_legacy()}
                </CardHeader>
                <CardContent>
                  <Alert variant="warning" className="py-2">
                    {isPebbleClient
                      ? m.settings_client_pebble_note({ readme: "pebble/README.md" })
                      : m.settings_client_ha_note()}
                  </Alert>
                  <dl className="grid grid-cols-12 gap-x-6 text-small mb-0">
                    <dt className="col-span-12 sm:col-span-4">{m.settings_client_id_label()}</dt>
                    <dd className="col-span-12 sm:col-span-8">
                      <code>{createdClient.client_id}</code>
                    </dd>
                    <dt className="col-span-12 sm:col-span-4">
                      {m.settings_client_secret_label()}
                    </dt>
                    <dd className="col-span-12 sm:col-span-8">
                      <code className="settings-api-key">{createdClient.client_secret}</code>
                    </dd>
                    <dt className="col-span-12 sm:col-span-4">
                      {m.settings_client_token_url_label()}
                    </dt>
                    <dd className="col-span-12 sm:col-span-8">
                      <code>{createdClient.token_url}</code>
                    </dd>
                    <dt className="col-span-12 sm:col-span-4">
                      {isPebbleClient
                        ? m.settings_client_key_header_pebble()
                        : m.settings_client_key_header_fallback()}
                    </dt>
                    <dd className="col-span-12 sm:col-span-8">
                      <code>X-Integration-Key</code>
                    </dd>
                  </dl>
                  <div className="flex gap-2 mt-4 flex-wrap">
                    <Button variant="outline-primary" size="sm" onClick={() => void copyApiKey()}>
                      {m.settings_client_copy_secret()}
                    </Button>
                    {copyStatus ? (
                      <small className="text-muted-foreground self-center">{copyStatus}</small>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })()
        : null}

      <Card>
        <CardHeader className="font-semibold py-2">
          {m.settings_integration_clients_header()}
        </CardHeader>
        <CardContent className="border-b border-border grid gap-2">
          <Label className="text-small font-semibold mb-0" htmlFor="integration-client-filter">
            {m.settings_search_clients()}
          </Label>
          <Input
            size="sm"
            id="integration-client-filter"
            value={(clientsTable.getColumn("name")?.getFilterValue() as string | undefined) ?? ""}
            onChange={(event) => clientsTable.getColumn("name")?.setFilterValue(event.target.value)}
            placeholder={m.settings_filter_by_client_name()}
          />
          <div className="flex gap-4 flex-wrap text-small">
            <label className="check-row m-0">
              <Checkbox
                checked={clientsTable.getColumn("rateLimit")?.getIsVisible() ?? true}
                onChange={(event) =>
                  clientsTable.getColumn("rateLimit")?.toggleVisibility(event.target.checked)
                }
              />
              <span>{m.settings_rate_limit_label()}</span>
            </label>
            <label className="check-row m-0">
              <Checkbox
                checked={clientsTable.getColumn("status")?.getIsVisible() ?? true}
                onChange={(event) =>
                  clientsTable.getColumn("status")?.toggleVisibility(event.target.checked)
                }
              />
              <span>{m.status_active()}</span>
            </label>
          </div>
        </CardContent>
        <Table size="sm" className="mb-0 align-middle">
          <TableHeader>
            {clientsTable.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} scope="col">
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 no-underline"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {({ asc: " ↑", desc: " ↓" } as Record<string, string>)[
                          header.column.getIsSorted() as string
                        ] ?? null}
                      </Button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {clientsTable.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  className="py-2 text-muted-foreground"
                  colSpan={clientsTable.getVisibleLeafColumns().length}
                >
                  {m.settings_no_clients()}
                </TableCell>
              </TableRow>
            ) : (
              clientsTable.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {revokeClientError ? (
          <CardFooter>
            <FeedbackBanner
              message={revokeClientError}
              tone="danger"
              onDismiss={() => setRevokeClientError(null)}
            />
          </CardFooter>
        ) : null}
        {rotateClientError ? (
          <CardFooter>
            <FeedbackBanner
              message={rotateClientError}
              tone="danger"
              onDismiss={() => setRotateClientError(null)}
            />
          </CardFooter>
        ) : null}
      </Card>
    </>
  );
}
