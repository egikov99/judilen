import { bookingStatusHistory, bookings, customers, db } from "@judilen/db";
import { bookingSchema, problem } from "@/lib/validation";
import { getPublishedHouses } from "@/lib/houses";

function bookingNumber() {
  const date = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().slice(0, 5);
  return `JD-${date}-${random}`;
}

export async function POST(request: Request) {
  const parsed = bookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные бронирования", parsed.error.flatten());
  const house = (await getPublishedHouses()).find((item) => item.id === parsed.data.houseId);
  if (!house) return problem(404, "Домик не найден");
  if (parsed.data.guests > house.guests) return problem(422, "Количество гостей превышает вместимость домика");
  const nights = Math.ceil((Date.parse(parsed.data.checkOut) - Date.parse(parsed.data.checkIn)) / 86_400_000);
  const publicNumber = bookingNumber();
  try {
    await db.transaction(async (tx) => {
      const [customer] = await tx.insert(customers).values({
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone
      }).onConflictDoUpdate({
        target: customers.email,
        set: {
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          phone: parsed.data.phone,
          updatedAt: new Date()
        }
      }).returning({ id: customers.id });
      const [booking] = await tx.insert(bookings).values({
        publicNumber,
        houseId: house.id,
        customerId: customer.id,
        checkIn: parsed.data.checkIn,
        checkOut: parsed.data.checkOut,
        guests: parsed.data.guests,
        status: "awaiting_confirmation",
        totalAmount: String(nights * house.price)
      }).returning({ id: bookings.id });
      await tx.insert(bookingStatusHistory).values({
        bookingId: booking.id,
        toStatus: "awaiting_confirmation",
        comment: "Заявка создана на публичном сайте"
      });
    });
    return Response.json({ publicNumber, status: "awaiting_confirmation" }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23P01") return problem(409, "Даты уже заняты", "Выберите другой период");
    console.error("booking_create_failed", { publicNumber, error });
    return problem(500, "Не удалось создать бронирование");
  }
}
