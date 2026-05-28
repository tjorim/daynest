import { HttpResponse } from "msw";

export const auth401 = () =>
  HttpResponse.json({ detail: "Not authenticated" }, { status: 401 });

export const forbidden403 = () =>
  HttpResponse.json({ detail: "Forbidden" }, { status: 403 });

export const validation422 = (field: string, msg: string) =>
  HttpResponse.json(
    { detail: [{ loc: ["body", field], msg, type: "value_error" }] },
    { status: 422 },
  );

export const serverError500 = () =>
  HttpResponse.json({ detail: "Internal server error" }, { status: 500 });
