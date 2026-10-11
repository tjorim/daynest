import { getOidcAccessToken } from "@/lib/auth/session";
import { buildApiUrl } from "@/lib/api/serverConfig";
import { ApiError, readErrorBody, type ApiErrorParams } from "@/lib/api/http";
import * as m from "@/paraglide/messages";

export interface AuthUser {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  roles: string[];
}

export interface OAuthSessionClient {
  clientId: string;
  clientName: string | null;
  userConsentRequired: boolean;
  inUse: boolean;
  offlineAccess: boolean;
}

export interface OAuthSession {
  id: string;
  ip_address: string | null;
  started: number | null;
  last_access: number | null;
  expires: number | null;
  clients: OAuthSessionClient[];
  is_current: boolean;
}

export class AuthApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    code: string | null = null,
    params?: ApiErrorParams,
  ) {
    super(message, status, false, null, code, params);
    this.name = "AuthApiError";
  }
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const { message, code, params } = await readErrorBody(response, fallbackMessage);
    throw new AuthApiError(message, response.status, code, params);
  }

  return (await response.json()) as T;
}

export async function fetchMe(accessToken: string): Promise<AuthUser> {
  const response = await fetch(buildApiUrl("/api/auth/me"), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return parseJsonResponse<AuthUser>(response, m.api_session_load_failed());
}

export async function listOAuthSessions(): Promise<OAuthSession[]> {
  const token = getOidcAccessToken();
  if (!token) {
    throw new AuthApiError("Not authenticated", 401, "not_authenticated");
  }
  const response = await fetch(buildApiUrl("/api/auth/sessions"), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return parseJsonResponse<OAuthSession[]>(response, m.api_oauth_sessions_load_failed());
}

export async function revokeOAuthSession(sessionId: string): Promise<void> {
  const token = getOidcAccessToken();
  if (!token) {
    throw new AuthApiError("Not authenticated", 401, "not_authenticated");
  }
  const response = await fetch(buildApiUrl(`/api/auth/sessions/${encodeURIComponent(sessionId)}`), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    await parseJsonResponse<never>(response, m.api_session_revoke_failed());
  }
}
