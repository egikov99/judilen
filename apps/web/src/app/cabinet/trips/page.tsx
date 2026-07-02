import type { Metadata } from "next";
import { bookings, customers, db, houses, reviews } from "@judilen/db";
import { desc, eq } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { SiteHeader } from "@/components/site-header";
import { formatCurrency } from "@/components/currency";
import { requireSession } from "@/lib/session";
import { onlinePaymentsEnabled } from "@/lib/payments";

export const metadata: Metadata = { title: "Мои поездки", robots: { index: false, follow: false } };

const statusLabels: Record<string, string> = {
  new: "Новая заявка", awaiting_confirmation: "Ожидает подтверждения", confirmed: "Подтверждено",
  awaiting_payment: "Ожидает оплаты", paid: "Оплачено", cancelled: "Отменено", completed: "Завершено"
};

export default async function TripsPage() {
  const session = await requireSession();
  const trips = await db.select({
    id: bookings.id,
    publicNumber: bookings.publicNumber,
    status: bookings.status,
    checkIn: bookings.checkIn,
    checkOut: bookings.checkOut,
    totalAmount: bookings.totalAmount,
    paidAmount: bookings.paidAmount,
    paymentMethod: bookings.paymentMethod,
    houseName: houses.name,
    houseSlug: houses.slug,
    reviewId: reviews.id
  }).from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .innerJoin(houses, eq(bookings.houseId, houses.id))
    .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
    .where(eq(customers.userId, session.userId))
    .orderBy(desc(bookings.checkIn));
  const today = new Date().toISOString().slice(0, 10);

  return <><SiteHeader /><main className="public-site">
    <section className="page-hero"><div className="container"><div style={{ display: "flex", justifyContent: "space-between", gap: 25, alignItems: "end" }}><div><span className="eyebrow">Личный кабинет</span><h1 className="page-title">Мои поездки</h1><p className="page-intro">Здравствуйте, {session.name}. Здесь собраны бронирования, оплаты и детали заезда.</p></div><LogoutButton /></div></div></section>
    <section className="section"><div className="container form-stack">{trips.length ? trips.map((trip) => {
      const due = Number(trip.totalAmount) - Number(trip.paidAmount);
      const canReview = trip.checkOut < today && !trip.reviewId && !["cancelled", "declined"].includes(trip.status);
      const paymentHref = onlinePaymentsEnabled() ? `/oplata/${trip.id}` : `/oplata?bookingId=${trip.id}`;
      return <article className="house-card trip-card" key={trip.id}>
        <div className="house-image"><Image src="/images/stitch/asset-021.png" alt={trip.houseName} fill sizes="300px" /></div>
        <div className="house-copy">
          <span className={`badge ${trip.status.includes("awaiting") ? "badge-warn" : ""}`}>{statusLabels[trip.status]}</span>
          <h3>{trip.houseName}</h3>
          {canReview && <div className="notice review-invitation"><strong>Спасибо, что отдыхали у нас.</strong><span>Расскажите, как прошёл ваш отдых — оставьте отзыв на сайте.</span><Link className="button button-secondary" href={`/otzyvy/novyi?booking=${encodeURIComponent(trip.publicNumber)}`}>Оставить отзыв</Link></div>}
          <div className="summary-row"><span>Заезд</span><strong>{trip.checkIn}, после 15:00</strong></div>
          <div className="summary-row"><span>Выезд</span><strong>{trip.checkOut}, до 12:00</strong></div>
          <div className="summary-row"><span>Оплата</span><strong>{trip.paymentMethod === "on_arrival" ? "По приезду" : `${formatCurrency(Number(trip.paidAmount))} из ${formatCurrency(Number(trip.totalAmount))}`}</strong></div>
          <p>Номер: {trip.publicNumber}</p>
          <div className="action-row"><Link className="button button-ghost" href={`/domiki/${trip.houseSlug}`}>О домике</Link>{due > 0 && !["cancelled", "completed"].includes(trip.status) && <Link className="button button-primary" href={paymentHref}>{onlinePaymentsEnabled() ? `Оплатить ${formatCurrency(due)}` : "Информация об оплате"}</Link>}</div>
        </div>
      </article>;
    }) : <div className="form-card"><h2 style={{ font: "700 30px var(--serif)" }}>Поездок пока нет</h2><p>Выберите домик и отправьте заявку — после подтверждения она появится здесь.</p><Link className="button button-primary" href="/domiki">Выбрать домик</Link></div>}</div></section>
  </main></>;
}
