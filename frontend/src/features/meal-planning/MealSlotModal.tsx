import { useEffect, useMemo, useState } from "react";
import * as m from "@/paraglide/messages";
import type { MealSlot, MealSlotUpdateInput } from "@/lib/api/mealPlans";

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
  const [title, setTitle] = useState("");
  const [recipeUrl, setRecipeUrl] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(slot?.title ?? "");
    setRecipeUrl(slot?.recipe_url ?? "");
    setIngredientsText(slot?.ingredients_json.join(", ") ?? "");
    setError(null);
  }, [slot]);

  const ingredients = useMemo(
    () =>
      ingredientsText
        .split(",")
        .map((ingredient) => ingredient.trim())
        .filter(Boolean),
    [ingredientsText],
  );

  if (!slot) return null;

  const save = async () => {
    setError(null);
    try {
      await onSave(slot.id, {
        title: title.trim(),
        recipe_url: recipeUrl.trim() || null,
        ingredients_json: ingredients,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : m.meal_plan_save_error());
    }
  };

  return (
    <div className="modal d-block meal-plan-modal" tabIndex={-1} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
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
              <input
                id="meal-slot-title"
                className="form-control"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={m.meal_plan_slot_title_placeholder()}
              />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="meal-slot-recipe">
                {m.meal_plan_recipe_url()}
              </label>
              <input
                id="meal-slot-recipe"
                className="form-control"
                type="url"
                value={recipeUrl}
                onChange={(event) => setRecipeUrl(event.target.value)}
                placeholder="https://"
              />
            </div>
            <div>
              <label className="form-label" htmlFor="meal-slot-ingredients">
                {m.meal_plan_ingredients()}
              </label>
              <textarea
                id="meal-slot-ingredients"
                className="form-control"
                rows={4}
                value={ingredientsText}
                onChange={(event) => setIngredientsText(event.target.value)}
                placeholder={m.meal_plan_ingredients_placeholder()}
              />
              <div className="form-text">{m.meal_plan_ingredients_help()}</div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              {m.action_cancel()}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSaving}
              onClick={() => void save()}
            >
              {isSaving ? m.action_saving() : m.action_save()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
