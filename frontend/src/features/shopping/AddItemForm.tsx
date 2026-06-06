import { useState } from "react";
import * as m from "@/paraglide/messages";
import { toIsoDate } from "@/lib/dateUtils";
import type { ShoppingItemInput } from "@/lib/api/shoppingLists";

interface AddItemFormProps {
  isSubmitting: boolean;
  onAddItem: (input: ShoppingItemInput) => Promise<void>;
}

export function AddItemForm({ isSubmitting, onAddItem }: AddItemFormProps) {
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [plannedFor, setPlannedFor] = useState(() => toIsoDate(new Date()));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) {
      setError(m.shopping_item_required());
      return;
    }
    setError(null);
    await onAddItem({
      title: title.trim(),
      planned_for: plannedFor,
      notes: notes.trim() || null,
      tag: tag.trim() || null,
    });
    setTitle("");
    setTag("");
    setNotes("");
  };

  return (
    <div className="card mb-3">
      <div className="card-body">
        <h3 className="h6 mb-3">{m.shopping_add_item()}</h3>
        {error ? <div className="alert alert-danger py-2">{error}</div> : null}
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-4">
            <label className="form-label" htmlFor="shopping-item-title">
              {m.shopping_item_name()}
            </label>
            <input
              id="shopping-item-title"
              className="form-control"
              value={title}
              placeholder={m.shopping_item_placeholder()}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label" htmlFor="shopping-item-tag">
              {m.shopping_category_tag()}
            </label>
            <input
              id="shopping-item-tag"
              className="form-control"
              value={tag}
              placeholder={m.shopping_category_placeholder()}
              onChange={(event) => setTag(event.target.value)}
            />
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label" htmlFor="shopping-item-date">
              {m.shopping_planned_for()}
            </label>
            <input
              id="shopping-item-date"
              type="date"
              className="form-control"
              value={plannedFor}
              onChange={(event) => setPlannedFor(event.target.value)}
            />
          </div>
          <div className="col-12 col-md-2">
            <button
              type="button"
              className="btn btn-primary w-100"
              disabled={isSubmitting}
              onClick={() => void submit()}
            >
              {isSubmitting ? m.action_adding() : m.action_add()}
            </button>
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="shopping-item-notes">
              {m.today_notes_optional()}
            </label>
            <textarea
              id="shopping-item-notes"
              className="form-control"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
