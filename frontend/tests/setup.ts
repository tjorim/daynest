import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll } from "vitest";
import { setLanguageTag } from "@/paraglide/runtime";

beforeAll(() => {
  setLanguageTag("en");
});

afterEach(() => {
  cleanup();
});
