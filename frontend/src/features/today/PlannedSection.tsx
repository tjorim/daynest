import { lazy, Suspense, useEffect, useState } from "react";
import * as m from "@/paraglide/messages";
import { type PlannedTodayItem } from "@/lib/api/today";
import { SectionCard, buildPlannedItems, type BulkAction } from "@/features/today/TodaySections";

// The form library is only needed once "quick add" is pressed. It loads after
// the page settles rather than on click, so the service worker has cached it
// for offline use, where quick add goes through the offline queue.
const loadQuickAddPlannedForm = () => import("@/features/today/QuickAddPlannedForm");
const QuickAddPlannedForm = lazy(() =>
  loadQuickAddPlannedForm().then((module) => ({ default: module.QuickAddPlannedForm })),
);

function QuickAddPlanned({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadQuickAddPlannedForm().catch(() => {}), 2000);
    return () => window.clearTimeout(timer);
  }, []);

  const openButton = (
    <button
      type="button"
      className="btn btn-outline-secondary btn-sm"
      disabled={isOpen}
      onClick={() => setIsOpen(true)}
    >
      {m.today_quick_add()}
    </button>
  );

  if (!isOpen) return openButton;

  return (
    <Suspense fallback={openButton}>
      <QuickAddPlannedForm onRefresh={onRefresh} onClose={() => setIsOpen(false)} />
    </Suspense>
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
