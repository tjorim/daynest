import { useEffect, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import * as m from "@/paraglide/messages";
import type { MealSlot, MealSlotUpdateInput } from "@/lib/api/mealPlans";
import { useFocusTrap } from "@/lib/useFocusTrap";

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
  const modalRef = useRef<HTMLFormElement>(null);
  useFocusTrap(modalRef, Boolean(slot));

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
        setError(err instanceof Error ? err.message : m.meal_plan_save_error());
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
    <div className="modal d-block meal-plan-modal" tabIndex={-1} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-centered">
        <form
          ref={modalRef}
          className="modal-content"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <div className="modal-header">
            <div>
              <h3 className="modal-title h5">{m.meal_plan_edit_slot()}</h3>
              <div className="small text-muted">
                {dayLabel} · {mealLabel}
              </div>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label={m.action_cancel()}
              onClick={onClose}
            />
          </div>
          <div className="modal-body">
            {error ? <div className="alert alert-danger py-2">{error}</div> : null}
            <div className="mb-3">
              <label className="form-label" htmlFor="meal-slot-title">
                {m.meal_plan_slot_title()}
              </label>
              <form.Field
                name="title"
                children={(field) => (
                  <input
                    id="meal-slot-title"
                    className="form-control"
                    value={field.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder={m.meal_plan_slot_title_placeholder()}
                  />
                )}
              />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="meal-slot-recipe">
                {m.meal_plan_recipe_url()}
              </label>
              <form.Field
                name="recipeUrl"
                children={(field) => (
                  <input
                    id="meal-slot-recipe"
                    className="form-control"
                    type="url"
                    value={field.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="https://"
                  />
                )}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="meal-slot-ingredients">
                {m.meal_plan_ingredients()}
              </label>
              <form.Field
                name="ingredientsText"
                children={(field) => (
                  <textarea
                    id="meal-slot-ingredients"
                    className="form-control"
                    rows={4}
                    value={field.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder={m.meal_plan_ingredients_placeholder()}
                  />
                )}
              />
              <div className="form-text">{m.meal_plan_ingredients_help()}</div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              {m.action_cancel()}
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? m.action_saving() : m.action_save()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
