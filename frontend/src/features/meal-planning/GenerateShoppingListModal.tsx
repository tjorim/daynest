import { useMemo, useState } from "react";
import * as m from "@/paraglide/messages";
import type { WeekGridResponse } from "@/lib/api/mealPlans";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiErrorMessage } from "@/lib/api/errorMessages";

interface GenerateShoppingListModalProps {
  week: WeekGridResponse;
  isSaving: boolean;
  onGenerate: () => Promise<void>;
  onClose: () => void;
}

export function GenerateShoppingListModal({
  week,
  isSaving,
  onGenerate,
  onClose,
}: GenerateShoppingListModalProps) {
  const [error, setError] = useState<string | null>(null);
  const ingredients = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const day of week.days) {
      for (const slot of Object.values(day.slots)) {
        for (const ingredient of slot?.ingredients_json ?? []) {
          const normalized = ingredient.trim();
          if (!normalized) continue;
          const key = normalized.toLocaleLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          list.push(normalized);
        }
      }
    }
    return list;
  }, [week]);

  const generate = async () => {
    setError(null);
    try {
      await onGenerate();
    } catch (err) {
      setError(apiErrorMessage(err, m.meal_plan_generate_error()));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="h5 mb-0">{m.meal_plan_generate_shopping_list()}</DialogTitle>
          <DialogCloseButton label={m.action_cancel()} />
        </DialogHeader>
        <DialogBody>
          {error ? <div className="alert alert-danger py-2">{error}</div> : null}
          <p className="text-muted">{m.meal_plan_generate_preview()}</p>
          {ingredients.length ? (
            <ul className="list-group meal-plan-ingredient-preview">
              {ingredients.map((ingredient) => (
                <li className="list-group-item" key={ingredient}>
                  {ingredient}
                </li>
              ))}
            </ul>
          ) : (
            <div className="alert alert-secondary py-2">{m.meal_plan_no_ingredients()}</div>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose className="btn btn-outline-secondary">{m.action_cancel()}</DialogClose>
          <button
            type="button"
            className="btn btn-primary"
            disabled={isSaving || ingredients.length === 0}
            onClick={() => void generate()}
          >
            {isSaving ? m.action_creating() : m.meal_plan_generate_shopping_list()}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
