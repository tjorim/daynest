import { fetchWithAuth, parseJsonResponse } from "@/lib/api/http";
import { MealSlotResponseSlotType } from "@/api-schema";
import type {
  GenerateShoppingListResponse,
  MealPlan,
  MealPlanInput,
  MealPlanUpdateInput,
  MealSlot,
  MealSlotType,
  MealSlotUpdateInput,
  WeekGridResponse,
} from "@/api-types";
import * as m from "@/paraglide/messages";

export const MEAL_SLOT_TYPES: readonly MealSlotType[] = Object.values(MealSlotResponseSlotType);

export async function listMealPlans(signal?: AbortSignal): Promise<MealPlan[]> {
  const response = await fetchWithAuth("/api/meal-plans", {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse<MealPlan[]>(response, m.api_meal_plans_load_failed(), true);
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
  return parseJsonResponse<MealPlan>(response, m.api_meal_plan_create_failed(), false);
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
  return parseJsonResponse<MealPlan>(response, m.api_meal_plan_update_failed(), false);
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
  return parseJsonResponse<WeekGridResponse>(response, m.api_meal_plan_week_load_failed(), true);
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
  return parseJsonResponse<MealSlot>(response, m.api_meal_slot_update_failed(), false);
}

export async function generateMealPlanShoppingList(
  mealPlanId: number,
): Promise<GenerateShoppingListResponse> {
  const response = await fetchWithAuth(`/api/meal-plans/${mealPlanId}/generate-shopping-list`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<GenerateShoppingListResponse>(
    response,
    m.api_shopping_list_generate_failed(),
    false,
  );
}
