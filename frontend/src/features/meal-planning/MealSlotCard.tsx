import * as m from "@/paraglide/messages";
import type { MealSlot } from "@/lib/api/mealPlans";

interface MealSlotCardProps {
  slot: MealSlot | undefined;
  mealLabel: string;
  onEdit: () => void;
}

export function MealSlotCard({ slot, mealLabel, onEdit }: MealSlotCardProps) {
  const hasContent = Boolean(
    slot?.title.trim() || slot?.recipe_url || slot?.ingredients_json.length,
  );

  return (
    <button
      type="button"
      className={`meal-slot-card btn text-start h-100 ${hasContent ? "btn-light" : "btn-outline-secondary"}`}
      onClick={onEdit}
      disabled={!slot}
    >
      <span className="d-flex justify-content-between align-items-start gap-2">
        <span className="small text-muted text-uppercase fw-semibold">{mealLabel}</span>
        {slot?.recipe_url ? (
          <i className="bi bi-link-45deg" aria-label={m.meal_plan_recipe_link()} />
        ) : null}
      </span>
      <span className="d-block fw-semibold mt-1">
        {slot?.title.trim() ? slot.title : m.meal_plan_empty_slot()}
      </span>
      {slot?.ingredients_json.length ? (
        <span className="d-block small text-muted mt-1">
          {m.meal_plan_ingredients_count({ count: slot.ingredients_json.length })}
        </span>
      ) : null}
    </button>
  );
}
