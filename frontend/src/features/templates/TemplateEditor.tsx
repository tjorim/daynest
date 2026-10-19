import { useId, useRef, useState, type RefObject } from "react";
import * as m from "@/paraglide/messages";
import { EditorDialog } from "@/components/ui/EditorDialog";
import { FeedbackBanner } from "@/components/common/FeedbackBanner";
import { apiErrorMessage } from "@/lib/api/errorMessages";
import { toIsoDate } from "@/lib/dateUtils";
import type { ChoreTemplate, RoutineTemplate, RoutineTemplateInput } from "@/lib/api/templates";

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
        <fieldset disabled={busy} className="d-grid gap-2">
          <label htmlFor={`${id}-name`} className="form-label mb-0">
            {routine
              ? m.templates_routine_name_placeholder()
              : m.templates_chore_name_placeholder()}
          </label>
          <input
            id={`${id}-name`}
            className="form-control"
            value={draft.name}
            onChange={(event) => field("name", event.target.value)}
          />
          <label htmlFor={`${id}-description`} className="form-label mb-0">
            {m.templates_description_placeholder()}
          </label>
          <textarea
            id={`${id}-description`}
            className="form-control"
            rows={3}
            value={draft.description}
            onChange={(event) => field("description", event.target.value)}
          />
          <div className="row g-2">
            <div className="col-sm-6">
              <label htmlFor={`${id}-date`} className="form-label">
                {m.templates_start_date_label()}
              </label>
              <input
                id={`${id}-date`}
                className="form-control"
                type="date"
                required
                value={draft.startDate}
                onChange={(event) => field("startDate", event.target.value)}
              />
            </div>
            <div className="col-sm-6">
              <label htmlFor={`${id}-days`} className="form-label">
                {m.templates_every_n_days_label()}
              </label>
              <input
                id={`${id}-days`}
                className="form-control"
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
              <label htmlFor={`${id}-time`} className="form-label">
                {m.templates_due_time_label()}
              </label>
              <input
                id={`${id}-time`}
                className="form-control"
                type="time"
                value={draft.dueTime}
                onChange={(event) => field("dueTime", event.target.value)}
              />
            </div>
          ) : null}
          <label className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              checked={draft.active}
              onChange={(event) => field("active", event.target.checked)}
            />
            <span className="form-check-label">{m.templates_active_label()}</span>
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
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
          </button>
        </fieldset>
      </form>
    </EditorDialog>
  );
}
