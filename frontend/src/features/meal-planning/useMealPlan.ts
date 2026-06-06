import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMealPlan,
  generateMealPlanShoppingList,
  getMealPlanWeek,
  listMealPlans,
  updateMealPlan,
  updateMealSlot,
  type MealPlanInput,
  type MealPlanUpdateInput,
  type MealSlotUpdateInput,
} from "@/lib/api/mealPlans";
import { queryKeys } from "@/lib/query/queryKeys";

export function useMealPlansQuery() {
  return useQuery({
    queryKey: queryKeys.mealPlans.list(),
    queryFn: ({ signal }) => listMealPlans(signal),
  });
}

export function useMealPlanWeekQuery(mealPlanId: number | null, weekStart: string) {
  return useQuery({
    queryKey: queryKeys.mealPlans.week(mealPlanId ?? 0, weekStart),
    queryFn: ({ signal }) => getMealPlanWeek(mealPlanId ?? 0, weekStart, signal),
    enabled: mealPlanId !== null && Number.isFinite(mealPlanId),
  });
}

export function useMealPlanActions() {
  const queryClient = useQueryClient();

  const invalidateMealPlanning = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.shoppingLists.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.plannedItems.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.today.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
    ]);

  const createPlanMutation = useMutation({
    mutationFn: (input: MealPlanInput) => createMealPlan(input),
    onSuccess: invalidateMealPlanning,
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ mealPlanId, input }: { mealPlanId: number; input: MealPlanUpdateInput }) =>
      updateMealPlan(mealPlanId, input),
    onSuccess: invalidateMealPlanning,
  });

  const updateSlotMutation = useMutation({
    mutationFn: ({
      mealPlanId,
      slotId,
      input,
    }: {
      mealPlanId: number;
      slotId: number;
      input: MealSlotUpdateInput;
    }) => updateMealSlot(mealPlanId, slotId, input),
    onSuccess: invalidateMealPlanning,
  });

  const generateShoppingListMutation = useMutation({
    mutationFn: (mealPlanId: number) => generateMealPlanShoppingList(mealPlanId),
    onSuccess: invalidateMealPlanning,
  });

  return {
    createPlan: createPlanMutation.mutateAsync,
    updatePlan: (mealPlanId: number, input: MealPlanUpdateInput) =>
      updatePlanMutation.mutateAsync({ mealPlanId, input }),
    updateSlot: (mealPlanId: number, slotId: number, input: MealSlotUpdateInput) =>
      updateSlotMutation.mutateAsync({ mealPlanId, slotId, input }),
    generateShoppingList: generateShoppingListMutation.mutateAsync,
    isSubmitting:
      createPlanMutation.isPending ||
      updatePlanMutation.isPending ||
      updateSlotMutation.isPending ||
      generateShoppingListMutation.isPending,
    error:
      createPlanMutation.error ??
      updatePlanMutation.error ??
      updateSlotMutation.error ??
      generateShoppingListMutation.error,
  };
}
