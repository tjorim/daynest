import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlannedSection } from "@/features/today/PlannedSection";
import { QueryTestProvider } from "../../utils/queryTestProvider";

// Its own file: the mock factory below runs once per file, so it records the
// first load of the form chunk.
const formLoaded = vi.hoisted(() => vi.fn());

vi.mock("@/features/today/QuickAddPlannedForm", async () => {
  formLoaded();
  return vi.importActual("@/features/today/QuickAddPlannedForm");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PlannedSection quick add preload", () => {
  it("loads the form in the background so offline quick add has it cached", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(
      <QueryTestProvider>
        <PlannedSection items={[]} onRefresh={vi.fn().mockResolvedValue(undefined)} />
      </QueryTestProvider>,
    );
    await vi.advanceTimersByTimeAsync(1900);
    expect(formLoaded).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100);

    await vi.waitFor(() => expect(formLoaded).toHaveBeenCalledOnce());
  });
});
