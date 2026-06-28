import { describe, expect, it } from "vitest";
import { bookingSchema } from "@/lib/validation";

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
});

