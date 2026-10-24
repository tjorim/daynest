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
import { apiErrorMessage } from "@/lib/api/errorMessages";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListGroup, ListGroupItem } from "@/components/ui/list-group";

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
  const { listId } = useParams({ from: "/protected/shopping/$listId" });
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
  const error = queryError ? apiErrorMessage(queryError, m.api_shopping_list_load_failed()) : null;
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
      <div className="mb-4">
        <Link className={buttonVariants({ variant: "link", className: "px-0" })} to="/shopping">
          ← {m.shopping_back_to_lists()}
        </Link>
      </div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-2">
        <div>
          <h2 className="text-h4 font-medium mb-1">{listQuery.data?.name ?? m.shopping_title()}</h2>
          <p className="text-muted-foreground mb-0">
            {listQuery.data?.store ? `${listQuery.data.store} · ` : ""}
            {m.shopping_item_count({ count: openItems.length })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className={buttonVariants({ variant: "outline-primary", size: "sm" })}
            to="/shopping/recurring"
          >
            {m.recurring_groceries_manage()}
          </Link>
          <Button
            variant="outline-primary"
            size="sm"
            disabled={loading || actions.isSubmitting}
            onClick={() => void importRecurring()}
          >
            {m.shopping_import_recurring()}
          </Button>
          <Button
            variant="outline-primary"
            size="sm"
            disabled={loading}
            onClick={() => {
              setSuccessMessage(null);
              void Promise.all([listQuery.refetch(), itemsQuery.refetch()]);
            }}
          >
            {m.action_refresh()}
          </Button>
        </div>
      </div>
      {listQuery.data?.notes ? <p className="mb-4">{listQuery.data.notes}</p> : null}

      <FeedbackBanner message={loading ? m.shopping_loading() : null} tone="info" />
      {error ? (
        <Alert variant="danger" className="py-2 flex justify-between items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => void Promise.all([listQuery.refetch(), itemsQuery.refetch()])}
            >
              {m.action_retry()}
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <FeedbackBanner message={actions.actionError} tone="danger" />
      <FeedbackBanner
        message={successMessage}
        tone="success"
        onDismiss={() => setSuccessMessage(null)}
      />

      <AddItemForm
        isSubmitting={actions.isSubmitting}
        onAddItem={(input) => actions.addItem(listId, input)}
      />

      {groups.length === 0 ? (
        <FeedbackBanner message={m.shopping_no_items()} tone="secondary" />
      ) : null}
      <div className="flex flex-col gap-4">
        {groups.map(([tag, group]) => (
          <Card key={tag}>
            <CardHeader className="flex justify-between items-center">
              <h3 className="text-h6 font-medium mb-0">{tag}</h3>
              <Badge variant="primary">{group.length}</Badge>
            </CardHeader>
            <ListGroup flush role="list" aria-label={tag}>
              {group.map((item) => (
                <ListGroupItem
                  className="flex items-start justify-between gap-4"
                  key={item.id}
                  role="listitem"
                >
                  <div>
                    <div className="font-semibold">{item.title}</div>
                    <div className="text-muted-foreground text-small">
                      {m.shopping_planned_for_date({ date: formatDate(item.planned_for) })}
                    </div>
                    {item.notes ? <div className="text-small">{item.notes}</div> : null}
                  </div>
                  <Button
                    variant="success"
                    size="sm"
                    disabled={actions.isSubmitting}
                    onClick={() => void actions.checkOffItem(item)}
                  >
                    {m.shopping_check_off()}
                  </Button>
                </ListGroupItem>
              ))}
            </ListGroup>
          </Card>
        ))}
      </div>

      {completedItems.length > 0 ? (
        <details className="mt-4">
          <summary className="text-muted-foreground">
            {m.shopping_completed_items({ count: completedItems.length })}
          </summary>
          <ListGroup render={<ul />} className="mt-2">
            {completedItems.map((item) => (
              <ListGroupItem
                render={<li />}
                className="text-muted-foreground line-through"
                key={item.id}
              >
                {item.title}
              </ListGroupItem>
            ))}
          </ListGroup>
        </details>
      ) : null}
    </section>
  );
}
