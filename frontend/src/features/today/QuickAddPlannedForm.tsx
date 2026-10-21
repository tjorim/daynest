import { useForm } from "@tanstack/react-form";
import * as m from "@/paraglide/messages";
import { dayjs, toIsoDate } from "@/lib/dateUtils";
import { useTodayActions } from "@/features/today/useTodayActions";

export function QuickAddPlannedForm({
  onRefresh,
  onClose,
}: {
  onRefresh: () => Promise<void>;
  onClose: () => void;
}) {
  const actions = useTodayActions(onRefresh);
  const todayDate = toIsoDate(dayjs());

  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: async ({ value, formApi }) => {
      if (!value.title.trim()) return;
      try {
        await actions.createPlannedItem(value.title.trim(), todayDate);
        formApi.reset();
        onClose();
      } catch {
        // handled by hook state
      }
    },
  });

  return (
    <form
      className="d-flex gap-2 align-items-start flex-wrap"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field
        name="title"
        children={(field) => (
          <>
            <input
              className="form-control form-control-sm flex-grow-1"
              style={{ minWidth: "12rem" }}
              value={field.value}
              autoFocus
              placeholder={m.today_quick_add_placeholder()}
              disabled={actions.isSubmitting}
              onChange={(event) => {
                field.handleChange(event.target.value);
                actions.clearActionError();
              }}
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={actions.isSubmitting || !field.value.trim()}
            >
              {actions.isSubmitting ? m.action_adding() : m.action_add()}
            </button>
          </>
        )}
      />
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        disabled={actions.isSubmitting}
        onClick={() => {
          onClose();
          form.reset();
          actions.clearActionError();
        }}
      >
        {m.action_cancel()}
      </button>
      {actions.actionError ? (
        <small className="w-100 text-danger">{actions.actionError}</small>
      ) : null}
    </form>
  );
}
