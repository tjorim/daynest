import { afterEach, describe, expect, it } from "vitest";
import { apiErrorMessage, translateErrorCode } from "@/lib/api/errorMessages";
import { ApiError, parseJsonResponse } from "@/lib/api/http";
import * as m from "@/paraglide/messages";
import { setLocale } from "@/paraglide/runtime";

afterEach(() => {
  setLocale("en", { reload: false });
});

describe("apiErrorMessage", () => {
  it("shows the translated message for a known code, not the English detail", () => {
    const error = new ApiError("Household not found", 404, false, null, "household_not_found");

    expect(apiErrorMessage(error, "Unable to load household")).toBe("Household not found.");

    setLocale("nl", { reload: false });
    expect(apiErrorMessage(error, "Kan huishouden niet laden")).toBe("Huishouden niet gevonden.");
  });

  it("falls back to the translated operation message for an unknown code", () => {
    const error = new ApiError("Something new went wrong", 409, false, null, "brand_new_code");

    expect(apiErrorMessage(error, "Unable to save")).toBe("Unable to save");
  });

  it("falls back for errors without a code and for non-API errors", () => {
    expect(apiErrorMessage(new ApiError("Raw", 500), "Unable to save")).toBe("Unable to save");
    expect(apiErrorMessage(new Error("TypeError: x is undefined"), "Unable to save")).toBe(
      "Unable to save",
    );
    expect(apiErrorMessage("nope", "Unable to save")).toBe("Unable to save");
  });

  it("does not treat inherited object keys as codes", () => {
    expect(translateErrorCode("constructor")).toBeNull();
    expect(translateErrorCode("toString")).toBeNull();
  });

  it("interpolates safe parameters", () => {
    const error = new ApiError(
      "Unsupported export version: 9",
      422,
      false,
      null,
      "unsupported_export_version",
      {
        version: 9,
      },
    );

    expect(apiErrorMessage(error, "Unable to import")).toBe(
      "This export version (9) is not supported.",
    );
  });

  it("keeps the request id so a failure can be traced", () => {
    const error = new ApiError("Not found", 404, false, "req-1", "not_found");

    expect(apiErrorMessage(error, "Unable to load")).toBe(
      "That item could not be found. [request-id: req-1]",
    );
  });
});

describe("parseJsonResponse error bodies", () => {
  it("carries the code and params from the response body", async () => {
    const response = new Response(
      JSON.stringify({
        detail: "Unsupported export version: 9",
        code: "unsupported_export_version",
        params: { version: 9, nested: { no: true }, list: [1] },
      }),
      { status: 422, headers: { "content-type": "application/json" } },
    );

    const error = await parseJsonResponse(response, m.api_request_failed()).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("unsupported_export_version");
    expect((error as ApiError).params).toEqual({ version: 9 });
  });

  it("leaves the code empty for bodies from servers that do not send one", async () => {
    const response = new Response(JSON.stringify({ detail: "Internal server error" }), {
      status: 500,
    });

    const error = (await parseJsonResponse(response, m.api_request_failed()).catch(
      (e: unknown) => e,
    )) as ApiError;

    expect(error.code).toBeNull();
    expect(error.message).toBe("Internal server error");
  });
});
