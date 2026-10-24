import { Button } from "@/components/ui/button";
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
    <Button
      variant={hasContent ? "light" : "outline-secondary"}
      className="meal-slot-card tw:h-full tw:text-start"
      onClick={onEdit}
      disabled={!slot}
    >
      <span className="tw:flex tw:justify-between tw:items-start tw:gap-2">
        <span className="tw:text-small tw:text-muted-foreground tw:uppercase tw:font-semibold">
          {mealLabel}
        </span>
        {slot?.recipe_url ? (
          <i className="bi bi-link-45deg" aria-label={m.meal_plan_recipe_link()} />
        ) : null}
      </span>
      <span className="tw:block tw:font-semibold tw:mt-1">
        {slot?.title.trim() ? slot.title : m.meal_plan_empty_slot()}
      </span>
      {slot?.ingredients_json.length ? (
        <span className="tw:block tw:text-small tw:text-muted-foreground tw:mt-1">
          {m.meal_plan_ingredients_count({ count: slot.ingredients_json.length })}
        </span>
      ) : null}
    </Button>
  );
}
