import type { ComponentType } from "react";
import { lazyRouteComponent } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";

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
    <div className="alert alert-info py-2" role="status">
      {m.router_loading_page()}
    </div>
  );
}

export function RouteChunkError() {
  return (
    <div className="alert alert-danger py-2" role="alert">
      <p className="mb-2">{m.router_page_load_failed()}</p>
      <button
        type="button"
        className="btn btn-outline-danger btn-sm"
        onClick={() => window.location.reload()}
      >
        {m.router_page_reload()}
      </button>
    </div>
  );
}
