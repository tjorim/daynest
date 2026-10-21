import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlannedSection } from "@/features/today/PlannedSection";
import { QueryTestProvider } from "../../utils/queryTestProvider";

const createPlannedItem = vi.hoisted(() => vi.fn());
const formLoaded = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/today", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/today")>("@/lib/api/today");
  return { ...actual, createPlannedItem };
});

vi.mock("@/features/today/QuickAddPlannedForm", async () => {
  formLoaded();
  return vi.importActual("@/features/today/QuickAddPlannedForm");
});

beforeEach(() => {
  createPlannedItem.mockReset().mockResolvedValue({});
});

describe("PlannedSection quick add", () => {
  it("loads the form only when opened and adds a planned item", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <QueryTestProvider>
        <PlannedSection items={[]} onRefresh={onRefresh} />
      </QueryTestProvider>,
    );
    expect(formLoaded).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "+ Quick add" }));
    await userEvent.type(await screen.findByPlaceholderText("Plan title for today…"), "Buy bread");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(formLoaded).toHaveBeenCalledOnce();
    expect(createPlannedItem).toHaveBeenCalledWith(expect.objectContaining({ title: "Buy bread" }));
    expect(await screen.findByRole("button", { name: "+ Quick add" })).toBeEnabled();
  });
});
