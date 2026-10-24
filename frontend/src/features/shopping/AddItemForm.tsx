import { useState } from "react";
import * as m from "@/paraglide/messages";
import { toIsoDate } from "@/lib/dateUtils";
import type { ShoppingItemInput } from "@/lib/api/shoppingLists";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Label } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    try {
      await onAddItem({
        title: title.trim(),
        planned_for: plannedFor,
        notes: notes.trim() || null,
        tag: tag.trim() || null,
      });
      setTitle("");
      setTag("");
      setNotes("");
    } catch {
      // Error is handled by the parent component
    }
  };

  return (
    <Card className="mb-4">
      <CardContent>
        <h3 className="text-h6 font-medium mb-4">{m.shopping_add_item()}</h3>
        {error ? (
          <Alert variant="danger" className="py-2">
            {error}
          </Alert>
        ) : null}
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-12 md:col-span-4">
            <Label htmlFor="shopping-item-title">{m.shopping_item_name()}</Label>
            <Input
              id="shopping-item-title"
              value={title}
              placeholder={m.shopping_item_placeholder()}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <Label htmlFor="shopping-item-tag">{m.shopping_category_tag()}</Label>
            <Input
              id="shopping-item-tag"
              value={tag}
              placeholder={m.shopping_category_placeholder()}
              onChange={(event) => setTag(event.target.value)}
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <Label htmlFor="shopping-item-date">{m.shopping_planned_for()}</Label>
            <Input
              id="shopping-item-date"
              type="date"
              value={plannedFor}
              onChange={(event) => setPlannedFor(event.target.value)}
            />
          </div>
          <div className="col-span-12 md:col-span-2">
            <Button className="w-full" disabled={isSubmitting} onClick={() => void submit()}>
              {isSubmitting ? m.action_adding() : m.action_add()}
            </Button>
          </div>
          <div className="col-span-12">
            <Label htmlFor="shopping-item-notes">{m.today_notes_optional()}</Label>
            <Textarea
              id="shopping-item-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
