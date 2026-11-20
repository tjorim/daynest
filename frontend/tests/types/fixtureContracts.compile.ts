import { vi } from "vitest";
import { jsonResponse } from "@/mocks/response";
import type {
  CalendarMonthResponse,
  CalendarRangeResponse,
  IntegrationClientResponse,
  PlannedTodayItem,
} from "@/api-schema";

// Compile-only probes: tsc must reject these even though the helper could otherwise infer any shape.
function negativeContracts() {
  // @ts-expect-error An omitted generic cannot infer the body.
  jsonResponse({ arbitrary: true });
  // @ts-expect-error Missing the month metadata.
  jsonResponse<CalendarMonthResponse>({ days: [] });
  // @ts-expect-error Nested calendar records must include recurrence and priority fields.
  jsonResponse<CalendarRangeResponse>({ items: [{ item_id: 1, title: "Incomplete" }] });
  // @ts-expect-error Missing credential metadata on an ordinary integration client.
  jsonResponse<IntegrationClientResponse>({ id: 1, name: "Incomplete" });
  // @ts-expect-error The priority vocabulary is generated, including urgent but not arbitrary values.
  const priority: PlannedTodayItem["priority"] = "critical";
  const fetchCalendar = vi.fn<typeof import("@/lib/api/today").fetchCalendarRange>();
  // @ts-expect-error API function doubles must also reject incomplete nested fixtures.
  fetchCalendar.mockResolvedValue({ items: [{ title: "Incomplete" }] });
  return priority;
}
void negativeContracts;
