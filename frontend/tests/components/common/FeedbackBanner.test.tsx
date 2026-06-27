import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FeedbackBanner } from "@/components/common/FeedbackBanner";

describe("FeedbackBanner", () => {
  it("announces non-error feedback politely", () => {
    render(<FeedbackBanner message="Saved" tone="success" />);

    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
    expect(banner).toHaveTextContent("Saved");
  });

  it("announces errors assertively", () => {
    render(<FeedbackBanner message="Failed" tone="danger" />);

    const banner = screen.getByRole("alert");
    expect(banner).toHaveAttribute("aria-live", "assertive");
    expect(banner).toHaveTextContent("Failed");
  });

  it("can be dismissed", async () => {
    const onDismiss = vi.fn();
    render(<FeedbackBanner message="Saved" tone="success" onDismiss={onDismiss} />);

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("re-shows the same message after it is cleared and set again", async () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <FeedbackBanner message="Saved" tone="success" onDismiss={onDismiss} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();

    rerender(<FeedbackBanner message={null} tone="success" onDismiss={onDismiss} />);
    rerender(<FeedbackBanner message="Saved" tone="success" onDismiss={onDismiss} />);

    expect(screen.getByText("Saved")).toBeInTheDocument();
  });
});
