import { Link, useParams } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";
import { formatDate } from "@/lib/dateUtils";
import type { PlannedTodayItem } from "@/lib/api/today";
import { isRetryableApiError } from "@/lib/api/today";
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

  const items = itemsQuery.data ?? [];
  const openItems = items.filter((item) => !item.is_done);
  const completedItems = items.filter((item) => item.is_done);
  const groups = groupItemsByTag(openItems);
  const queryError = listQuery.error ?? itemsQuery.error;
  const error = queryError instanceof Error ? queryError.message : null;
  const canRetry = queryError ? isRetryableApiError(queryError) : false;
  const loading = listQuery.isPending || itemsQuery.isPending;

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
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={loading}
          onClick={() => void Promise.all([listQuery.refetch(), itemsQuery.refetch()])}
        >
          {m.action_refresh()}
        </button>
      </div>
      {listQuery.data?.notes ? <p className="mb-3">{listQuery.data.notes}</p> : null}

      {loading ? <div className="alert alert-info py-2">{m.shopping_loading()}</div> : null}
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
      {actions.actionError ? (
        <div className="alert alert-danger py-2">{actions.actionError}</div>
      ) : null}

      <AddItemForm
        isSubmitting={actions.isSubmitting}
        onAddItem={(input) => actions.addItem(listId, input)}
      />

      {groups.length === 0 ? (
        <div className="alert alert-secondary py-2">{m.shopping_no_items()}</div>
      ) : null}
      <div className="d-flex flex-column gap-3">
        {groups.map(([tag, group]) => (
          <div className="card" key={tag}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <h3 className="h6 mb-0">{tag}</h3>
              <span className="badge text-bg-primary">{group.length}</span>
            </div>
            <div className="list-group list-group-flush">
              {group.map((item) => (
                <div
                  className="list-group-item d-flex align-items-start justify-content-between gap-3"
                  key={item.id}
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
