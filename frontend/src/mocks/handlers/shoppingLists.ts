import { http, HttpResponse } from "msw";
import { getMockState, mutatePlannedItems } from "../data/state";
import { nextPlannedItemId } from "../data/plannedItems";
import type {
  ShoppingList,
  ShoppingListInput,
  ShoppingListUpdateInput,
} from "@/lib/api/shoppingLists";

let nextShoppingListId = 3;
const shoppingLists: ShoppingList[] = [
  {
    id: 1,
    user_id: 1,
    name: "Weekly groceries",
    store: "Market",
    notes: "Restock basics for the week.",
    status: "active",
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    user_id: 1,
    name: "Hardware run",
    store: "DIY Store",
    notes: null,
    status: "archived",
    created_at: new Date().toISOString(),
  },
];

export function addMockShoppingList(input: ShoppingListInput): ShoppingList {
  const list: ShoppingList = {
    id: nextShoppingListId++,
    user_id: 1,
    name: input.name,
    store: input.store ?? null,
    notes: input.notes ?? null,
    status: "active",
    created_at: new Date().toISOString(),
  };
  shoppingLists.unshift(list);
  return list;
}

export const shoppingListHandlers = [
  http.get("/api/shopping-lists", ({ request }) => {
    const status = new URL(request.url).searchParams.get("status") ?? "active";
    const payload =
      status === "all" ? shoppingLists : shoppingLists.filter((list) => list.status === status);
    return HttpResponse.json(payload);
  }),
  http.get("/api/shopping-lists/:listId", ({ params }) => {
    const list = shoppingLists.find((item) => item.id === Number(params.listId));
    return list ? HttpResponse.json(list) : new HttpResponse(null, { status: 404 });
  }),
  http.post("/api/shopping-lists", async ({ request }) => {
    const input = (await request.json()) as ShoppingListInput;
    return HttpResponse.json(addMockShoppingList(input), { status: 201 });
  }),
  http.put("/api/shopping-lists/:listId", async ({ params, request }) => {
    const index = shoppingLists.findIndex((item) => item.id === Number(params.listId));
    if (index < 0) return new HttpResponse(null, { status: 404 });
    const input = (await request.json()) as ShoppingListUpdateInput;
    const existing = shoppingLists[index]!;
    shoppingLists[index] = {
      ...existing,
      name: input.name ?? existing.name,
      store: "store" in input ? (input.store ?? null) : existing.store,
      notes: "notes" in input ? (input.notes ?? null) : existing.notes,
      status: input.status ?? existing.status,
    };
    return HttpResponse.json(shoppingLists[index]);
  }),
  http.post("/api/shopping-lists/:listId/import-recurring", ({ params }) => {
    const listId = Number(params.listId);
    const { plannedItems } = getMockState();
    const uniqueSeries = new Map<string, (typeof plannedItems)[number]>();
    for (const item of plannedItems) {
      if (item.module_key === "recurring_grocery" && item.auto_add_to_list_id === listId) {
        const key = item.recurrence_series_id != null ? String(item.recurrence_series_id) : `item-${item.id}`;
        if (!uniqueSeries.has(key)) {
          uniqueSeries.set(key, item);
        }
      }
    }
    const imported = Array.from(uniqueSeries.values()).map((item) => ({
      ...item,
      id: nextPlannedItemId(),
      module_key: "shopping_list" as const,
      linked_source: "shopping_list",
      linked_ref: String(listId),
      recurrence_series_id: item.recurrence_series_id,
      rrule: item.rrule,
      recurrence_hint: item.recurrence_hint,
      auto_add_to_list_id: item.auto_add_to_list_id,
      is_done: false,
    }));
    mutatePlannedItems((items) => [...items, ...imported]);
    return HttpResponse.json(imported);
  }),
  http.delete("/api/shopping-lists/:listId", ({ params }) => {
    const index = shoppingLists.findIndex((item) => item.id === Number(params.listId));
    if (index < 0) return new HttpResponse(null, { status: 404 });
    shoppingLists.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
