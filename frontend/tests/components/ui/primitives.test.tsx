// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

describe("Button", () => {
  it("is a native button that runs onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not run onClick while disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies the variant and lets a caller class replace a conflicting one", () => {
    render(
      <Button variant="outline-danger" size="sm" className="tw:px-6">
        Delete
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveAttribute("data-variant", "outline-danger");
    expect(button).toHaveClass("tw:border-danger", "tw:px-6");
    expect(button).not.toHaveClass("tw:px-2");
  });

  it("exposes the same classes for non-button elements", () => {
    expect(buttonVariants({ variant: "primary" })).toContain("tw:bg-primary");
  });
});

describe("Alert", () => {
  it("keeps the role and children and uses the variant colours", () => {
    render(
      <Alert variant="danger" role="alert">
        Something failed
      </Alert>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Something failed");
    expect(screen.getByRole("alert")).toHaveClass("tw:bg-danger-subtle");
  });
});

describe("Spinner", () => {
  it("is hidden from assistive technology", () => {
    const { container } = render(<Spinner />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});

describe("cn", () => {
  it("keeps a custom font size next to a text colour", async () => {
    const { cn } = await import("@/lib/utils");

    expect(cn("tw:text-h6", "tw:text-muted-foreground")).toBe(
      "tw:text-h6 tw:text-muted-foreground",
    );
    expect(cn("tw:text-h5", "tw:text-h4")).toBe("tw:text-h4");
  });
});
