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
  employeeId: z.uuid().nullable().optional(),
  comment: z.string().trim().max(5000).nullable().optional(),
  receiptFile: z.string().trim().regex(/^\/api\/admin\/expense-receipts\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/).nullable().optional()
}).superRefine((value, context) => {
  if (value.type === "house" && !value.houseId) {
    context.addIssue({ code: "custom", path: ["houseId"], message: "Выберите домик" });
  }
});

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional()
  .transform((value) => value || null);

export const employeeSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  position: nullableText(150),
  phone: nullableText(50),
  email: z.union([z.email().max(254), z.literal(""), z.null()]).optional().transform((value) => value || null),
  birthDate: z.union([z.iso.date(), z.literal(""), z.null()]).optional().transform((value) => value || null),
  startDate: z.union([z.iso.date(), z.literal(""), z.null()]).optional().transform((value) => value || null),
  endDate: z.union([z.iso.date(), z.literal(""), z.null()]).optional().transform((value) => value || null),
  status: z.enum(["working", "temporarily_inactive", "dismissed", "archived"]),
  comment: nullableText(5000),
  personnelNumber: nullableText(100),
  userId: z.union([z.uuid(), z.literal(""), z.null()]).optional().transform((value) => value || null),
  isActive: z.boolean()
}).superRefine((value, context) => {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    context.addIssue({ code: "custom", path: ["endDate"], message: "Дата окончания не может быть раньше даты начала" });
  }
});

export const clientNoteSchema = z.object({
  text: z.string().trim().min(1).max(10_000)
});
