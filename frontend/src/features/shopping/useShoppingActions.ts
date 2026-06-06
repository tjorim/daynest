import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addShoppingItem,
  checkOffShoppingItem,
  createShoppingList,
  deleteShoppingList,
  importRecurringGroceries,
  updateShoppingList,
  type ShoppingItemInput,
  type ShoppingListInput,
  type ShoppingListUpdateInput,
} from "@/lib/api/shoppingLists";
import type { PlannedTodayItem } from "@/lib/api/today";
import { queryKeys } from "@/lib/query/queryKeys";

type MutationOptions = { refresh?: boolean };

export function useShoppingActions(onRefresh?: () => Promise<unknown>) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidateShopping = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.shoppingLists.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.plannedItems.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.today.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.search.all }),
    ]);

  const createListMutation = useMutation({
    mutationFn: (input: ShoppingListInput) => createShoppingList(input),
    onSuccess: invalidateShopping,
  });
  const updateListMutation = useMutation({
    mutationFn: ({ listId, input }: { listId: number; input: ShoppingListUpdateInput }) =>
      updateShoppingList(listId, input),
    onSuccess: invalidateShopping,
  });
  const archiveListMutation = useMutation({
    mutationFn: (listId: number) => updateShoppingList(listId, { status: "archived" }),
    onSuccess: invalidateShopping,
  });
  const deleteListMutation = useMutation({
    mutationFn: (listId: number) => deleteShoppingList(listId),
    onSuccess: invalidateShopping,
  });
  const addItemMutation = useMutation({
    mutationFn: ({ listId, input }: { listId: number; input: ShoppingItemInput }) =>
      addShoppingItem(listId, input),
    onSuccess: invalidateShopping,
  });
  const checkOffItemMutation = useMutation({
    mutationFn: (item: PlannedTodayItem) => checkOffShoppingItem(item),
    onSuccess: invalidateShopping,
  });
  const importRecurringMutation = useMutation({
    mutationFn: (listId: number) => importRecurringGroceries(listId),
    onSuccess: invalidateShopping,
  });

  const runAction = async <TVariables>(
    mutation: { mutateAsync: (variables: TVariables) => Promise<unknown> },
    variables: TVariables,
    options: MutationOptions = {},
  ) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await mutation.mutateAsync(variables);
      if (options.refresh !== false && onRefresh) {
        await onRefresh();
      }
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
    createList: (input: ShoppingListInput, options?: MutationOptions) =>
      runAction(createListMutation, input, options),
    updateList: (listId: number, input: ShoppingListUpdateInput, options?: MutationOptions) =>
      runAction(updateListMutation, { listId, input }, options),
    archiveList: (listId: number, options?: MutationOptions) =>
      runAction(archiveListMutation, listId, options),
    deleteList: (listId: number, options?: MutationOptions) =>
      runAction(deleteListMutation, listId, options),
    addItem: (listId: number, input: ShoppingItemInput, options?: MutationOptions) =>
      runAction(addItemMutation, { listId, input }, options),
    checkOffItem: (item: PlannedTodayItem, options?: MutationOptions) =>
      runAction(checkOffItemMutation, item, options),
    importRecurring: (listId: number, options?: MutationOptions) =>
      runAction(importRecurringMutation, listId, options),
  };
}
