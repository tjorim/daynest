import { http, HttpResponse } from "msw";
import type {
  MealPlan,
  MealPlanInput,
  MealPlanUpdateInput,
  MealSlot,
  MealSlotUpdateInput,
} from "@/lib/api/mealPlans";
import { MEAL_SLOT_TYPES } from "@/lib/api/mealPlans";
import type { PlannedTodayItem } from "@/lib/api/today";
import { addMockShoppingList } from "@/mocks/handlers/shoppingLists";
import { dayjs, toIsoDate } from "@/lib/dateUtils";

let nextMealPlanId = 2;
let nextMealSlotId = 29;
let nextPlannedItemId = 500;

const weekStart = toIsoDate(dayjs().subtract((dayjs().day() + 6) % 7, "day"));

const mealPlans: MealPlan[] = [
  {
    id: 1,
    user_id: 1,
    name: "Weekly meal plan",
    week_start: weekStart,
    notes: null,
    created_at: new Date().toISOString(),
  },
];

const mealSlots: MealSlot[] = [];

function ensureSlots(plan: MealPlan): MealSlot[] {
  const validDates = new Set(
    Array.from({ length: 7 }, (_, offset) =>
      toIsoDate(dayjs(plan.week_start).add(offset, "day")),
    ),
  );
  // Remove stale slots that belong to a prior week_start
  for (let i = mealSlots.length - 1; i >= 0; i -= 1) {
    const slot = mealSlots[i]!;
    if (slot.meal_plan_id === plan.id && !validDates.has(slot.slot_date)) {
      mealSlots.splice(i, 1);
    }
  }
  for (const slotDate of validDates) {
    for (const slotType of MEAL_SLOT_TYPES) {
      const existing = mealSlots.find(
        (slot) =>
          slot.meal_plan_id === plan.id &&
          slot.slot_date === slotDate &&
          slot.slot_type === slotType,
      );
      if (!existing) {
        mealSlots.push({
          id: nextMealSlotId++,
          meal_plan_id: plan.id,
          slot_date: slotDate,
          slot_type: slotType,
          title: "",
          recipe_url: null,
          ingredients_json: [],
          planned_item_id: null,
        });
      }
    }
  }
  return mealSlots.filter((slot) => slot.meal_plan_id === plan.id);
}

ensureSlots(mealPlans[0]!);
const mondayDinner = mealSlots.find(
  (slot) => slot.meal_plan_id === 1 && slot.slot_date === weekStart && slot.slot_type === "dinner",
);
if (mondayDinner) {
  mondayDinner.title = "Vegetable pasta";
  mondayDinner.recipe_url = "https://example.com/vegetable-pasta";
  mondayDinner.ingredients_json = ["Pasta", "Tomatoes", "Basil"];
}

function weekPayload(plan: MealPlan) {
  const slots = ensureSlots(plan);
  return {
    meal_plan: plan,
    days: Array.from({ length: 7 }, (_, offset) => {
      const date = toIsoDate(dayjs(plan.week_start).add(offset, "day"));
      return {
        date,
        slots: Object.fromEntries(
          MEAL_SLOT_TYPES.map((slotType) => [
            slotType,
            slots.find((slot) => slot.slot_date === date && slot.slot_type === slotType),
          ]),
        ),
      };
    }),
  };
}

export const mealPlanHandlers = [
  http.get("/api/meal-plans", () => HttpResponse.json(mealPlans)),
  http.post("/api/meal-plans", async ({ request }) => {
    const input = (await request.json()) as MealPlanInput;
    const plan: MealPlan = {
      id: nextMealPlanId++,
      user_id: 1,
      name: input.name,
      week_start: input.week_start,
      notes: input.notes ?? null,
      created_at: new Date().toISOString(),
    };
    mealPlans.unshift(plan);
    ensureSlots(plan);
    return HttpResponse.json(plan, { status: 201 });
  }),
  http.put("/api/meal-plans/:mealPlanId", async ({ params, request }) => {
    const plan = mealPlans.find((item) => item.id === Number(params.mealPlanId));
    if (!plan) return new HttpResponse(null, { status: 404 });
    const input = (await request.json()) as MealPlanUpdateInput;
    plan.name = input.name ?? plan.name;
    plan.week_start = input.week_start ?? plan.week_start;
    plan.notes = "notes" in input ? (input.notes ?? null) : plan.notes;
    ensureSlots(plan);
    return HttpResponse.json(plan);
  }),
  http.get("/api/meal-plans/:mealPlanId/slots", ({ params }) => {
    const plan = mealPlans.find((item) => item.id === Number(params.mealPlanId));
    return plan ? HttpResponse.json(weekPayload(plan)) : new HttpResponse(null, { status: 404 });
  }),
  http.put("/api/meal-plans/:mealPlanId/slots/:slotId", async ({ params, request }) => {
    const slot = mealSlots.find(
      (item) =>
        item.meal_plan_id === Number(params.mealPlanId) && item.id === Number(params.slotId),
    );
    if (!slot) return new HttpResponse(null, { status: 404 });
    const input = (await request.json()) as MealSlotUpdateInput;
    slot.title = input.title ?? slot.title;
    slot.recipe_url = "recipe_url" in input ? (input.recipe_url ?? null) : slot.recipe_url;
    slot.ingredients_json = input.ingredients_json ?? slot.ingredients_json;
    slot.planned_item_id =
      "planned_item_id" in input ? (input.planned_item_id ?? null) : slot.planned_item_id;
    return HttpResponse.json(slot);
  }),
  http.post("/api/meal-plans/:mealPlanId/generate-shopping-list", ({ params }) => {
    const plan = mealPlans.find((item) => item.id === Number(params.mealPlanId));
    if (!plan) return new HttpResponse(null, { status: 404 });
    const ingredients = Array.from(
      new Set(
        ensureSlots(plan)
          .flatMap((slot) => slot.ingredients_json)
          .map((ingredient) => ingredient.trim())
          .filter(Boolean),
      ),
    );
    if (ingredients.length === 0) {
      return HttpResponse.json({ detail: "Meal plan has no ingredients" }, { status: 422 });
    }
    const shoppingList = addMockShoppingList({
      name: `Meal plan: ${plan.name}`,
      notes: `Generated from meal plan #${plan.id}`,
    });
    const items: PlannedTodayItem[] = ingredients.map((ingredient) => ({
      id: nextPlannedItemId++,
      title: ingredient,
      planned_for: plan.week_start,
      time_of_day: null,
      duration_minutes: null,
      notes: `Generated from meal plan '${plan.name}'`,
      module_key: "shopping_list",
      recurrence_hint: null,
      rrule: null,
      recurrence_series_id: null,
      linked_source: "shopping_list",
      linked_ref: String(shoppingList.id),
      priority: "normal",
      tags: ["meal-planning"],
      is_done: false,
    }));
    return HttpResponse.json({ shopping_list: shoppingList, items });
  }),
];
