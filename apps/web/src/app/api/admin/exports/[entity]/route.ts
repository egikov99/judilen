import { bookings, customers, db, expenseCategories, expenses, houses, salesChannels, users } from "@judilen/db";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import type { Permission } from "@judilen/auth";
import { requireAllPermissions } from "@/lib/session";
import { csvExport, excelHtmlExport, simplePdfExport, type ExportRow } from "@/lib/tabular-export";
import { problem } from "@/lib/validation";

const permissions: Record<string, Permission> = {
  bookings: "bookings.read",
  customers: "customers.read",
  expenses: "expenses.read",
  reports: "reports.read"
};

export async function GET(request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const permission = permissions[entity];
  if (!permission) return problem(404, "Экспорт не найден");
  const auth = await requireAllPermissions([permission, "exports.read"]);
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const query = new URL(request.url).searchParams;
  const format = query.get("format") ?? "csv";
  if (!["csv", "xls", "pdf"].includes(format)) return problem(422, "Неподдерживаемый формат");
  const from = query.get("from");
  const to = query.get("to");
  const period = (column: typeof bookings.checkIn | typeof expenses.expenseDate) => and(
    from ? gte(column, from) : undefined,
    to ? lte(column, to) : undefined
  );
  let rows: ExportRow[];
  if (entity === "bookings") {
    const customerId = query.get("customerId");
    rows = await db.select({
      number: bookings.publicNumber,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      customer: sql<string>`${customers.firstName} || ' ' || ${customers.lastName}`,
      house: houses.name,
      total: bookings.totalAmount,
      paid: bookings.paidAmount,
      status: bookings.status,
      paymentStatus: bookings.paymentStatus,
      salesChannel: salesChannels.name
    }).from(bookings).innerJoin(customers, eq(bookings.customerId, customers.id)).innerJoin(houses, eq(bookings.houseId, houses.id)).leftJoin(salesChannels, eq(bookings.salesChannelId, salesChannels.id))
      .where(and(period(bookings.checkIn), customerId ? eq(bookings.customerId, customerId) : undefined));
  } else if (entity === "customers") {
    rows = await db.select({
      name: sql<string>`${customers.firstName} || ' ' || ${customers.lastName}`,
      email: customers.email,
      phone: customers.phone,
      registrationDate: customers.createdAt,
      bookings: count(bookings.id),
      paidTotal: sql<string>`coalesce(sum(case when ${bookings.paymentStatus} = 'paid' and ${bookings.status} not in ('cancelled','declined','blocked','import_removed') then ${bookings.paidAmount} else 0 end), 0)`
    }).from(customers).leftJoin(bookings, eq(customers.id, bookings.customerId)).groupBy(customers.id);
  } else if (entity === "expenses") {
    rows = await db.select({
      date: expenses.expenseDate,
      category: expenseCategories.name,
      house: houses.name,
      amount: expenses.amount,
      comment: expenses.comment,
      employee: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      receipt: expenses.receiptFile
    }).from(expenses).innerJoin(expenseCategories, eq(expenses.expenseCategoryId, expenseCategories.id)).leftJoin(houses, eq(expenses.houseId, houses.id)).leftJoin(users, eq(expenses.createdBy, users.id)).where(period(expenses.expenseDate));
  } else {
    const [financeRows, expenseRows, channelRows] = await Promise.all([db.select({
      paidRevenue: sql<string>`coalesce(sum(case when ${bookings.paymentStatus} = 'paid' and ${bookings.status} not in ('cancelled','declined','blocked','import_removed') then ${bookings.paidAmount} else 0 end), 0)`,
      bookings: count(bookings.id)
    }).from(bookings).where(period(bookings.checkIn)),
    db.select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).where(period(expenses.expenseDate)),
    db.select({
      channel: sql<string>`coalesce(${salesChannels.name}, 'Не указан')`,
      bookings: count(bookings.id),
      paidBookings: sql<number>`count(*) filter (where ${bookings.paymentStatus} = 'paid' and ${bookings.status} not in ('cancelled','declined','blocked','import_removed'))`,
      cancellations: sql<number>`count(*) filter (where ${bookings.status} = 'cancelled')`,
      revenue: sql<string>`coalesce(sum(case when ${bookings.paymentStatus} = 'paid' and ${bookings.status} not in ('cancelled','declined','blocked','import_removed') then ${bookings.paidAmount} else 0 end), 0)`,
      averageCheck: sql<string>`coalesce(avg(case when ${bookings.paymentStatus} = 'paid' and ${bookings.status} not in ('cancelled','declined','blocked','import_removed') and ${bookings.totalAmount} > 0 then ${bookings.totalAmount} end), 0)`
    }).from(bookings).leftJoin(salesChannels, eq(bookings.salesChannelId, salesChannels.id)).where(period(bookings.checkIn)).groupBy(salesChannels.id)
    ]);
    const finance = financeRows[0];
    const expense = expenseRows[0];
    const revenue = Number(finance?.paidRevenue ?? 0);
    const costs = Number(expense?.total ?? 0);
    rows = [
      { channel: "ИТОГО", bookings: finance?.bookings ?? 0, paidBookings: "", cancellations: "", revenue, averageCheck: "", bookingSharePercent: 100, revenueSharePercent: 100, expenses: costs, profit: revenue - costs },
      ...channelRows.map((channel) => ({
        ...channel,
        bookingSharePercent: Number(finance?.bookings) ? Math.round(Number(channel.bookings) / Number(finance?.bookings) * 10_000) / 100 : 0,
        revenueSharePercent: revenue ? Math.round(Number(channel.revenue) / revenue * 10_000) / 100 : 0
      }))
    ];
  }
  const title = `judilen-${entity}`;
  if (format === "xls") return new Response(excelHtmlExport(rows, title), { headers: { "Content-Type": "application/vnd.ms-excel; charset=utf-8", "Content-Disposition": `attachment; filename="${title}.xls"` } });
  if (format === "pdf") return new Response(simplePdfExport(rows, title), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${title}.pdf"` } });
  return new Response(csvExport(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${title}.csv"` } });
}
