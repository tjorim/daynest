import { useSyncExternalStore } from "react";

/**
 * Module-level OIDC access token bridge.
 * AuthProvider writes the current token here so non-React modules can read it.
 */
let _oidcAccessToken: string | undefined;
const listeners = new Set<() => void>();

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
