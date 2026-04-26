const ACCESS_TOKEN_KEY = 'daynest.accessToken';
const REFRESH_TOKEN_KEY = 'daynest.refreshToken';

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

function hasWindow() {
  return typeof window !== 'undefined';
}

export function getStoredTokens(): SessionTokens | null {
  if (!hasWindow()) {
    return null;
  }

  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken };
}

export function storeTokens(tokens: SessionTokens) {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearStoredTokens() {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}
