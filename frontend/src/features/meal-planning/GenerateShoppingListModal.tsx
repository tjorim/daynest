import { useMemo, useState } from "react";
import * as m from "@/paraglide/messages";
import type { WeekGridResponse } from "@/lib/api/mealPlans";

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
      setError(err instanceof Error ? err.message : m.meal_plan_generate_error());
    }
  };

  return (
    <div className="modal d-block meal-plan-modal" tabIndex={-1} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h3 className="modal-title h5">{m.meal_plan_generate_shopping_list()}</h3>
            <button
              type="button"
              className="btn-close"
              aria-label={m.action_cancel()}
              onClick={onClose}
            />
          </div>
          <div className="modal-body">
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
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              {m.action_cancel()}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isSaving || ingredients.length === 0}
              onClick={() => void generate()}
            >
              {isSaving ? m.action_creating() : m.meal_plan_generate_shopping_list()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
