import { z } from "zod";

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const iconSchema = z.string().trim().regex(/^[a-z0-9-]+$/).max(50);

export const salesChannelSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  color: colorSchema,
  icon: iconSchema,
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(100_000)
});

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  color: colorSchema,
  icon: iconSchema,
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(100_000)
});

export const expenseSchema = z.object({
  expenseDate: z.iso.date(),
  amount: z.coerce.number().positive().max(100_000_000),
  expenseCategoryId: z.uuid(),
  type: z.enum(["general", "house"]),
  houseId: z.uuid().nullable().optional(),
  comment: z.string().trim().max(5000).nullable().optional(),
  receiptFile: z.string().trim().regex(/^\/api\/admin\/expense-receipts\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/).nullable().optional()
}).superRefine((value, context) => {
  if (value.type === "house" && !value.houseId) {
    context.addIssue({ code: "custom", path: ["houseId"], message: "Выберите домик" });
  }
});

export const clientNoteSchema = z.object({
  text: z.string().trim().min(1).max(10_000)
});
