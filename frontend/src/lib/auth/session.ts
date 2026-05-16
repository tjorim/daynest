/**
 * Module-level OIDC access token bridge.
 * AuthProvider writes the current token here so non-React modules can read it.
 */
let _oidcAccessToken: string | undefined;

export function setOidcAccessToken(token: string | undefined): void {
  _oidcAccessToken = token;
}

export function getOidcAccessToken(): string | undefined {
  return _oidcAccessToken;
}
