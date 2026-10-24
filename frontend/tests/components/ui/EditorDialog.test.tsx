// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { EditorDialog } from "@/components/ui/EditorDialog";

describe("EditorDialog pending dismissal", () => {
  it("blocks Escape, outside press and close controls until the save finishes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const returnFocus = createRef<HTMLButtonElement>();
    const editor = (busy: boolean) => (
      <EditorDialog
        title="Pending editor"
        dirty={false}
        busy={busy}
        returnFocus={returnFocus}
        onClose={onClose}
      >
        <input aria-label="Name" />
      </EditorDialog>
    );
    const { rerender } = render(editor(true));
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.click(screen.getByRole("textbox", { name: "Name" }));
    await user.keyboard("{Escape}");
    const backdrop = document.querySelector('[data-slot="editor-dialog-backdrop"]');
    expect(backdrop).not.toBeNull();
    await user.click(backdrop as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Pending editor" })).toBeVisible();
    rerender(editor(false));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
