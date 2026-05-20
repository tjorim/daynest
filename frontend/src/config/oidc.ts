import type { AuthProviderProps } from "react-oidc-context";
import { buildApiUrl } from "@/lib/api/serverConfig";

const OIDC_CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID ?? "daynest";
const OIDC_REDIRECT_URI =
  import.meta.env.VITE_OIDC_REDIRECT_URI ?? `${window.location.origin}/auth/callback`;
const OIDC_SCOPE = import.meta.env.VITE_OIDC_SCOPE ?? "openid profile email";
export const AUTH_ROUTE_PATHS = new Set(["/auth", "/auth/callback"]);

function resolveReturnTo(raw: unknown): string {
  if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) {
    const pathname = raw.split(/[?#]/)[0] ?? "";
    return AUTH_ROUTE_PATHS.has(pathname) ? "/today" : raw;
  }

  return "/today";
}

export function onSigninCallback(user: { state?: unknown } | void): void {
  const returnTo = resolveReturnTo(
    (user?.state as { returnTo?: string } | undefined)?.returnTo,
  );
  window.history.replaceState({}, document.title, returnTo);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const DISCOVERY_CACHE_KEY = "daynest_oidc_discovery";

interface OidcDiscovery {
  issuer: string;
  authorization_url: string;
  token_url: string;
}

export async function fetchOidcConfig(): Promise<AuthProviderProps> {
  const cached = sessionStorage.getItem(DISCOVERY_CACHE_KEY);
  let discovery: OidcDiscovery;

  if (cached) {
    discovery = JSON.parse(cached) as OidcDiscovery;
  } else {
    const response = await fetch(buildApiUrl("/api/v1/auth/oidc-config"));
    if (!response.ok) {
      throw new Error(`OIDC discovery failed: ${response.status}`);
    }
    discovery = (await response.json()) as OidcDiscovery;
    sessionStorage.setItem(DISCOVERY_CACHE_KEY, JSON.stringify(discovery));
  }

  return {
    authority: discovery.issuer,
    client_id: OIDC_CLIENT_ID,
    redirect_uri: OIDC_REDIRECT_URI,
    scope: OIDC_SCOPE,
    automaticSilentRenew: true,
    post_logout_redirect_uri: window.location.origin,
    onSigninCallback,
  };
}
