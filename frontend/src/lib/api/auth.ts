import { clearStoredTokens, getStoredTokens, storeTokens, type SessionTokens } from '../auth/session';

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
}

export class AuthApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest extends LoginRequest {
  full_name: string;
}

let refreshPromise: Promise<SessionTokens | null> | null = null;

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    let message = fallbackMessage;

    try {
      const body = (await response.json()) as { detail?: string | unknown[] };
      if (typeof body.detail === 'string') {
        message = body.detail;
      } else if (Array.isArray(body.detail) && body.detail.length > 0) {
        message = body.detail
          .map((entry) => {
            if (entry && typeof entry === 'object' && 'msg' in entry && typeof entry.msg === 'string') {
              return entry.msg;
            }
            return JSON.stringify(entry);
          })
          .filter((entry): entry is string => Boolean(entry))
          .join(', ');
      }
    } catch {
      // keep fallback message
    }

    throw new AuthApiError(message, response.status);
  }

  return (await response.json()) as T;
}

async function postTokenRequest(path: string, payload: LoginRequest | RegisterRequest | { refresh_token: string }) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const tokens = await parseJsonResponse<TokenPairResponse>(response, 'Authentication request failed');
  const sessionTokens = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
  storeTokens(sessionTokens);
  return sessionTokens;
}

export async function login(credentials: LoginRequest): Promise<SessionTokens> {
  return postTokenRequest('/api/v1/auth/login', credentials);
}

export async function register(payload: RegisterRequest): Promise<SessionTokens> {
  return postTokenRequest('/api/v1/auth/register', payload);
}

export async function fetchMe(accessToken?: string): Promise<AuthUser> {
  const token = accessToken ?? getStoredTokens()?.accessToken;

  if (!token) {
    throw new AuthApiError('Missing access token', 401);
  }

  const response = await fetch('/api/v1/auth/me', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return parseJsonResponse<AuthUser>(response, 'Unable to load session');
}

export async function refreshSessionTokens(): Promise<SessionTokens | null> {
  const tokens = getStoredTokens();

  if (!tokens?.refreshToken) {
    clearStoredTokens();
    return null;
  }

  refreshPromise ??= (async () => {
    try {
      return await postTokenRequest('/api/v1/auth/refresh', {
        refresh_token: tokens.refreshToken,
      });
    } catch (error) {
      if (error instanceof AuthApiError && error.status === 401) {
        clearStoredTokens();
        return null;
      }
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function logout() {
  clearStoredTokens();
}
