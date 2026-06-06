import { Link } from "@tanstack/react-router";
import { useState } from "react";
import * as m from "@/paraglide/messages";
import { isRetryableApiError } from "@/lib/api/today";
import { useShoppingActions } from "@/features/shopping/useShoppingActions";
import { useShoppingListsQuery } from "@/features/shopping/useShoppingLists";

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
  const error = listsQuery.error instanceof Error ? listsQuery.error.message : null;
  const canRetry = listsQuery.error ? isRetryableApiError(listsQuery.error) : false;

  const createList = async () => {
    if (!name.trim()) return;
    setSuccessMessage(null);
    await actions.createList({
      name: name.trim(),
      store: store.trim() || null,
      notes: notes.trim() || null,
    });
    setName("");
    setStore("");
    setNotes("");
    setSuccessMessage(m.shopping_list_created());
  };

  return (
    <section>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-2">
        <h2 className="h4 mb-0">{m.shopping_title()}</h2>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={listsQuery.isPending}
          onClick={() => void listsQuery.refetch()}
        >
          {m.action_refresh()}
        </button>
      </div>
      <p className="text-muted mb-3">{m.shopping_subtitle()}</p>

      {listsQuery.isPending ? (
        <div className="alert alert-info py-2">{m.shopping_loading()}</div>
      ) : null}
      {error ? (
        <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <span>{error}</span>
          {canRetry ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => void listsQuery.refetch()}
            >
              {m.action_retry()}
            </button>
          ) : null}
        </div>
      ) : null}
      {actions.actionError ? (
        <div className="alert alert-danger py-2">{actions.actionError}</div>
      ) : null}
      {successMessage ? <div className="alert alert-success py-2">{successMessage}</div> : null}

      <div className="card mb-3">
        <div className="card-body">
          <h3 className="h6 mb-3">{m.shopping_create_list()}</h3>
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label" htmlFor="shopping-list-name">
                {m.shopping_list_name()}
              </label>
              <input
                id="shopping-list-name"
                className="form-control"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={m.shopping_list_name_placeholder()}
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label" htmlFor="shopping-list-store">
                {m.shopping_store()}
              </label>
              <input
                id="shopping-list-store"
                className="form-control"
                value={store}
                onChange={(event) => setStore(event.target.value)}
                placeholder={m.shopping_store_placeholder()}
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label" htmlFor="shopping-list-notes">
                {m.today_notes_optional()}
              </label>
              <input
                id="shopping-list-notes"
                className="form-control"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            <div className="col-12 col-md-2">
              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={actions.isSubmitting || !name.trim()}
                onClick={() => void createList()}
              >
                {actions.isSubmitting ? m.action_creating() : m.action_add()}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex gap-2 mb-3" role="tablist" aria-label={m.shopping_tabs_label()}>
        <button
          type="button"
          className={`btn btn-sm ${tab === "active" ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setTab("active")}
        >
          {m.status_active()}
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === "archived" ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setTab("archived")}
        >
          {m.shopping_archived()}
        </button>
      </div>

      <div className="row g-3">
        {lists.map((list) => (
          <div className="col-12 col-md-6 col-xl-4" key={list.id}>
            <div className="card h-100">
              <div className="card-body d-flex flex-column gap-2">
                <div>
                  <div className="d-flex justify-content-between gap-2">
                    <h3 className="h5 mb-1">{list.name}</h3>
                    <span className="badge text-bg-secondary align-self-start">{list.status}</span>
                  </div>
                  {list.store ? <div className="text-muted small">{list.store}</div> : null}
                  {list.notes ? <p className="mb-0 small">{list.notes}</p> : null}
                </div>
                <div className="d-flex flex-wrap gap-2 mt-auto">
                  <Link
                    to="/shopping/$listId"
                    params={{ listId: String(list.id) }}
                    className="btn btn-outline-primary btn-sm"
                  >
                    {m.shopping_open_list()}
                  </Link>
                  {list.status === "active" ? (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      disabled={actions.isSubmitting}
                      onClick={() => void actions.archiveList(list.id)}
                    >
                      {m.shopping_archive()}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    disabled={actions.isSubmitting}
                    onClick={() => void actions.deleteList(list.id)}
                  >
                    {m.action_delete()}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {!listsQuery.isPending && lists.length === 0 ? (
          <div className="col-12">
            <div className="alert alert-secondary py-2">{m.shopping_no_lists()}</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
