import type { Metadata } from "next";
import { bookings, customers, db, houses } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { formatCurrency } from "@/components/currency";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Оплата по приезду", robots: { index: false, follow: false } };

export default async function PaymentInformationPage({ searchParams }: {
  searchParams: Promise<{ bookingId?: string }>;
}) {
  const session = await getSession();
  const { bookingId } = await searchParams;
  const conditions = bookingId ? [eq(bookings.id, bookingId)] : [];
  if (session) conditions.push(eq(customers.userId, session.userId));
  const [booking] = bookingId && session ? await db.select({
    publicNumber: bookings.publicNumber,
    checkIn: bookings.checkIn,
    checkOut: bookings.checkOut,
    totalAmount: bookings.totalAmount,
    status: bookings.status,
    houseName: houses.name
  }).from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .innerJoin(houses, eq(bookings.houseId, houses.id))
    .where(and(...conditions)).limit(1) : [];
  const status = booking?.status === "confirmed" ? "Подтверждено" : "Ожидает подтверждения";

  return <PublicShell>
    <section className="page-hero"><div className="container"><div className="breadcrumbs">Главная / Оплата</div><h1 className="page-title">Оплата по приезду</h1><p className="page-intro">Онлайн-оплата на сайте сейчас не используется. Оплата проживания и дополнительных услуг производится по приезду на базу отдыха.</p></div></section>
    <section className="section"><div className="container" style={{ maxWidth: 760 }}><div className="form-card">
      <h2 style={{ font: "700 31px var(--serif)", marginTop: 0 }}>Как проходит подтверждение</h2>
      <p>Бронирование подтверждается администратором. При необходимости администратор свяжется с вами по телефону, указанному в заявке.</p>
      <p>Контактный телефон: <a className="text-link" href="tel:+375296733546">+375 29 673 35 46</a></p>
      {booking && <div className="notice">
        <div className="summary-row"><span>Номер</span><strong>{booking.publicNumber}</strong></div>
        <div className="summary-row"><span>Домик</span><strong>{booking.houseName}</strong></div>
        <div className="summary-row"><span>Даты</span><strong>{booking.checkIn} — {booking.checkOut}</strong></div>
        <div className="summary-row"><span>Сумма</span><strong>{formatCurrency(Number(booking.totalAmount))}</strong></div>
        <div className="summary-row"><span>Статус</span><strong>{status}</strong></div>
      </div>}
      <div className="action-row" style={{ marginTop: 24 }}>{session
        ? <Link className="button button-primary" href="/cabinet/trips">Перейти в личный кабинет</Link>
        : <Link className="button button-primary" href="/">Вернуться на главную</Link>}
      </div>
    </div></div></section>
  </PublicShell>;
}
