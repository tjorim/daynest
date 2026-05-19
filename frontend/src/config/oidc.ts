import type { AuthProviderProps } from "react-oidc-context";

const OIDC_AUTHORITY =
  import.meta.env.VITE_OIDC_AUTHORITY ?? "http://localhost:8080/realms/daynest";
const OIDC_CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID ?? "daynest";
const OIDC_REDIRECT_URI =
  import.meta.env.VITE_OIDC_REDIRECT_URI ?? `${window.location.origin}/auth/callback`;
const OIDC_SCOPE = import.meta.env.VITE_OIDC_SCOPE ?? "openid profile email";
export const AUTH_ROUTE_PATHS = new Set(["/auth", "/auth/callback"]);

function resolveReturnTo(raw: unknown): string {
  if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) {
    const pathname = raw.split(/[?#]/)[0];
    return AUTH_ROUTE_PATHS.has(pathname) ? "/today" : raw;
  }

  return "/today";
}

export const oidcConfig: AuthProviderProps = {
  authority: OIDC_AUTHORITY,
  client_id: OIDC_CLIENT_ID,
  redirect_uri: OIDC_REDIRECT_URI,
  scope: OIDC_SCOPE,
  automaticSilentRenew: true,
  post_logout_redirect_uri: window.location.origin,
  onSigninCallback: (user) => {
    const returnTo = resolveReturnTo((user?.state as { returnTo?: string } | undefined)?.returnTo);
    window.history.replaceState({}, document.title, returnTo);
    window.dispatchEvent(new PopStateEvent("popstate"));
  },
};
