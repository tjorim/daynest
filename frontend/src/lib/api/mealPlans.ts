import { fetchWithAuth, parseJsonResponse, plannedTodayItemSchema } from "@/lib/api/today";
import type { PlannedTodayItem } from "@/lib/api/today";
import { z } from "zod";

export type MealSlotType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_SLOT_TYPES: readonly MealSlotType[] = ["breakfast", "lunch", "dinner", "snack"];

export interface MealPlan {
  id: number;
  user_id: number;
  name: string;
  week_start: string;
  notes: string | null;
  created_at: string;
}

export interface MealPlanInput {
  name: string;
  week_start: string;
  notes?: string | null;
}

export interface MealPlanUpdateInput {
  name?: string;
  week_start?: string;
  notes?: string | null;
}

export interface MealSlot {
  id: number;
  meal_plan_id: number;
  slot_date: string;
  slot_type: MealSlotType;
  title: string;
  recipe_url: string | null;
  ingredients_json: string[];
  planned_item_id: number | null;
}

export interface MealSlotUpdateInput {
  title?: string;
  recipe_url?: string | null;
  ingredients_json?: string[];
  planned_item_id?: number | null;
}

export interface WeekDayMealSlots {
  date: string;
  slots: Partial<Record<MealSlotType, MealSlot>>;
}

export interface WeekGridResponse {
  meal_plan: MealPlan;
  days: WeekDayMealSlots[];
}

export interface GenerateShoppingListResponse {
  shopping_list: {
    id: number;
    user_id: number;
    name: string;
    store: string | null;
    notes: string | null;
    status: "active" | "archived";
    created_at: string;
  };
  items: PlannedTodayItem[];
}

const mealSlotTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);

const mealPlanSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  name: z.string(),
  week_start: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
});

const mealSlotSchema = z.object({
  id: z.number(),
  meal_plan_id: z.number(),
  slot_date: z.string(),
  slot_type: mealSlotTypeSchema,
  title: z.string(),
  recipe_url: z.string().nullable(),
  ingredients_json: z.array(z.string()),
  planned_item_id: z.number().nullable(),
});

const weekGridSchema = z.object({
  meal_plan: mealPlanSchema,
  days: z.array(
    z.object({
      date: z.string(),
      slots: z.record(mealSlotTypeSchema, mealSlotSchema.optional()),
    }),
  ),
});

const shoppingListSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  name: z.string(),
  store: z.string().nullable(),
  notes: z.string().nullable(),
  status: z.enum(["active", "archived"]),
  created_at: z.string(),
});

const generateShoppingListResponseSchema = z.object({
  shopping_list: shoppingListSchema,
  items: z.array(plannedTodayItemSchema),
});

export async function listMealPlans(signal?: AbortSignal): Promise<MealPlan[]> {
  const response = await fetchWithAuth("/api/meal-plans", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse(response, "Unable to load meal plans", true, z.array(mealPlanSchema));
}

export async function createMealPlan(input: MealPlanInput): Promise<MealPlan> {
  const response = await fetchWithAuth("/api/meal-plans", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response, "Unable to create meal plan", false, mealPlanSchema);
}

export async function updateMealPlan(
  mealPlanId: number,
  input: MealPlanUpdateInput,
): Promise<MealPlan> {
  const response = await fetchWithAuth(`/api/meal-plans/${mealPlanId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response, "Unable to update meal plan", false, mealPlanSchema);
}

export async function getMealPlanWeek(
  mealPlanId: number,
  weekStart?: string,
  signal?: AbortSignal,
): Promise<WeekGridResponse> {
  const params = new URLSearchParams();
  if (weekStart) params.set("week_start", weekStart);
  const query = params.toString();
  const response = await fetchWithAuth(
    `/api/meal-plans/${mealPlanId}/slots${query ? `?${query}` : ""}`,
    {
      headers: { Accept: "application/json" },
      signal,
    },
  );
  return parseJsonResponse(response, "Unable to load meal plan week", true, weekGridSchema);
}

export async function updateMealSlot(
  mealPlanId: number,
  slotId: number,
  input: MealSlotUpdateInput,
): Promise<MealSlot> {
  const response = await fetchWithAuth(`/api/meal-plans/${mealPlanId}/slots/${slotId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse(response, "Unable to update meal slot", false, mealSlotSchema);
}

export async function generateMealPlanShoppingList(
  mealPlanId: number,
): Promise<GenerateShoppingListResponse> {
  const response = await fetchWithAuth(`/api/meal-plans/${mealPlanId}/generate-shopping-list`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse(
    response,
    "Unable to generate shopping list",
    false,
    generateShoppingListResponseSchema,
  );
}
