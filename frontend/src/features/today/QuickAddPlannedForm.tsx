import { useForm } from "@tanstack/react-form";
import * as m from "@/paraglide/messages";
import { dayjs, toIsoDate } from "@/lib/dateUtils";
import { useTodayActions } from "@/features/today/useTodayActions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
      className="tw:flex tw:gap-2 tw:items-start tw:flex-wrap"
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
            <Input
              size="sm"
              className="tw:grow tw:min-w-48"
              value={field.value}
              autoFocus
              placeholder={m.today_quick_add_placeholder()}
              disabled={actions.isSubmitting}
              onChange={(event) => {
                field.handleChange(event.target.value);
                actions.clearActionError();
              }}
            />
            <Button size="sm" type="submit" disabled={actions.isSubmitting || !field.value.trim()}>
              {actions.isSubmitting ? m.action_adding() : m.action_add()}
            </Button>
          </>
        )}
      />
      <Button
        variant="outline-secondary"
        size="sm"
        disabled={actions.isSubmitting}
        onClick={() => {
          onClose();
          form.reset();
          actions.clearActionError();
        }}
      >
        {m.action_cancel()}
      </Button>
      {actions.actionError ? (
        <small className="tw:w-full tw:text-danger">{actions.actionError}</small>
      ) : null}
    </form>
  );
}
