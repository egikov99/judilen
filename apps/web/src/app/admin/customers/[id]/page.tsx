import Link from "next/link";
import { bookings, clientNotes, customers, db, houses, salesChannels, users } from "@judilen/db";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ClientNotesManager } from "@/components/admin/client-notes-manager";
import { CustomerTabs } from "@/components/admin/customer-tabs";
import { formatCurrency } from "@/components/currency";
import { requirePageAccess } from "@/lib/session";

export default async function CustomerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requirePageAccess("customers.read");
  const { id } = await params;
  const [customer] = await db.select({
    id: customers.id, firstName: customers.firstName, lastName: customers.lastName,
    email: customers.email, phone: customers.phone, createdAt: customers.createdAt,
    userId: customers.userId, lastLoginAt: users.lastLoginAt
  }).from(customers).leftJoin(users, eq(customers.userId, users.id)).where(eq(customers.id, id)).limit(1);
  if (!customer) notFound();
  const bookingRows = await db.select({
    id: bookings.id, publicNumber: bookings.publicNumber, checkIn: bookings.checkIn, checkOut: bookings.checkOut,
    totalAmount: bookings.totalAmount, paidAmount: bookings.paidAmount, paymentStatus: bookings.paymentStatus,
    status: bookings.status, managerComment: bookings.managerComment, houseName: houses.name,
    channelName: salesChannels.name
  }).from(bookings).innerJoin(houses, eq(bookings.houseId, houses.id)).leftJoin(salesChannels, eq(bookings.salesChannelId, salesChannels.id))
    .where(eq(bookings.customerId, id)).orderBy(desc(bookings.checkIn));
  const paid = bookingRows.filter((booking) => booking.paymentStatus === "paid" && !["cancelled", "declined", "blocked", "import_removed"].includes(booking.status));
  const paidTotal = paid.reduce((sum, booking) => sum + Number(booking.paidAmount), 0);
  const houseCounts = new Map<string, number>();
  for (const booking of bookingRows) houseCounts.set(booking.houseName, (houseCounts.get(booking.houseName) ?? 0) + 1);
  const favoriteHouse = [...houseCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const notes = access.permissions.includes("client_notes.read") ? await db.select({
    id: clientNotes.id, text: clientNotes.text, createdAt: clientNotes.createdAt, updatedAt: clientNotes.updatedAt,
    authorFirstName: users.firstName, authorLastName: users.lastName
  }).from(clientNotes).leftJoin(users, eq(clientNotes.authorId, users.id)).where(eq(clientNotes.clientId, id)).orderBy(desc(clientNotes.createdAt)) : [];
  const general = <><div className="stat-grid"><div className="stat-card"><div className="stat-label">Бронирований</div><div className="stat-value">{bookingRows.length}</div></div><div className="stat-card"><div className="stat-label">Оплачено</div><div className="stat-value">{formatCurrency(paidTotal)}</div></div><div className="stat-card"><div className="stat-label">Средний чек</div><div className="stat-value">{formatCurrency(paid.length ? paidTotal / paid.length : 0)}</div></div><div className="stat-card"><div className="stat-label">Любимый домик</div><div className="stat-value stat-value-text">{favoriteHouse}</div></div></div><section className="panel"><h2>Общая информация</h2><div className="summary-row"><span>Имя</span><strong>{customer.firstName} {customer.lastName}</strong></div><div className="summary-row"><span>Телефон</span><strong>{customer.phone}</strong></div><div className="summary-row"><span>Email</span><strong>{customer.email}</strong></div><div className="summary-row"><span>Дата регистрации</span><strong>{customer.createdAt.toLocaleDateString("ru-RU")}</strong></div><div className="summary-row"><span>Последний вход</span><strong>{customer.lastLoginAt?.toLocaleString("ru-RU") ?? "—"}</strong></div><div className="summary-row"><span>Последнее бронирование</span><strong>{bookingRows[0]?.checkIn ?? "—"}</strong></div></section></>;
  const history = <section className="panel"><div className="section-heading compact-heading"><h2>История бронирований</h2><a className="button button-ghost" href={`/api/admin/exports/bookings?format=xls&customerId=${id}`}>Excel</a></div><table className="data-table"><thead><tr><th>Номер</th><th>Дата</th><th>Домик</th><th>Стоимость</th><th>Статус</th><th>Оплата</th><th>Канал</th><th>Комментарий</th></tr></thead><tbody>{bookingRows.map((booking) => <tr key={booking.id}><td>{booking.publicNumber}</td><td>{booking.checkIn} — {booking.checkOut}</td><td>{booking.houseName}</td><td>{formatCurrency(Number(booking.totalAmount))}</td><td>{booking.status}</td><td>{booking.paymentStatus}</td><td>{booking.channelName ?? "—"}</td><td>{booking.managerComment ?? "—"}</td></tr>)}</tbody></table></section>;
  const notePanel = access.permissions.includes("client_notes.read") ? <ClientNotesManager clientId={id} initialNotes={notes.map((note) => ({ id: note.id, text: note.text, createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString(), authorName: `${note.authorFirstName ?? ""} ${note.authorLastName ?? ""}`.trim() || "Система" }))} canWrite={access.permissions.includes("client_notes.write")} /> : undefined;
  return <main className="admin-content"><div className="breadcrumbs"><Link href="/admin/customers">Клиенты</Link> / {customer.firstName} {customer.lastName}</div><h1 className="admin-title">{customer.firstName} {customer.lastName}</h1><p className="admin-subtitle">{customer.email} · {customer.phone}</p><CustomerTabs general={general} bookings={history} notes={notePanel} /></main>;
}
