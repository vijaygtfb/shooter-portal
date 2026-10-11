import { describe, expect, it } from "vitest";
import { itemCreateSchema } from "./schema";

describe("itemCreateSchema", () => {
  it("accepts a valid item", () => {
    expect(itemCreateSchema.safeParse({ name: "Milk", category: "FOOD", quantity: 3 }).success).toBe(true);
  });

  it("rejects short names, bad category and negative quantity", () => {
    const r = itemCreateSchema.safeParse({ name: "x", category: "BAD", quantity: -1 });
    expect(r.success).toBe(false);
    if (!r.success) {
      const fields = r.error.issues.map((i) => i.path[0]);
      expect(fields).toEqual(expect.arrayContaining(["name", "category", "quantity"]));
    }
  });

  it("rejects non-integer quantity", () => {
    expect(itemCreateSchema.safeParse({ name: "Milk", category: "FOOD", quantity: 1.5 }).success).toBe(false);
  });
});
