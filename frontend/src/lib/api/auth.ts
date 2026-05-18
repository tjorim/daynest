import { getOidcAccessToken } from "@/lib/auth/session";

export interface AuthUser {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  roles: string[];
}

export interface OAuthSession {
  id: string;
  ip_address: string | null;
  started: number | null;
  last_access: number | null;
  expires: number | null;
  clients: Record<string, string>;
}

export class AuthApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    let message = fallbackMessage;

    try {
      const body = (await response.json()) as { detail?: string | unknown[] };
      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (Array.isArray(body.detail) && body.detail.length > 0) {
        message = body.detail
          .map((entry) => {
            if (
              entry &&
              typeof entry === "object" &&
              "msg" in entry &&
              typeof entry.msg === "string"
            ) {
              return entry.msg;
            }
            return JSON.stringify(entry);
          })
          .filter((entry): entry is string => Boolean(entry))
          .join(", ");
      }
    } catch {
      // keep fallback message
    }

    throw new AuthApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export async function fetchMe(accessToken: string): Promise<AuthUser> {
  const response = await fetch("/api/v1/auth/me", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return parseJsonResponse<AuthUser>(response, "Unable to load session");
}

export async function listOAuthSessions(): Promise<OAuthSession[]> {
  const token = getOidcAccessToken();
  if (!token) {
    throw new AuthApiError("Not authenticated", 401);
  }
  const response = await fetch("/api/v1/auth/sessions", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return parseJsonResponse<OAuthSession[]>(response, "Unable to load OAuth sessions");
}

export async function revokeOAuthSession(sessionId: string): Promise<void> {
  const token = getOidcAccessToken();
  if (!token) {
    throw new AuthApiError("Not authenticated", 401);
  }
  const response = await fetch(`/api/v1/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    await parseJsonResponse<never>(response, "Failed to revoke session");
  }
}
