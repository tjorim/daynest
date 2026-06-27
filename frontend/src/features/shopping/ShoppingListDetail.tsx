import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import * as m from "@/paraglide/messages";
import { FeedbackBanner } from "@/components/common/FeedbackBanner";
import { formatDate } from "@/lib/dateUtils";
import type { PlannedTodayItem } from "@/lib/api/today";
import { isRetryableApiError } from "@/lib/api/http";
import { AddItemForm } from "@/features/shopping/AddItemForm";
import { useShoppingActions } from "@/features/shopping/useShoppingActions";
import { useShoppingItemsQuery, useShoppingListQuery } from "@/features/shopping/useShoppingLists";

function groupItemsByTag(items: PlannedTodayItem[]) {
  const groups = new Map<string, PlannedTodayItem[]>();
  for (const item of items) {
    const tag = item.tags?.[0]?.trim() || m.shopping_uncategorized();
    let list = groups.get(tag);
    if (!list) {
      list = [];
      groups.set(tag, list);
    }
    list.push(item);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function ShoppingListDetail() {
  const params = useParams({ from: "/protected/shopping/$listId" });
  const listId = Number(params.listId);
  const listQuery = useShoppingListQuery(listId);
  const itemsQuery = useShoppingItemsQuery(listId);
  const actions = useShoppingActions(async () => {
    await Promise.all([listQuery.refetch(), itemsQuery.refetch()]);
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const items = itemsQuery.data ?? [];
  const openItems = items.filter((item) => !item.is_done);
  const completedItems = items.filter((item) => item.is_done);
  const groups = groupItemsByTag(openItems);
  const queryError = listQuery.error ?? itemsQuery.error;
  const error = queryError instanceof Error ? queryError.message : null;
  const canRetry = queryError ? isRetryableApiError(queryError) : false;
  const loading = listQuery.isPending || itemsQuery.isPending;

  const importRecurring = async () => {
    setSuccessMessage(null);
    try {
      await actions.importRecurring(listId);
      setSuccessMessage(m.shopping_imported_recurring());
    } catch {
      // Error is handled and displayed via actions.actionError.
    }
  };

  return (
    <section>
      <div className="mb-3">
        <Link to="/shopping" className="btn btn-link px-0">
          ← {m.shopping_back_to_lists()}
        </Link>
      </div>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-2">
        <div>
          <h2 className="h4 mb-1">{listQuery.data?.name ?? m.shopping_title()}</h2>
          <p className="text-muted mb-0">
            {listQuery.data?.store ? `${listQuery.data.store} · ` : ""}
            {m.shopping_item_count({ count: openItems.length })}
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/shopping/recurring" className="btn btn-outline-primary btn-sm">
            {m.recurring_groceries_manage()}
          </Link>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            disabled={loading || actions.isSubmitting}
            onClick={() => void importRecurring()}
          >
            {m.shopping_import_recurring()}
          </button>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            disabled={loading}
            onClick={() => {
              setSuccessMessage(null);
              void Promise.all([listQuery.refetch(), itemsQuery.refetch()]);
            }}
          >
            {m.action_refresh()}
          </button>
        </div>
      </div>
      {listQuery.data?.notes ? <p className="mb-3">{listQuery.data.notes}</p> : null}

      <FeedbackBanner message={loading ? m.shopping_loading() : null} tone="info" />
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => void Promise.all([listQuery.refetch(), itemsQuery.refetch()])}
            >
              {m.action_retry()}
            </button>
          ) : null}
        </div>
      ) : null}
      <FeedbackBanner message={actions.actionError} tone="danger" />
      <FeedbackBanner message={successMessage} tone="success" onDismiss={() => setSuccessMessage(null)} />

      <AddItemForm
        isSubmitting={actions.isSubmitting}
        onAddItem={(input) => actions.addItem(listId, input)}
      />

      {groups.length === 0 ? (
        <FeedbackBanner message={m.shopping_no_items()} tone="secondary" />
      ) : null}
      <div className="d-flex flex-column gap-3">
        {groups.map(([tag, group]) => (
          <div className="card" key={tag}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <h3 className="h6 mb-0">{tag}</h3>
              <span className="badge text-bg-primary">{group.length}</span>
            </div>
            <div className="list-group list-group-flush" role="list" aria-label={tag}>
              {group.map((item) => (
                <div
                  className="list-group-item d-flex align-items-start justify-content-between gap-3"
                  key={item.id}
                  role="listitem"
                >
                  <div>
                    <div className="fw-semibold">{item.title}</div>
                    <div className="text-muted small">
                      {m.shopping_planned_for_date({ date: formatDate(item.planned_for) })}
                    </div>
                    {item.notes ? <div className="small">{item.notes}</div> : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    disabled={actions.isSubmitting}
                    onClick={() => void actions.checkOffItem(item)}
                  >
                    {m.shopping_check_off()}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {completedItems.length > 0 ? (
        <details className="mt-3">
          <summary className="text-muted">
            {m.shopping_completed_items({ count: completedItems.length })}
          </summary>
          <ul className="list-group mt-2">
            {completedItems.map((item) => (
              <li className="list-group-item text-muted text-decoration-line-through" key={item.id}>
                {item.title}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
