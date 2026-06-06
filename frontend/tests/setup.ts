import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, vi } from "vitest";

// jsdom does not implement requestAnimationFrame/cancelAnimationFrame,
// but Schedule-X (Preact) calls them in timers that outlast tests.
if (typeof globalThis.requestAnimationFrame === "undefined") {
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0) as unknown as number;
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

vi.mock("@/app/layout/AppLayout", async () => {
  const { Outlet } = await import("@tanstack/react-router");
  return { AppLayout: Outlet };
});
import { setLocale } from "@/paraglide/runtime";

beforeAll(() => {
  setLocale("en", { reload: false });
});

afterEach(() => {
  cleanup();
});
