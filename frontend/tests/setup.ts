import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll } from "vitest";
import { setLocale } from "@/paraglide/runtime";

beforeAll(() => {
  setLocale("en", { reload: false });
});

afterEach(() => {
  cleanup();
});
