import { z } from "zod";

/** Mirrors backend/app/models/item.py - keep both in sync. */
export const CATEGORIES = ["GENERAL", "FOOD", "ELECTRONICS"] as const;

export const itemCreateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  category: z.enum(CATEGORIES, { message: "Select a category" }),
  quantity: z
    .number({ message: "Quantity is required" })
    .int("Whole numbers only")
    .min(0, "Cannot be negative")
    .max(100_000),
  description: z.string().trim().max(500).optional(),
});

export const itemSchema = itemCreateSchema.extend({
  id: z.string(),
  created_at: z.string(),
});

export type ItemCreate = z.infer<typeof itemCreateSchema>;
export type Item = z.infer<typeof itemSchema>;
