// Stage 4 — the recipe. Every record must match this shape before it is
// allowed into output/books.json. Anything that fails goes to errors.json instead.

import { z } from "zod";

export const BookRecordSchema = z.object({
  title: z.string().min(1, "title is empty"),
  product_url: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), "product_url must be https"),
  price_gbp: z.number().positive("price_gbp must be a positive number"),
  price_text: z.string().min(1),
  availability_text: z.string().min(1),
  in_stock: z.boolean(),
  rating_text: z.enum(["One", "Two", "Three", "Four", "Five"], {
    errorMap: () => ({ message: "rating_text must be one of One..Five" }),
  }),
  rating_out_of_5: z.number().int().min(1).max(5),
  description: z.string().nullable(),
  source_page: z.string().url(),
  fetched_at: z.string().datetime({ message: "fetched_at must be ISO 8601" }),
});
