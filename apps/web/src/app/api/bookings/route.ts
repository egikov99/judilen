import { bookingServices, bookingStatusHistory, bookings, customers, db } from "@judilen/db";
import { findOverlappingBooking } from "@/lib/booking-availability-db";
import { hasDatabaseErrorCode } from "@/lib/booking-availability";
import { bookingSchema, problem } from "@/lib/validation";
import { getPublishedHouses } from "@/lib/houses";
import { getActiveServicesByIds } from "@/lib/services";

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
  if (await findOverlappingBooking(house.id, parsed.data.checkIn, parsed.data.checkOut)) {
    return problem(409, "Домик уже занят на выбранные даты", "Выберите другой домик или период");
  }
  const nights = Math.ceil((Date.parse(parsed.data.checkOut) - Date.parse(parsed.data.checkIn)) / 86_400_000);
  const activeServices = await getActiveServicesByIds([...new Set(parsed.data.services.map((item) => item.serviceId))], house.id);
  let invalidService = false;
  const serviceLines = parsed.data.services.map((line) => {
    const service = activeServices.find((item) => item.id === line.serviceId);
    if (!service) {
      invalidService = true;
      return null;
    }
    const option = line.serviceOptionId
      ? service.options.find((item) => item.id === line.serviceOptionId)
      : service.options.find((item) => item.isDefault) ?? service.options[0];
    const unitPrice = option ? option.price : service.basePrice;
    return {
      serviceId: service.id,
      serviceOptionId: option?.id ?? null,
      quantity: line.quantity,
      unitPrice,
      totalPrice: unitPrice * line.quantity
    };
  }).filter((line) => line !== null);
  if (invalidService) return problem(422, "Выбранная услуга недоступна для этого домика");
  const servicesTotal = serviceLines.reduce((sum, line) => sum + line.totalPrice, 0);
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
        totalAmount: String(nights * house.price + servicesTotal)
      }).returning({ id: bookings.id });
      if (serviceLines.length) {
        await tx.insert(bookingServices).values(serviceLines.map((line) => ({
          bookingId: booking.id,
          serviceId: line.serviceId,
          serviceOptionId: line.serviceOptionId,
          quantity: line.quantity,
          unitPrice: String(line.unitPrice),
          totalPrice: String(line.totalPrice)
        })));
      }
      await tx.insert(bookingStatusHistory).values({
        bookingId: booking.id,
        toStatus: "awaiting_confirmation",
        comment: "Заявка создана на публичном сайте"
      });
    });
    return Response.json({ publicNumber, status: "awaiting_confirmation" }, { status: 201 });
  } catch (error) {
    if (hasDatabaseErrorCode(error, "23P01")) {
      return problem(409, "Домик уже занят на выбранные даты", "Выберите другой домик или период");
    }
    console.error("booking_create_failed", { publicNumber, error });
    return problem(500, "Не удалось создать бронирование");
  }
}
