import { useId, useRef, useState, type RefObject } from "react";
import * as m from "@/paraglide/messages";
import { EditorDialog } from "@/components/ui/EditorDialog";
import { FeedbackBanner } from "@/components/common/FeedbackBanner";
import { apiErrorMessage } from "@/lib/api/errorMessages";
import { toIsoDate } from "@/lib/dateUtils";
import type { ChoreTemplate, RoutineTemplate, RoutineTemplateInput } from "@/lib/api/templates";
import { Label } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export type TemplateEditorState =
  | { kind: "routine"; template?: RoutineTemplate }
  | { kind: "chore"; template?: ChoreTemplate };

export function TemplateEditor({
  editor,
  returnFocus,
  onSave,
  onClose,
}: {
  editor: TemplateEditorState;
  returnFocus: RefObject<HTMLElement | null>;
  onSave: (input: RoutineTemplateInput) => Promise<void>;
  onClose: () => void;
}) {
  const id = useId();
  const routine = editor.kind === "routine";
  const editing = !!editor.template;
  const [initial] = useState(() => ({
    name: editor.template?.name ?? "",
    description: editor.template?.description ?? "",
    startDate: editor.template?.start_date ?? toIsoDate(new Date()),
    everyNDays: String(editor.template?.every_n_days ?? (routine ? 1 : 7)),
    dueTime:
      editor.kind === "routine"
        ? (editor.template?.due_time?.slice(0, 5) ?? (editing ? "" : "08:00"))
        : "",
    active: editor.template?.is_active ?? true,
  }));
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const field = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const title = routine
    ? editing
      ? m.templates_edit_routine()
      : m.templates_new_routine()
    : editing
      ? m.templates_edit_chore()
      : m.templates_new_chore();
  const submit = async () => {
    if (submitting.current) return;
    if (!draft.name.trim()) {
      setError(routine ? m.templates_routine_name_required() : m.templates_chore_name_required());
      return;
    }
    const everyNDays = Number(draft.everyNDays);
    if (!Number.isInteger(everyNDays) || everyNDays < 1) {
      setError(m.templates_every_n_error());
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        start_date: draft.startDate,
        every_n_days: everyNDays,
        ...(routine ? { due_time: draft.dueTime ? `${draft.dueTime}:00` : null } : {}),
        is_active: draft.active,
      });
      onClose();
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          routine ? m.templates_routine_save_failed() : m.templates_chore_save_failed(),
        ),
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <EditorDialog
      title={title}
      dirty={JSON.stringify(draft) !== JSON.stringify(initial)}
      busy={busy}
      returnFocus={returnFocus}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        aria-busy={busy}
      >
        <FeedbackBanner message={error} tone="danger" />
        <fieldset disabled={busy} className="grid gap-2">
          <Label className="mb-0" htmlFor={`${id}-name`}>
            {routine
              ? m.templates_routine_name_placeholder()
              : m.templates_chore_name_placeholder()}
          </Label>
          <Input
            id={`${id}-name`}
            value={draft.name}
            onChange={(event) => field("name", event.target.value)}
          />
          <Label className="mb-0" htmlFor={`${id}-description`}>
            {m.templates_description_placeholder()}
          </Label>
          <Textarea
            id={`${id}-description`}
            rows={3}
            value={draft.description}
            onChange={(event) => field("description", event.target.value)}
          />
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-12 sm:col-span-6">
              <Label htmlFor={`${id}-date`}>{m.templates_start_date_label()}</Label>
              <Input
                id={`${id}-date`}
                type="date"
                required
                value={draft.startDate}
                onChange={(event) => field("startDate", event.target.value)}
              />
            </div>
            <div className="col-span-12 sm:col-span-6">
              <Label htmlFor={`${id}-days`}>{m.templates_every_n_days_label()}</Label>
              <Input
                id={`${id}-days`}
                type="number"
                min={1}
                step={1}
                required
                value={draft.everyNDays}
                onChange={(event) => field("everyNDays", event.target.value)}
              />
            </div>
          </div>
          {routine ? (
            <div>
              <Label htmlFor={`${id}-time`}>{m.templates_due_time_label()}</Label>
              <Input
                id={`${id}-time`}
                type="time"
                value={draft.dueTime}
                onChange={(event) => field("dueTime", event.target.value)}
              />
            </div>
          ) : null}
          <label className="flex items-start gap-2 min-h-6 mb-0.5">
            <Checkbox
              checked={draft.active}
              onChange={(event) => field("active", event.target.checked)}
            />
            <span>{m.templates_active_label()}</span>
          </label>
          <Button type="submit" disabled={busy}>
            {busy
              ? editing
                ? m.action_saving()
                : m.action_creating()
              : routine
                ? editing
                  ? m.templates_save_routine()
                  : m.templates_create_routine()
                : editing
                  ? m.templates_save_chore()
                  : m.templates_create_chore()}
          </Button>
        </fieldset>
      </form>
    </EditorDialog>
  );
}
