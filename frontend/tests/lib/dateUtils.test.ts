import { afterEach, describe, expect, it } from "vitest";
import { setLocale } from "@/paraglide/runtime";
import {
  capitalize,
  formatDate,
  formatDateTime,
  formatMonthYear,
  formatTime,
  formatWeekday,
  toIsoDate,
} from "@/lib/dateUtils";

afterEach(() => {
  setLocale("en", { reload: false });
});

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
  it("formats a datetime string as a short date with 24-hour time", () => {
    expect(formatDateTime("2026-04-23T09:05:00")).toBe("Apr 23, 2026, 09:05");
  });
});

describe("Dutch locale", () => {
  it("formats dates, month names, weekdays and date-times in Dutch", () => {
    setLocale("nl", { reload: false });
    expect(formatDate("2026-04-23")).toBe("23 apr");
    expect(formatMonthYear("2026-03-01")).toBe("maart 2026");
    expect(formatWeekday("2026-04-23", "long")).toBe("donderdag");
    expect(formatWeekday("2026-04-23")).toBe("do");
    expect(formatDateTime("2026-04-23T09:05:00")).toContain("23 apr 2026");
    expect(formatDateTime("2026-04-23T09:05:00")).toContain("09:05");
  });

  it("follows the selected locale when it changes", () => {
    setLocale("nl", { reload: false });
    const dutch = formatMonthYear("2026-05-01");
    setLocale("en", { reload: false });
    expect(formatMonthYear("2026-05-01")).toBe("May 2026");
    expect(dutch).toBe("mei 2026");
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
