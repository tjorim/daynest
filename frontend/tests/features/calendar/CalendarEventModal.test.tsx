import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CalendarEventModal } from "@/features/calendar/CalendarEventModal";
import type { UnifiedDayItem } from "@/lib/api/today";

const item: UnifiedDayItem = {
  item_type: "chore",
  item_id: 7,
  title: "Water plants",
  status: "pending",
  scheduled_at: null,
  scheduled_date: "2026-10-24",
  detail: "Balcony first",
  module_key: null,
};

function setup(overrides: Partial<Parameters<typeof CalendarEventModal>[0]> = {}) {
  const props = {
    item,
    isRunning: false,
    onClose: vi.fn(),
    onStartRoutine: vi.fn(),
    onCompleteRoutine: vi.fn(),
    onSkipRoutine: vi.fn(),
    onCompleteChore: vi.fn(),
    onSkipChore: vi.fn(),
    onRescheduleChore: vi.fn(),
    onEditPlanned: vi.fn(),
    ...overrides,
  };
  render(<CalendarEventModal {...props} />);
  return { props, user: userEvent.setup() };
}

describe("CalendarEventModal", () => {
  it("renders nothing without an item", () => {
    setup({ item: null });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a labelled modal dialog that starts on the close button", async () => {
    setup();
    const dialog = await screen.findByRole("dialog", { name: "Water plants" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("closes with Escape, the close button and Cancel", async () => {
    const { props, user } = setup();
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onClose).toHaveBeenCalledTimes(3);
  });

  it("runs the chore actions", async () => {
    const { props, user } = setup();
    await user.click(await screen.findByRole("button", { name: "Done" }));
    expect(props.onCompleteChore).toHaveBeenCalledWith(7);
  });
});
