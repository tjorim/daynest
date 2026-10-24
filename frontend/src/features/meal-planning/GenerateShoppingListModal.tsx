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
import { Alert } from "@/components/ui/alert";
import { ListGroup, ListGroupItem } from "@/components/ui/list-group";
import { Button } from "@/components/ui/button";

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
          <DialogTitle className="tw:text-h5 tw:font-medium tw:mb-0">
            {m.meal_plan_generate_shopping_list()}
          </DialogTitle>
          <DialogCloseButton label={m.action_cancel()} />
        </DialogHeader>
        <DialogBody>
          {error ? (
            <Alert variant="danger" className="tw:py-2">
              {error}
            </Alert>
          ) : null}
          <p className="tw:text-muted-foreground">{m.meal_plan_generate_preview()}</p>
          {ingredients.length ? (
            <ListGroup render={<ul />} className="meal-plan-ingredient-preview">
              {ingredients.map((ingredient) => (
                <ListGroupItem render={<li />} key={ingredient}>
                  {ingredient}
                </ListGroupItem>
              ))}
            </ListGroup>
          ) : (
            <Alert variant="secondary" className="tw:py-2">
              {m.meal_plan_no_ingredients()}
            </Alert>
          )}
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="outline-secondary" />}>
            {m.action_cancel()}
          </DialogClose>
          <Button disabled={isSaving || ingredients.length === 0} onClick={() => void generate()}>
            {isSaving ? m.action_creating() : m.meal_plan_generate_shopping_list()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
