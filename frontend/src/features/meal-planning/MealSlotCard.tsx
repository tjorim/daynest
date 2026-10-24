import { Link } from "lucide-react";
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
      className="meal-slot-card h-full text-start"
      onClick={onEdit}
      disabled={!slot}
    >
      <span className="flex min-h-6 justify-between items-start gap-2">
        <span className="text-small text-muted-foreground uppercase font-semibold">
          {mealLabel}
        </span>
        {slot?.recipe_url ? (
          <Link className="size-4" role="img" aria-label={m.meal_plan_recipe_link()} />
        ) : null}
      </span>
      <span className="block font-semibold mt-1">
        {slot?.title.trim() ? slot.title : m.meal_plan_empty_slot()}
      </span>
      {slot?.ingredients_json.length ? (
        <span className="block text-small text-muted-foreground mt-1">
          {m.meal_plan_ingredients_count({ count: slot.ingredients_json.length })}
        </span>
      ) : null}
    </Button>
  );
}
