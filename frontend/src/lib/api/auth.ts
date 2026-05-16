export interface AuthUser {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
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
