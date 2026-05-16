import { useState } from "react";
import type { FormEvent } from "react";
import { dayjs, toIsoDate } from "@/lib/dateUtils";
import { type PlannedTodayItem } from "@/lib/api/today";
import { SectionCard, buildPlannedItems, type BulkAction } from "@/features/today/TodaySections";
import { useTodayActions } from "@/features/today/useTodayActions";

function QuickAddPlanned({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const actions = useTodayActions(onRefresh);
  const todayDate = toIsoDate(dayjs());

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      await actions.createPlannedItem(title.trim(), todayDate);
      setTitle("");
      setIsOpen(false);
    } catch {
      // handled by hook state
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        onClick={() => setIsOpen(true)}
      >
        + Quick add
      </button>
    );
  }

  return (
    <form className="d-flex gap-2 align-items-start flex-wrap" onSubmit={(e) => void onSubmit(e)}>
      <input
        className="form-control form-control-sm flex-grow-1"
        style={{ minWidth: "12rem" }}
        value={title}
        autoFocus
        placeholder="Plan title for today…"
        disabled={actions.isSubmitting}
        onChange={(event) => {
          setTitle(event.target.value);
          actions.clearActionError();
        }}
      />
      <button
        type="submit"
        className="btn btn-primary btn-sm"
        disabled={actions.isSubmitting || !title.trim()}
      >
        {actions.isSubmitting ? "Adding…" : "Add"}
      </button>
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        disabled={actions.isSubmitting}
        onClick={() => {
          setIsOpen(false);
          setTitle("");
          actions.clearActionError();
        }}
      >
        Cancel
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
        heading="Planned"
        items={buildPlannedItems(items)}
        onRefresh={onRefresh}
        bulkActions={bulkActions}
      />
    </>
  );
}

