import { HttpResponse, type HttpResponseInit } from "msw/http";
import type { JsonBodyType } from "msw";

/** No inferred body type: each successful fixture must name its generated contract. */
export function jsonResponse<Body extends JsonBodyType = never>(
  body: NoInfer<Body>,
  init?: HttpResponseInit,
): Response {
  return HttpResponse.json(body, init);
}
