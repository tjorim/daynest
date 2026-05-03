import { describe, expect, it } from "vitest";
import {
  capitalize,
  formatDate,
  formatDateTime,
  formatMonthYear,
  formatTime,
  toIsoDate,
} from "./dateUtils";

describe("toIsoDate", () => {
  it("formats a Date object as YYYY-MM-DD", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("formats an ISO string as YYYY-MM-DD", () => {
    expect(toIsoDate("2026-04-23T09:00:00Z")).toBe("2026-04-23");
  });
});

describe("formatTime", () => {
  it("formats an ISO string as HH:mm", () => {
    expect(formatTime("2026-04-23T09:05:00")).toBe("09:05");
  });
});

describe("formatDate", () => {
  it('formats a date string as "MMM D"', () => {
    expect(formatDate("2026-04-23")).toBe("Apr 23");
  });
});

describe("formatMonthYear", () => {
  it('formats a date string as "MMMM YYYY"', () => {
    expect(formatMonthYear("2026-04-01")).toBe("April 2026");
  });
});

describe("formatDateTime", () => {
  it('formats a datetime string as "D/M/YYYY, HH:mm"', () => {
    expect(formatDateTime("2026-04-23T09:05:00")).toBe("23/4/2026, 09:05");
  });
});

describe("capitalize", () => {
  it("uppercases the first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  it("replaces underscores with spaces", () => {
    expect(capitalize("in_progress")).toBe("In progress");
  });

  it("handles a single word with no underscores", () => {
    expect(capitalize("pending")).toBe("Pending");
  });
});
