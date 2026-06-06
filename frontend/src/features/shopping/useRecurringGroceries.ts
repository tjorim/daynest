import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createRecurringGrocery,
  deleteRecurringGrocery,
  listRecurringGroceries,
  updateRecurringGrocery,
  type RecurringGroceryInput,
  type RecurringGrocerySeries,
} from "@/lib/api/recurringGroceries";
import { queryKeys } from "@/lib/query/queryKeys";

export function useRecurringGroceriesQuery() {
  return useQuery({
    queryKey: queryKeys.recurringGroceries.list(),
    queryFn: ({ signal }) => listRecurringGroceries(signal),
  });
}

export function useRecurringGroceryActions(onRefresh?: () => Promise<unknown>) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidateRecurringGroceries = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringGroceries.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.shoppingLists.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.plannedItems.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.today.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
    ]);

  const createMutation = useMutation({
    mutationFn: (input: RecurringGroceryInput) => createRecurringGrocery(input),
    onSuccess: invalidateRecurringGroceries,
  });
  const updateMutation = useMutation({
    mutationFn: ({ series, input }: { series: RecurringGrocerySeries; input: RecurringGroceryInput }) =>
      updateRecurringGrocery(series, input),
    onSuccess: invalidateRecurringGroceries,
  });
  const deleteMutation = useMutation({
    mutationFn: (series: RecurringGrocerySeries) => deleteRecurringGrocery(series),
    onSuccess: invalidateRecurringGroceries,
  });

  const runAction = async <TVariables>(
    mutation: { mutateAsync: (variables: TVariables) => Promise<unknown> },
    variables: TVariables,
  ) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await mutation.mutateAsync(variables);
      if (onRefresh) await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    actionError,
    clearActionError: () => setActionError(null),
    createSeries: (input: RecurringGroceryInput) => runAction(createMutation, input),
    updateSeries: (series: RecurringGrocerySeries, input: RecurringGroceryInput) =>
      runAction(updateMutation, { series, input }),
    deleteSeries: (series: RecurringGrocerySeries) => runAction(deleteMutation, series),
  };
}
