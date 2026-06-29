import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8).max(128)
});

export const bookingSchema = z.object({
  houseId: z.uuid(),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  guests: z.coerce.number().int().min(1).max(20),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().max(80).default(""),
  email: z.email().max(254).transform((value) => value.toLowerCase().trim()),
  phone: z.string().trim().min(7).max(30),
  consent: z.literal(true),
  services: z.array(z.object({
    serviceId: z.uuid(),
    serviceOptionId: z.uuid().nullable().optional(),
    quantity: z.coerce.number().int().min(1).max(100)
  })).max(50).default([])
}).refine((value) => value.checkOut > value.checkIn, {
  message: "Дата выезда должна быть позже даты заезда",
  path: ["checkOut"]
});

export const houseSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  name: z.string().trim().min(2).max(120),
  shortDescription: z.string().trim().min(10).max(300),
  description: z.string().trim().min(30).max(20_000),
  guests: z.coerce.number().int().min(1).max(30),
  rooms: z.coerce.number().int().min(1).max(20),
  amenities: z.array(z.string().trim().min(1).max(80)).max(50),
  basePrice: z.coerce.number().nonnegative().max(10_000_000),
  seoTitle: z.string().trim().min(10).max(70),
  seoDescription: z.string().trim().min(30).max(180),
  isPublished: z.boolean()
});

export const serviceSchema = z.object({
  title: z.string().trim().min(2).max(140),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  description: z.string().trim().min(5).max(5000),
  imageUrl: z.string().trim().max(1000).nullable().optional(),
  basePrice: z.coerce.number().nonnegative().max(10_000_000),
  priceUnit: z.enum(["hour", "day", "booking", "person", "item"]),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(100_000),
  houseIds: z.array(z.uuid()).max(100).default([])
});

export const serviceOptionSchema = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(2000).nullable().optional(),
  price: z.coerce.number().nonnegative().max(10_000_000),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(100_000)
});

export const adminReviewSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.email().max(254).nullable().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(5).max(5000),
  houseId: z.uuid().nullable().optional(),
  bookingId: z.uuid().nullable().optional(),
  isPublished: z.boolean(),
  source: z.enum(["manual", "site", "google", "booking", "airbnb"])
});

export const houseImageSchema = z.object({
  url: z.string().trim().min(1).max(1000).optional(),
  alt: z.string().trim().min(2).max(250).optional(),
  caption: z.string().trim().max(500).nullable().optional(),
  position: z.coerce.number().int().min(0).max(100_000).optional(),
  isMain: z.boolean().optional(),
  isActive: z.boolean().optional()
});

export const bookingStatusSchema = z.enum([
  "new",
  "awaiting_confirmation",
  "confirmed",
  "awaiting_payment",
  "paid",
  "cancelled",
  "completed"
]);

export const bookingUpdateSchema = z.object({
  status: bookingStatusSchema.optional(),
  managerComment: z.string().trim().max(5000).nullable().optional(),
  cancellationReason: z.string().trim().max(1000).nullable().optional(),
  paidAmount: z.coerce.number().nonnegative().optional()
}).refine((value) => Object.keys(value).length > 0, "Нет изменений");

export function problem(status: number, title: string, detail?: unknown) {
  return Response.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "Content-Type": "application/problem+json" } }
  );
}
