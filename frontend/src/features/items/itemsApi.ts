import { apiRequest } from "@/lib/apiClient";
import { itemSchema, type Item, type ItemCreate } from "./schema";

export function createItem(payload: ItemCreate): Promise<Item> {
  return apiRequest("/items", itemSchema, { method: "POST", body: JSON.stringify(payload) });
}
