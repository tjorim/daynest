import { buildApiUrl } from "@/lib/api/serverConfig";
import { getOidcAccessToken } from "@/lib/auth/session";
import { enqueue as enqueueOffline } from "@/lib/offlineQueue";
import { z } from "zod";

export class ApiError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  readonly requestId: string | null;

  constructor(message: string, status: number, retryable = false, requestId: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryable = retryable;
    this.requestId = requestId;
  }
}

export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit = {},
  retries = 2,
): Promise<Response> {
  let attempt = 0;
  let lastError: unknown;
  const isIdempotent =
    !init.method || ["GET", "HEAD", "PUT", "DELETE", "OPTIONS"].includes(init.method.toUpperCase());

  while (attempt <= retries) {
    try {
      const response = await fetch(input, init);
      if (!response.ok && isRetryableStatus(response.status) && attempt < retries && isIdempotent) {
        await sleep(250 * 2 ** attempt);
        attempt += 1;
        continue;
      }
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      lastError = error;
      if (attempt >= retries || !isIdempotent) break;
      await sleep(250 * 2 ** attempt);
      attempt += 1;
    }
  }

  if (lastError instanceof Error) {
    throw new ApiError(`Network request failed: ${lastError.message}`, 0, isIdempotent);
  }
  throw new ApiError("Network request failed.", 0, isIdempotent);
}

export function withAuthHeader(init: RequestInit, token?: string): RequestInit {
  if (!token) {
    return init;
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

export async function fetchWithAuth(
  input: string | URL,
  init: RequestInit = {},
  retries = 2,
): Promise<Response> {
  const token = getOidcAccessToken();
  if (!token) {
    throw new ApiError("Not authenticated", 401);
  }
  const url =
    typeof input === "string" && !/^https?:\/\//i.test(input) ? buildApiUrl(input) : input;
  const method = (init.method ?? "GET").toUpperCase();
  if (
    typeof navigator !== "undefined" &&
    !navigator.onLine &&
    method !== "GET" &&
    method !== "HEAD"
  ) {
    enqueueOffline(url.toString(), init);
    throw new ApiError(
      "You are offline. This action will be replayed when you reconnect.",
      0,
      false,
    );
  }
  return fetchWithRetry(url, withAuthHeader(init, token), retries);
}

export async function parseJsonResponse<T>(
  response: Response,
  fallbackMessage = "Request failed",
  isIdempotent = true,
  schema?: z.ZodType<T>,
): Promise<T> {
  const requestId = response.headers.get("x-request-id");

  if (!response.ok) {
    let message = `${fallbackMessage} (${response.status})`;
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
    const fullMessage = requestId ? `${message} [request-id: ${requestId}]` : message;
    throw new ApiError(
      fullMessage,
      response.status,
      isIdempotent && isRetryableStatus(response.status),
      requestId,
    );
  }
  const payload = (await response.json()) as unknown;

  if (!schema) {
    return payload as T;
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "response";
        return `${path}: ${issue.message}`;
      })
      .join(", ");
    const fullMessage = requestId
      ? `Invalid response format: ${details} [request-id: ${requestId}]`
      : `Invalid response format: ${details}`;
    throw new ApiError(fullMessage, response.status, false, requestId);
  }

  return result.data;
}

export async function getJson<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
  retries = 1,
  fallbackMessage = "Request failed",
): Promise<T> {
  const response = await fetchWithAuth(
    path,
    {
      headers: { Accept: "application/json" },
      signal,
    },
    retries,
  );
  return parseJsonResponse(response, fallbackMessage, true, schema);
}

export async function sendJson<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  fallbackMessage = "Request failed",
): Promise<T> {
  const response = await fetchWithAuth(path, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const isIdempotent = method === "PUT" || method === "DELETE";
  return parseJsonResponse(response, fallbackMessage, isIdempotent, schema);
}

export function isRetryableApiError(error: unknown): boolean {
  return error instanceof ApiError ? error.retryable : false;
}
