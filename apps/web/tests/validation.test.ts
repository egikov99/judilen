import { describe, expect, it } from "vitest";
import { formatCurrency } from "@/lib/catalog";
import { bookingSchema, gazeboSchema, serviceSchema } from "@/lib/validation";

const validBooking = {
  houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12301",
  checkIn: "2026-07-12",
  checkOut: "2026-07-15",
  guests: 2,
  firstName: "Анна",
  lastName: "Иванова",
  email: "anna@example.com",
  phone: "+79990000000",
  consent: true
};

describe("booking validation", () => {
  it("accepts a valid booking", () => {
    expect(bookingSchema.safeParse(validBooking).success).toBe(true);
  });
  it("rejects an inverted date range", () => {
    expect(bookingSchema.safeParse({ ...validBooking, checkOut: "2026-07-11" }).success).toBe(false);
  });
  it("requires consent", () => {
    expect(bookingSchema.safeParse({ ...validBooking, consent: false }).success).toBe(false);
  });
  it("accepts selected services with options and quantity", () => {
    const parsed = bookingSchema.safeParse({
      ...validBooking,
      services: [{
        serviceId: "7a5cc1f6-8b2e-42d2-b7c9-fb29f93f1001",
        serviceOptionId: "7a5cc1f6-8b2e-42d2-b7c9-fb29f93f2001",
        quantity: 2
      }]
    });
    expect(parsed.success).toBe(true);
  });
  it("formats currency as BYN", () => {
    expect(formatCurrency(100)).toBe("100 BYN");
  });
});

describe("service validation", () => {
  const validService = {
    title: "Баня",
    slug: "banya",
    description: "Подготовленная баня с зоной отдыха.",
    basePrice: 80,
    priceUnit: "hour" as const,
    isActive: true,
    sortOrder: 10,
    houseIds: []
  };

  it("accepts rental hours and extension price", () => {
    const parsed = serviceSchema.safeParse({ ...validService, minRentalHours: 2, extensionPrice: 20 });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toMatchObject({ minRentalHours: 2, extensionPrice: 20 });
  });

  it("accepts services without rental extension fields", () => {
    const parsed = serviceSchema.safeParse(validService);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.extensionPrice).toBeUndefined();
  });

  it("rejects non-positive rental values", () => {
    expect(serviceSchema.safeParse({ ...validService, minRentalHours: 0 }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...validService, extensionPrice: -1 }).success).toBe(false);
  });
});

describe("gazebo validation", () => {
  const validGazebo = {
    title: "Лесная беседка",
    slug: "lesnaya-besedka",
    shortDescription: "Краткое описание беседки для карточки.",
    description: "Полное описание беседки, расположения и удобств для публичной страницы.",
    amenities: ["Мангал", "Свет"],
    sortOrder: 10,
    isPublished: true
  };

  it("accepts gazebo create and edit payloads", () => {
    expect(gazeboSchema.safeParse(validGazebo).success).toBe(true);
    expect(gazeboSchema.partial().safeParse({ isPublished: false, sortOrder: 20 }).success).toBe(true);
  });

  it("rejects invalid gazebo slugs", () => {
    expect(gazeboSchema.safeParse({ ...validGazebo, slug: "Bad Slug" }).success).toBe(false);
  });
});
