import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, vi } from "vitest";

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
