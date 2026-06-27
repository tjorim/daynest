import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/http";
import { createDaynestQueryClient } from "@/lib/query/queryClient";

describe("createDaynestQueryClient", () => {
  it("disables retries for auth and non-retryable API errors", () => {
    const queryClient = createDaynestQueryClient();
    const retry = queryClient.getDefaultOptions().queries?.retry as (
      failureCount: number,
      error: unknown,
    ) => boolean;

    expect(retry(0, new ApiError("Not authenticated", 401))).toBe(false);
    expect(retry(0, new ApiError("Forbidden", 403))).toBe(false);
    expect(retry(0, new ApiError("Validation failed", 422, false))).toBe(false);
  });

  it("retries transient failures up to the configured limit", () => {
    const queryClient = createDaynestQueryClient();
    const queryRetry = queryClient.getDefaultOptions().queries?.retry as (
      failureCount: number,
      error: unknown,
    ) => boolean;
    const mutationRetry = queryClient.getDefaultOptions().mutations?.retry as (
      failureCount: number,
      error: unknown,
    ) => boolean;
    const transientError = new ApiError("Server unavailable", 503, true);

    expect(queryRetry(0, transientError)).toBe(true);
    expect(queryRetry(1, transientError)).toBe(true);
    expect(queryRetry(2, transientError)).toBe(false);

    expect(mutationRetry(0, transientError)).toBe(true);
    expect(mutationRetry(1, transientError)).toBe(true);
    expect(mutationRetry(2, transientError)).toBe(false);
  });
});
