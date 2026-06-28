import { bookings, customers, db } from "@judilen/db";
import { count, desc, eq, sql } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET() {
  const auth = await requirePermission("customers.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const items = await db
    .select({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      email: customers.email,
      phone: customers.phone,
      notes: customers.notes,
      bookingsCount: count(bookings.id),
      totalRevenue: sql<string>`coalesce(sum(${bookings.paidAmount}), 0)`
    })
    .from(customers)
    .leftJoin(bookings, eq(customers.id, bookings.customerId))
    .groupBy(customers.id)
    .orderBy(desc(customers.createdAt))
    .limit(500);
  return Response.json({ items });
}

