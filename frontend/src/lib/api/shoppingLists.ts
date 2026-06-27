import {
  createPlannedItem,
  listPlannedItems,
  updatePlannedItem,
  type PlannedTodayItem,
} from "@/lib/api/today";
import { fetchWithAuth, parseJsonResponse } from "@/lib/api/http";
import { z } from "zod";

export type ShoppingListStatus = "active" | "archived";
export type ShoppingListStatusFilter = ShoppingListStatus | "all";

export interface ShoppingList {
  id: number;
  user_id: number;
  name: string;
  store: string | null;
  notes: string | null;
  status: ShoppingListStatus;
  created_at: string;
}

export interface ShoppingListInput {
  name: string;
  store?: string | null;
  notes?: string | null;
}

export interface ShoppingListUpdateInput {
  name?: string;
  store?: string | null;
  notes?: string | null;
  status?: ShoppingListStatus;
}

export interface ShoppingItemInput {
  title: string;
  planned_for: string;
  notes?: string | null;
  tag?: string | null;
}

const shoppingListStatusSchema = z.enum(["active", "archived"]);
const shoppingListSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  name: z.string(),
  store: z.string().nullable(),
  notes: z.string().nullable(),
  status: shoppingListStatusSchema,
  created_at: z.string(),
});

const shoppingListsSchema = z.array(shoppingListSchema);

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
  return parseJsonResponse(response, "Unable to load shopping lists", true, shoppingListsSchema);
}

export async function getShoppingList(listId: number, signal?: AbortSignal): Promise<ShoppingList> {
  const response = await fetchWithAuth(`/api/shopping-lists/${listId}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  return parseJsonResponse(response, "Unable to load shopping list", true, shoppingListSchema);
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
  return parseJsonResponse(response, "Unable to create shopping list", false, shoppingListSchema);
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
  return parseJsonResponse(response, "Unable to update shopping list", false, shoppingListSchema);
}

export async function deleteShoppingList(listId: number): Promise<void> {
  const response = await fetchWithAuth(`/api/shopping-lists/${listId}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    await parseJsonResponse<never>(response, "Unable to delete shopping list", false);
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
  return parseJsonResponse<PlannedTodayItem[]>(response, "Unable to import recurring groceries", false);
}

export async function checkOffShoppingItem(item: PlannedTodayItem): Promise<PlannedTodayItem> {
  // PUT requires a full payload (title and planned_for are non-optional on the backend).
  const { id: _id, recurrence_series_id: _sid, ...fields } = item;
  return updatePlannedItem(item.id, { ...fields, is_done: true });
}
