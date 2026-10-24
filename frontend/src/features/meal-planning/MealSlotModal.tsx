import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import * as m from "@/paraglide/messages";
import type { MealSlot, MealSlotUpdateInput } from "@/lib/api/mealPlans";
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
import { FieldDescription, Label } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface MealSlotModalProps {
  slot: MealSlot | null;
  dayLabel: string;
  mealLabel: string;
  isSaving: boolean;
  onSave: (slotId: number, input: MealSlotUpdateInput) => Promise<void>;
  onClose: () => void;
}

export function MealSlotModal({
  slot,
  dayLabel,
  mealLabel,
  isSaving,
  onSave,
  onClose,
}: MealSlotModalProps) {
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { title: "", recipeUrl: "", ingredientsText: "" },
    onSubmit: async ({ value }) => {
      if (!slot) return;
      setError(null);
      const ingredients = value.ingredientsText
        .split(",")
        .map((ingredient) => ingredient.trim())
        .filter(Boolean);
      try {
        await onSave(slot.id, {
          title: value.title.trim(),
          recipe_url: value.recipeUrl.trim() || null,
          ingredients_json: ingredients,
        });
        onClose();
      } catch (err) {
        setError(apiErrorMessage(err, m.meal_plan_save_error()));
      }
    },
  });

  useEffect(() => {
    form.reset({
      title: slot?.title ?? "",
      recipeUrl: slot?.recipe_url ?? "",
      ingredientsText: slot?.ingredients_json.join(", ") ?? "",
    });
    setError(null);
    // form.reset is stable across renders (form identity doesn't change); only
    // re-run this sync when the slot prop itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  if (!slot) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <div>
              <DialogTitle className="tw:text-h5 tw:font-medium tw:mb-0">
                {m.meal_plan_edit_slot()}
              </DialogTitle>
              <div className="tw:text-small tw:text-muted-foreground">
                {dayLabel} · {mealLabel}
              </div>
            </div>
            <DialogCloseButton label={m.action_cancel()} />
          </DialogHeader>
          <DialogBody>
            {error ? (
              <Alert variant="danger" className="tw:py-2">
                {error}
              </Alert>
            ) : null}
            <div className="tw:mb-4">
              <Label htmlFor="meal-slot-title">{m.meal_plan_slot_title()}</Label>
              <form.Field
                name="title"
                children={(field) => (
                  <Input
                    id="meal-slot-title"
                    value={field.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder={m.meal_plan_slot_title_placeholder()}
                  />
                )}
              />
            </div>
            <div className="tw:mb-4">
              <Label htmlFor="meal-slot-recipe">{m.meal_plan_recipe_url()}</Label>
              <form.Field
                name="recipeUrl"
                children={(field) => (
                  <Input
                    id="meal-slot-recipe"
                    type="url"
                    value={field.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="https://"
                  />
                )}
              />
            </div>
            <div>
              <Label htmlFor="meal-slot-ingredients">{m.meal_plan_ingredients()}</Label>
              <form.Field
                name="ingredientsText"
                children={(field) => (
                  <Textarea
                    id="meal-slot-ingredients"
                    rows={4}
                    value={field.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder={m.meal_plan_ingredients_placeholder()}
                  />
                )}
              />
              <FieldDescription>{m.meal_plan_ingredients_help()}</FieldDescription>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button variant="outline-secondary" />}>
              {m.action_cancel()}
            </DialogClose>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? m.action_saving() : m.action_save()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
