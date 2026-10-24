import { Link } from "@tanstack/react-router";
import { useState } from "react";
import * as m from "@/paraglide/messages";
import { isRetryableApiError } from "@/lib/api/http";
import { useShoppingActions } from "@/features/shopping/useShoppingActions";
import { useShoppingListsQuery } from "@/features/shopping/useShoppingLists";
import { apiErrorMessage } from "@/lib/api/errorMessages";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function ShoppingListsPage() {
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [name, setName] = useState("");
  const [store, setStore] = useState("");
  const [notes, setNotes] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const listsQuery = useShoppingListsQuery("all");
  const actions = useShoppingActions(async () => {
    await listsQuery.refetch();
  });

  const lists = (listsQuery.data ?? []).filter((list) => list.status === tab);
  const error = listsQuery.error
    ? apiErrorMessage(listsQuery.error, m.api_shopping_lists_load_failed())
    : null;
  const canRetry = listsQuery.error ? isRetryableApiError(listsQuery.error) : false;

  const createList = async () => {
    if (!name.trim()) return;
    setSuccessMessage(null);
    try {
      await actions.createList({
        name: name.trim(),
        store: store.trim() || null,
        notes: notes.trim() || null,
      });
      setName("");
      setStore("");
      setNotes("");
      setSuccessMessage(m.shopping_list_created());
    } catch {
      // Error is handled and displayed via actions.actionError
    }
  };

  return (
    <section>
      <div className="tw:flex tw:flex-col tw:md:flex-row tw:justify-between tw:items-start tw:md:items-center tw:gap-2 tw:mb-2">
        <h2 className="tw:text-h4 tw:font-medium tw:mb-0">{m.shopping_title()}</h2>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <Link
            className={buttonVariants({ variant: "outline-primary", size: "sm" })}
            to="/shopping/recurring"
          >
            {m.recurring_groceries_manage()}
          </Link>
          <Button
            variant="outline-primary"
            size="sm"
            disabled={listsQuery.isPending}
            onClick={() => void listsQuery.refetch()}
          >
            {m.action_refresh()}
          </Button>
        </div>
      </div>
      <p className="tw:text-muted-foreground tw:mb-4">{m.shopping_subtitle()}</p>

      {listsQuery.isPending ? (
        <Alert variant="info" className="tw:py-2">
          {m.shopping_loading()}
        </Alert>
      ) : null}
      {error ? (
        <Alert
          variant="danger"
          className="tw:py-2 tw:flex tw:justify-between tw:items-center tw:gap-2 tw:flex-wrap"
        >
          <span>{error}</span>
          {canRetry ? (
            <Button variant="danger" size="sm" onClick={() => void listsQuery.refetch()}>
              {m.action_retry()}
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {actions.actionError ? (
        <Alert variant="danger" className="tw:py-2">
          {actions.actionError}
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert variant="success" className="tw:py-2">
          {successMessage}
        </Alert>
      ) : null}

      <Card className="tw:mb-4">
        <CardContent>
          <h3 className="tw:text-h6 tw:font-medium tw:mb-4">{m.shopping_create_list()}</h3>
          <div className="tw:grid tw:grid-cols-12 tw:gap-2 tw:items-end">
            <div className="tw:col-span-12 tw:md:col-span-4">
              <Label htmlFor="shopping-list-name">{m.shopping_list_name()}</Label>
              <Input
                id="shopping-list-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={m.shopping_list_name_placeholder()}
              />
            </div>
            <div className="tw:col-span-12 tw:md:col-span-3">
              <Label htmlFor="shopping-list-store">{m.shopping_store()}</Label>
              <Input
                id="shopping-list-store"
                value={store}
                onChange={(event) => setStore(event.target.value)}
                placeholder={m.shopping_store_placeholder()}
              />
            </div>
            <div className="tw:col-span-12 tw:md:col-span-3">
              <Label htmlFor="shopping-list-notes">{m.today_notes_optional()}</Label>
              <Input
                id="shopping-list-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            <div className="tw:col-span-12 tw:md:col-span-2">
              <Button
                className="tw:w-full"
                disabled={actions.isSubmitting || !name.trim()}
                onClick={() => void createList()}
              >
                {actions.isSubmitting ? m.action_creating() : m.action_add()}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="tw:flex tw:gap-2 tw:mb-4" role="tablist" aria-label={m.shopping_tabs_label()}>
        <Button
          size="sm"
          variant={tab === "active" ? "primary" : "outline-primary"}
          onClick={() => setTab("active")}
        >
          {m.status_active()}
        </Button>
        <Button
          size="sm"
          variant={tab === "archived" ? "primary" : "outline-primary"}
          onClick={() => setTab("archived")}
        >
          {m.shopping_archived()}
        </Button>
      </div>

      <div className="tw:grid tw:grid-cols-12 tw:gap-4">
        {lists.map((list) => (
          <div className="tw:col-span-12 tw:md:col-span-6 tw:xl:col-span-4" key={list.id}>
            <Card className="tw:h-full">
              <CardContent className="tw:flex tw:flex-col tw:gap-2">
                <div>
                  <div className="tw:flex tw:justify-between tw:gap-2">
                    <h3 className="tw:text-h5 tw:font-medium tw:mb-1">{list.name}</h3>
                    <Badge variant="secondary" className="tw:self-start">
                      {list.status}
                    </Badge>
                  </div>
                  {list.store ? (
                    <div className="tw:text-muted-foreground tw:text-small">{list.store}</div>
                  ) : null}
                  {list.notes ? <p className="tw:mb-0 tw:text-small">{list.notes}</p> : null}
                </div>
                <div className="tw:flex tw:flex-wrap tw:gap-2 tw:mt-auto">
                  <Link
                    className={buttonVariants({ variant: "outline-primary", size: "sm" })}
                    to="/shopping/$listId"
                    params={{ listId: list.id }}
                  >
                    {m.shopping_open_list()}
                  </Link>
                  {list.status === "active" ? (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      disabled={actions.isSubmitting}
                      onClick={() => void actions.archiveList(list.id)}
                    >
                      {m.shopping_archive()}
                    </Button>
                  ) : null}
                  <Button
                    variant="outline-danger"
                    size="sm"
                    disabled={actions.isSubmitting}
                    onClick={() => void actions.deleteList(list.id)}
                  >
                    {m.action_delete()}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
        {!listsQuery.isPending && lists.length === 0 ? (
          <div className="tw:col-span-12">
            <Alert variant="secondary" className="tw:py-2">
              {m.shopping_no_lists()}
            </Alert>
          </div>
        ) : null}
      </div>
    </section>
  );
}
