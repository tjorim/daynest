import { queryOptions, useQuery } from "@tanstack/react-query";
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

// Shared by the /shopping/$listId route loader (to prefetch) and
// ShoppingListDetail (to read the cached result) so both stay in sync.
export function shoppingListQueryOptions(listId: number) {
  return queryOptions({
    queryKey: queryKeys.shoppingLists.detail(listId),
    queryFn: ({ signal }) => getShoppingList(listId, signal),
    enabled: Number.isFinite(listId),
  });
}

export function shoppingItemsQueryOptions(listId: number) {
  return queryOptions({
    queryKey: queryKeys.shoppingLists.items(listId),
    queryFn: ({ signal }) => listShoppingItems(listId, signal),
    enabled: Number.isFinite(listId),
  });
}

export function useShoppingListQuery(listId: number) {
  return useQuery(shoppingListQueryOptions(listId));
}

export function useShoppingItemsQuery(listId: number) {
  return useQuery(shoppingItemsQueryOptions(listId));
}
