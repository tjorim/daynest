import { useQuery } from "@tanstack/react-query";
import {
  getShoppingList,
  listShoppingItems,
  listShoppingLists,
  type ShoppingListStatusFilter,
} from "@/lib/api/shoppingLists";
import { queryKeys } from "@/lib/query/queryKeys";

export function useShoppingListsQuery(status: ShoppingListStatusFilter = "all") {
  return useQuery({
    queryKey: queryKeys.shoppingLists.list(status),
    queryFn: ({ signal }) => listShoppingLists(status, signal),
  });
}

export function useShoppingListQuery(listId: number) {
  return useQuery({
    queryKey: queryKeys.shoppingLists.detail(listId),
    queryFn: ({ signal }) => getShoppingList(listId, signal),
    enabled: Number.isFinite(listId),
  });
}

export function useShoppingItemsQuery(listId: number) {
  return useQuery({
    queryKey: queryKeys.shoppingLists.items(listId),
    queryFn: ({ signal }) => listShoppingItems(listId, signal),
    enabled: Number.isFinite(listId),
  });
}
