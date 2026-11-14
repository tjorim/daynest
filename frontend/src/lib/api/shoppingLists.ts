import { createPlannedItem, listPlannedItems, updatePlannedItem } from "@/lib/api/today";
import { fetchWithAuth, parseJsonResponse } from "@/lib/api/http";
import type {
  PlannedTodayItem,
  ShoppingList,
  ShoppingListInput,
  ShoppingListStatus,
  ShoppingListUpdateInput,
} from "@/api-types";
import * as m from "@/paraglide/messages";

export type ShoppingListStatusFilter = ShoppingListStatus | "all";

/** A shopping item as the screen collects it; it is stored as a planned item. */
export interface ShoppingItemInput {
  title: string;
  planned_for: string;
  notes?: string | null;
  tag?: string | null;
}

export async function listShoppingLists(
  status: ShoppingListStatusFilter = "active",
  signal?: AbortSignal,
): Promise<ShoppingList[]> {
  const params = new URLSearchParams();
  params.set("status", status);
  const response = await fetchWithAuth(`/api/shopping-lists?${params.toString()}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse<ShoppingList[]>(response, m.api_shopping_lists_load_failed(), true);
}

export async function getShoppingList(listId: number, signal?: AbortSignal): Promise<ShoppingList> {
  const response = await fetchWithAuth(`/api/shopping-lists/${listId}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse<ShoppingList>(response, m.api_shopping_list_load_failed(), true);
}

export async function createShoppingList(input: ShoppingListInput): Promise<ShoppingList> {
  const response = await fetchWithAuth("/api/shopping-lists", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<ShoppingList>(response, m.api_shopping_list_create_failed(), false);
}

export async function updateShoppingList(
  listId: number,
  input: ShoppingListUpdateInput,
): Promise<ShoppingList> {
  const response = await fetchWithAuth(`/api/shopping-lists/${listId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<ShoppingList>(response, m.api_shopping_list_update_failed(), false);
}

export async function deleteShoppingList(listId: number): Promise<void> {
  const response = await fetchWithAuth(`/api/shopping-lists/${listId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    await parseJsonResponse<never>(response, m.api_shopping_list_delete_failed(), false);
  }
}

export async function listShoppingItems(
  listId: number,
  signal?: AbortSignal,
): Promise<PlannedTodayItem[]> {
  const items = await listPlannedItems(undefined, undefined, signal);
  return items.filter(
    (item) => item.module_key === "shopping_list" && item.linked_ref === String(listId),
  );
}

export async function addShoppingItem(
  listId: number,
  input: ShoppingItemInput,
): Promise<PlannedTodayItem> {
  const tag = input.tag?.trim();
  return createPlannedItem({
    title: input.title,
    planned_for: input.planned_for,
    notes: input.notes ?? null,
    module_key: "shopping_list",
    linked_source: "shopping_list",
    linked_ref: String(listId),
    tags: tag ? [tag] : [],
  });
}

export async function importRecurringGroceries(listId: number): Promise<PlannedTodayItem[]> {
  const response = await fetchWithAuth(`/api/shopping-lists/${listId}/import-recurring`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  return parseJsonResponse<PlannedTodayItem[]>(
    response,
    m.api_recurring_groceries_import_failed(),
    false,
  );
}

export async function checkOffShoppingItem(item: PlannedTodayItem): Promise<PlannedTodayItem> {
  // PUT requires a full payload (title and planned_for are non-optional on the backend).
  const { id: _id, recurrence_series_id: _sid, ...fields } = item;
  return updatePlannedItem(item.id, { ...fields, is_done: true });
}
