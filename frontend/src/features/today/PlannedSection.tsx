import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import * as m from "@/paraglide/messages";
import { dayjs, toIsoDate } from "@/lib/dateUtils";
import { type PlannedTodayItem } from "@/lib/api/today";
import { SectionCard, buildPlannedItems, type BulkAction } from "@/features/today/TodaySections";
import { useTodayActions } from "@/features/today/useTodayActions";

function QuickAddPlanned({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const actions = useTodayActions(onRefresh);
  const todayDate = toIsoDate(dayjs());

  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: async ({ value, formApi }) => {
      if (!value.title.trim()) return;
      try {
        await actions.createPlannedItem(value.title.trim(), todayDate);
        formApi.reset();
        setIsOpen(false);
      } catch {
        // handled by hook state
      }
    },
  });

  if (!isOpen) {
    return (
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={() => setIsOpen(true)}
      >
        {m.today_quick_add()}
      </button>
    );
  }

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
          setIsOpen(false);
          form.reset();
          actions.clearActionError();
        }}
      >
        {m.action_cancel()}
      </button>
      {actions.actionError ? <small className="w-100 text-danger">{actions.actionError}</small> : null}
    </form>
  );
}

export function PlannedSection({
  items,
  onRefresh,
  bulkActions,
}: {
  items: PlannedTodayItem[];
  onRefresh: () => Promise<void>;
  bulkActions?: BulkAction[];
}) {
  return (
    <>
      <QuickAddPlanned onRefresh={onRefresh} />
      <SectionCard
        sectionId="planned"
        heading={m.today_section_planned()}
        items={buildPlannedItems(items)}
        onRefresh={onRefresh}
        bulkActions={bulkActions}
      />
    </>
  );
}
