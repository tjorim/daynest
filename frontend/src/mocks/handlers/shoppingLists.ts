import { http, HttpResponse } from "msw";
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
    return HttpResponse.json(list, { status: 201 });
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
  http.delete("/api/shopping-lists/:listId", ({ params }) => {
    const index = shoppingLists.findIndex((item) => item.id === Number(params.listId));
    if (index < 0) return new HttpResponse(null, { status: 404 });
    shoppingLists.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
