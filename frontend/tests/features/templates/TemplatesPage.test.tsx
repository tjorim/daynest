import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw/http";
import { server } from "@/mocks/server";
import { TemplatesPage } from "@/features/templates/TemplatesPage";

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <TemplatesPage />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

for (const kind of ["routine", "chore"] as const) {
  const existing = kind === "routine" ? "Morning routine" : "Water plants";
  const id = kind === "routine" ? 20 : 30;
  describe(`${kind} editor`, () => {
    for (const editing of [false, true]) {
      it(`${editing ? "updates the selected record" : "creates a new record"} and refreshes the list`, async () => {
        const user = setup();
        await screen.findByText(existing);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        const trigger = editing
          ? within(screen.getByText(existing).closest("li")!).getByRole("button", { name: "Edit" })
          : screen.getByRole("button", { name: `New ${kind}` });
        const request = vi.fn();
        server.use(
          http[editing ? "put" : "post"](
            `/api/templates/${kind}s${editing ? `/${id}` : ""}`,
            async ({ request: req }) => {
              request(await req.clone().json());
              return undefined; // Fall through to the stateful mock handler.
            },
          ),
        );
        await user.click(trigger);
        const dialog = await screen.findByRole("dialog", {
          name: `${editing ? "Edit" : "New"} ${kind}`,
        });
        const name = within(dialog).getByLabelText(
          `${kind === "routine" ? "Routine" : "Chore"} name`,
        );
        expect(name).toHaveValue(editing ? existing : "");
        await user.clear(name);
        await user.type(name, "Updated template");
        await user.clear(within(dialog).getByLabelText("Every N days"));
        await user.type(within(dialog).getByLabelText("Every N days"), "3");
        await user.click(
          within(dialog).getByRole("button", { name: `${editing ? "Save" : "Create"} ${kind}` }),
        );
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(await screen.findByText("Updated template")).toBeVisible();
        expect(request).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ name: "Updated template", every_n_days: 3, is_active: true }),
        );
        expect(request.mock.calls[0]?.[0]).toEqual(
          expect.objectContaining(
            kind === "routine" ? { due_time: editing ? "09:00:00" : "08:00:00" } : {},
          ),
        );
        if (kind === "chore") expect(request.mock.calls[0]?.[0]).not.toHaveProperty("due_time");
      });
    }

    it("keeps failed drafts, validates names, and blocks duplicate saves and dismissal while pending", async () => {
      const user = setup();
      await screen.findByText(existing);
      await user.click(screen.getByRole("button", { name: `New ${kind}` }));
      const dialog = screen.getByRole("dialog");
      const submit = within(dialog).getByRole("button", { name: `Create ${kind}` });
      await user.click(submit);
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("name is required");
      await user.type(
        within(dialog).getByLabelText(`${kind === "routine" ? "Routine" : "Chore"} name`),
        "Draft",
      );
      let finish!: () => void;
      const pending = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const request = vi.fn();
      server.use(
        http.post(`/api/templates/${kind}s`, async () => {
          request();
          await pending;
          return HttpResponse.json({ detail: "Save rejected" }, { status: 400 });
        }),
      );
      await user.dblClick(submit);
      await waitFor(() => expect(request).toHaveBeenCalledOnce());
      expect(submit).toBeDisabled();
      expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
      expect(within(dialog).getByRole("button", { name: "Close" })).toBeDisabled();
      await user.keyboard("{Escape}");
      expect(screen.getByRole("dialog")).toBeVisible();
      finish();
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        `Failed to save ${kind} template.`,
      );
      expect(
        within(dialog).getByLabelText(`${kind === "routine" ? "Routine" : "Chore"} name`),
      ).toHaveValue("Draft");
      expect(submit).toBeEnabled();
    });

    for (const dismissal of ["Cancel", "Close", "Escape"]) {
      it(`protects dirty edits on ${dismissal} and resets on reopening`, async () => {
        const user = setup();
        await screen.findByText(existing);
        const trigger = within(screen.getByText(existing).closest("li")!).getByRole("button", {
          name: "Edit",
        });
        await user.click(trigger);
        const dialog = screen.getByRole("dialog");
        const name = within(dialog).getByLabelText(
          `${kind === "routine" ? "Routine" : "Chore"} name`,
        );
        await user.type(name, " changed");
        if (dismissal === "Escape") await user.keyboard("{Escape}");
        else await user.click(within(dialog).getByRole("button", { name: dismissal }));
        const confirm = await screen.findByRole("dialog", { name: "Discard unsaved changes?" });
        await user.click(within(confirm).getByRole("button", { name: "Continue editing" }));
        expect(name).toHaveValue(`${existing} changed`);
        await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
        await user.click(screen.getByRole("button", { name: "Discard changes" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        await user.click(trigger);
        expect(
          screen.getByLabelText(`${kind === "routine" ? "Routine" : "Chore"} name`),
        ).toHaveValue(existing);
        await user.click(screen.getByRole("button", { name: "Cancel" }));
        await user.click(screen.getByRole("button", { name: `New ${kind}` }));
        expect(
          screen.getByLabelText(`${kind === "routine" ? "Routine" : "Chore"} name`),
        ).toHaveValue("");
      });
    }
  });
}
