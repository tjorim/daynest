// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SectionCard, SummaryCard, WebFocusPanel, type BulkAction } from "@/features/today/TodaySections";
import type { SectionItem } from "@/lib/api/today";

describe("Today section components", () => {
  it("renders SummaryCard label and value", () => {
    render(<SummaryCard label="Due Today" value={3} tone="warning" />);

    expect(screen.getByText("Due Today")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders WebFocusPanel with next actionable item and progress", () => {
    render(
      <WebFocusPanel
        sections={[
          {
            key: "due-today",
            heading: "Due Today",
            items: [
              {
                id: "chore-1",
                title: "Water plants",
                choreInstanceId: 1,
                choreStatus: "pending",
              },
              {
                id: "chore-2",
                title: "Laundry",
                choreInstanceId: 2,
                choreStatus: "completed",
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Today's focus")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Water plants" })).toBeInTheDocument();
    expect(screen.getByLabelText("50% complete")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Today completion" })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    expect(screen.getByRole("link", { name: /due today/i })).toHaveAttribute("href", "#due-today");
  });

  it("renders WebFocusPanel empty state when no actionable items remain", () => {
    render(<WebFocusPanel sections={[{ key: "done", heading: "Done", items: [] }]} />);

    expect(screen.getByText("All clear for now")).toBeInTheDocument();
    expect(screen.getByText("No open actions remain for today.")).toBeInTheDocument();
    expect(screen.getByLabelText("0% complete")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Today completion" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });

  it("renders SectionCard items and runs configured bulk actions", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const runBulkDone = vi.fn().mockResolvedValue(undefined);
    const items: SectionItem[] = [
      {
        id: "item-1",
        title: "Water plants",
        subtitle: "Pending • May 16, 2026",
        statusLabel: "Pending",
        statusTone: "warning",
        choreInstanceId: 1,
        choreStatus: "pending",
      },
    ];

    const bulkActions: BulkAction[] = [
      {
        key: "bulk-done",
        label: "Bulk Done",
        buttonClassName: "btn-success",
        isAvailable: () => true,
        run: runBulkDone,
      },
    ];

    render(
      <SectionCard
        sectionId="due-today"
        heading="Due Today"
        items={items}
        onRefresh={onRefresh}
        bulkActions={bulkActions}
      />,
    );

    expect(screen.getByText("Due Today")).toBeInTheDocument();
    expect(screen.getByText("Water plants")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Select Water plants"));
    await user.click(screen.getByRole("button", { name: "Bulk Done" }));

    await waitFor(() => {
      expect(runBulkDone).toHaveBeenCalledWith(items[0]);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Bulk Done applied to 1 item.")).toBeInTheDocument();
  });

  it("shows failure feedback when a bulk action fails for all selected items", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const runBulkDone = vi.fn().mockRejectedValue(new Error("boom"));
    const items: SectionItem[] = [
      { id: "item-1", title: "Water plants", choreInstanceId: 1, choreStatus: "pending" },
    ];
    const bulkActions: BulkAction[] = [
      {
        key: "bulk-done",
        label: "Bulk Done",
        buttonClassName: "btn-success",
        isAvailable: () => true,
        run: runBulkDone,
      },
    ];

    render(
      <SectionCard
        sectionId="due-today"
        heading="Due Today"
        items={items}
        onRefresh={onRefresh}
        bulkActions={bulkActions}
      />,
    );

    await user.click(screen.getByLabelText("Select Water plants"));
    await user.click(screen.getByRole("button", { name: "Bulk Done" }));

    await waitFor(() => {
      expect(runBulkDone).toHaveBeenCalledTimes(1);
    });
    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.getByText("Bulk Done failed for all 1 selected item.")).toBeInTheDocument();
  });

  it("shows partial-success feedback when a bulk action only succeeds for some items", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const runBulkDone = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("boom"));
    const items: SectionItem[] = [
      { id: "item-1", title: "Water plants", choreInstanceId: 1, choreStatus: "pending" },
      { id: "item-2", title: "Laundry", choreInstanceId: 2, choreStatus: "pending" },
    ];
    const bulkActions: BulkAction[] = [
      {
        key: "bulk-done",
        label: "Bulk Done",
        buttonClassName: "btn-success",
        isAvailable: () => true,
        run: runBulkDone,
      },
    ];

    render(
      <SectionCard
        sectionId="due-today"
        heading="Due Today"
        items={items}
        onRefresh={onRefresh}
        bulkActions={bulkActions}
      />,
    );

    await user.click(screen.getByLabelText("Select Water plants"));
    await user.click(screen.getByLabelText("Select Laundry"));
    await user.click(screen.getByRole("button", { name: "Bulk Done" }));

    await waitFor(() => {
      expect(runBulkDone).toHaveBeenCalledTimes(2);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Bulk Done updated 1 item and failed for 1.")).toBeInTheDocument();
  });
});
