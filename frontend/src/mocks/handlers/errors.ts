import { HttpResponse } from "msw/http";

export const auth401 = () =>
  HttpResponse.json(
    /* Fixture exception: intentional HTTP error body, not a successful API payload. */ {
      detail: "Not authenticated",
    },
    { status: 401 },
  );

export const forbidden403 = () =>
  HttpResponse.json(
    /* Fixture exception: intentional HTTP error body, not a successful API payload. */ {
      detail: "Forbidden",
    },
    { status: 403 },
  );

export const validation422 = (field: string, msg: string) =>
  HttpResponse.json(
    /* Fixture exception: intentional HTTP error body, not a successful API payload. */
    { detail: [{ loc: ["body", field], msg, type: "value_error" }] },
    { status: 422 },
  );

export const serverError500 = () =>
  HttpResponse.json(
    /* Fixture exception: intentional HTTP error body, not a successful API payload. */ {
      detail: "Internal server error",
    },
    { status: 500 },
  );
