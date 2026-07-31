import { useSyncExternalStore } from "react";

/**
 * Module-level OIDC access token bridge.
 * AuthProvider writes the current token here so non-React modules can read it.
 */
let _oidcAccessToken: string | undefined;
const listeners = new Set<() => void>();

/**
 * Module-level bridge for a silent token renewal.
 * AuthProvider registers `oidc.signinSilent` here so non-React modules (the
 * `fetchWithAuth` layer) can attempt one renewal on a 401 before giving up —
 * a 401 usually means the access token aged out while the IdP session is
 * still valid, since `automaticSilentRenew`'s proactive timer isn't the only
 * way a token goes stale. Resolves the fresh access token directly (rather
 * than relying on the reactive bridge above, which updates via a separate
 * effect and could still be stale the instant this resolves).
 */
let _signinSilent: (() => Promise<{ access_token?: string } | null>) | undefined;

export function setSigninSilent(
  fn: (() => Promise<{ access_token?: string } | null>) | undefined,
): void {
  _signinSilent = fn;
}

export async function renewOidcAccessToken(): Promise<string | null> {
  if (!_signinSilent) return null;
  try {
    const user = await _signinSilent();
    return user?.access_token ?? null;
  } catch {
    return null;
  }
}

export function setOidcAccessToken(token: string | undefined): void {
  if (_oidcAccessToken === token) return;

  _oidcAccessToken = token;
  listeners.forEach((listener) => listener());
}

export function getOidcAccessToken(): string | undefined {
  return _oidcAccessToken;
}

function subscribeOidcAccessToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOidcAccessToken(): string | undefined {
  return useSyncExternalStore(subscribeOidcAccessToken, getOidcAccessToken, getOidcAccessToken);
}
