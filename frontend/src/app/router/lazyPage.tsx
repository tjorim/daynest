import type { ComponentType } from "react";
import { lazyRouteComponent } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Code-splits a route page into its own chunk. Chunk-load failures (offline,
 * or a stale deploy) are handled by TanStack's lazyRouteComponent — one
 * automatic reload for a missing module, then RouteChunkError. Only GET
 * navigations are retried; no mutation is ever replayed.
 */
export function lazyPage<Name extends string>(
  importer: () => Promise<Record<Name, ComponentType>>,
  exportName: Name,
) {
  return lazyRouteComponent(importer, exportName);
}

export function RoutePending() {
  return (
    <Alert variant="info" className="tw:py-2" role="status">
      {m.router_loading_page()}
    </Alert>
  );
}

export function RouteChunkError() {
  return (
    <Alert variant="danger" className="tw:py-2" role="alert">
      <p className="tw:mb-2">{m.router_page_load_failed()}</p>
      <Button variant="outline-danger" size="sm" onClick={() => window.location.reload()}>
        {m.router_page_reload()}
      </Button>
    </Alert>
  );
}
