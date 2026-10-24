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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-2">
        <h2 className="text-h4 font-medium mb-0">{m.shopping_title()}</h2>
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
            disabled={listsQuery.isPending}
            onClick={() => void listsQuery.refetch()}
          >
            {m.action_refresh()}
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground mb-4">{m.shopping_subtitle()}</p>

      {listsQuery.isPending ? (
        <Alert variant="info" className="py-2">
          {m.shopping_loading()}
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="danger" className="py-2 flex justify-between items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <Button variant="danger" size="sm" onClick={() => void listsQuery.refetch()}>
              {m.action_retry()}
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {actions.actionError ? (
        <Alert variant="danger" className="py-2">
          {actions.actionError}
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert variant="success" className="py-2">
          {successMessage}
        </Alert>
      ) : null}

      <Card className="mb-4">
        <CardContent>
          <h3 className="text-h6 font-medium mb-4">{m.shopping_create_list()}</h3>
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-12 md:col-span-4">
              <Label htmlFor="shopping-list-name">{m.shopping_list_name()}</Label>
              <Input
                id="shopping-list-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={m.shopping_list_name_placeholder()}
              />
            </div>
            <div className="col-span-12 md:col-span-3">
              <Label htmlFor="shopping-list-store">{m.shopping_store()}</Label>
              <Input
                id="shopping-list-store"
                value={store}
                onChange={(event) => setStore(event.target.value)}
                placeholder={m.shopping_store_placeholder()}
              />
            </div>
            <div className="col-span-12 md:col-span-3">
              <Label htmlFor="shopping-list-notes">{m.today_notes_optional()}</Label>
              <Input
                id="shopping-list-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            <div className="col-span-12 md:col-span-2">
              <Button
                className="w-full"
                disabled={actions.isSubmitting || !name.trim()}
                onClick={() => void createList()}
              >
                {actions.isSubmitting ? m.action_creating() : m.action_add()}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 mb-4" role="group" aria-label={m.shopping_tabs_label()}>
        <Button
          size="sm"
          aria-pressed={tab === "active"}
          variant={tab === "active" ? "primary" : "outline-primary"}
          onClick={() => setTab("active")}
        >
          {m.status_active()}
        </Button>
        <Button
          size="sm"
          aria-pressed={tab === "archived"}
          variant={tab === "archived" ? "primary" : "outline-primary"}
          onClick={() => setTab("archived")}
        >
          {m.shopping_archived()}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {lists.map((list) => (
          <div className="col-span-12 md:col-span-6 xl:col-span-4" key={list.id}>
            <Card className="h-full">
              <CardContent className="flex flex-col gap-2">
                <div>
                  <div className="flex justify-between gap-2">
                    <h3 className="text-h5 font-medium mb-1">{list.name}</h3>
                    <Badge variant="secondary" className="self-start">
                      {list.status}
                    </Badge>
                  </div>
                  {list.store ? (
                    <div className="text-muted-foreground text-small">{list.store}</div>
                  ) : null}
                  {list.notes ? <p className="mb-0 text-small">{list.notes}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2 mt-auto">
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
          <div className="col-span-12">
            <Alert variant="secondary" className="py-2">
              {m.shopping_no_lists()}
            </Alert>
          </div>
        ) : null}
      </div>
    </section>
  );
}
