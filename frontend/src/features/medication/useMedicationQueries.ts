import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMedicationPlan,
  deleteMedicationPlan,
  fetchMedicationHistory,
  listMedicationPlans,
  updateMedicationPlan,
  type MedicationPlanInput,
  type MedicationPlanUpdateInput,
} from "@/lib/api/medications";
import { queryKeys } from "@/lib/query/queryKeys";

function useInvalidateMedicationQueries() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.medication.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.today.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
    ]);
}

export function useMedicationPlansQuery() {
  return useQuery({
    queryKey: queryKeys.medication.plans(),
    queryFn: ({ signal }) => listMedicationPlans(signal),
  });
}

export function useMedicationHistoryQuery() {
  return useQuery({
    queryKey: queryKeys.medication.history(),
    queryFn: ({ signal }) => fetchMedicationHistory(signal),
  });
}

export function useCreateMedicationPlanMutation() {
  const invalidate = useInvalidateMedicationQueries();
  return useMutation({
    mutationFn: (input: MedicationPlanInput) => createMedicationPlan(input),
    onSuccess: invalidate,
  });
}

export function useUpdateMedicationPlanMutation() {
  const invalidate = useInvalidateMedicationQueries();
  return useMutation({
    mutationFn: ({ planId, input }: { planId: number; input: MedicationPlanUpdateInput }) =>
      updateMedicationPlan(planId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteMedicationPlanMutation() {
  const invalidate = useInvalidateMedicationQueries();
  return useMutation({
    mutationFn: (planId: number) => deleteMedicationPlan(planId),
    onSuccess: invalidate,
  });
}
