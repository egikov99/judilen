import type { Metadata } from "next";
import { bookingDocuments, bookingServices, bookings, customers, db, houseImages, houses, reviews, serviceOptions, services } from "@judilen/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { SiteHeader } from "@/components/site-header";
import { formatCurrency } from "@/components/currency";
import { WebsiteChat } from "@/components/website-chat";
import { PublicImage } from "@/components/public-image";
import { DEFAULT_IMAGE_URL, normalizeImageUrl } from "@/lib/image-urls";
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
    houseImage: houseImages.url,
    reviewId: reviews.id
  }).from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .innerJoin(houses, eq(bookings.houseId, houses.id))
    .leftJoin(houseImages, and(eq(houseImages.houseId, houses.id), eq(houseImages.isMain, true), eq(houseImages.isActive, true)))
    .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
    .where(eq(customers.userId, session.userId))
    .orderBy(desc(bookings.checkIn));
  const [serviceRows, documentRows] = trips.length ? await Promise.all([db.select({
    bookingId: bookingServices.bookingId,
    title: services.title,
    optionTitle: serviceOptions.title,
    quantity: bookingServices.quantity,
    totalPrice: bookingServices.totalPrice
  }).from(bookingServices).innerJoin(services, eq(bookingServices.serviceId, services.id))
    .leftJoin(serviceOptions, eq(bookingServices.serviceOptionId, serviceOptions.id))
    .where(inArray(bookingServices.bookingId, trips.map((trip) => trip.id))),
  db.select({ id: bookingDocuments.id, bookingId: bookingDocuments.bookingId, title: bookingDocuments.title, mimeType: bookingDocuments.mimeType })
    .from(bookingDocuments).where(inArray(bookingDocuments.bookingId, trips.map((trip) => trip.id)))
  ]) : [[], []];
  const today = new Date().toISOString().slice(0, 10);

  return <><SiteHeader /><main className="public-site">
    <section className="page-hero"><div className="container"><div style={{ display: "flex", justifyContent: "space-between", gap: 25, alignItems: "end" }}><div><span className="eyebrow">Личный кабинет</span><h1 className="page-title">Мои поездки</h1><p className="page-intro">Здравствуйте, {session.name}. Здесь собраны бронирования, оплаты и детали заезда.</p></div><LogoutButton /></div></div></section>
    <section className="section"><div className="container form-stack">
      <section className="form-card account-chat-card"><span className="eyebrow">Поддержка</span><h2>Чат с администратором</h2><p>Продолжите переписку с сотрудниками базы отдыха.</p><WebsiteChat isOpen variant="account" /></section>
      {trips.length ? trips.map((trip) => {
      const due = Number(trip.totalAmount) - Number(trip.paidAmount);
      const canReview = trip.checkOut < today && !trip.reviewId && !["cancelled", "declined"].includes(trip.status);
      const paymentHref = onlinePaymentsEnabled() ? `/oplata/${trip.id}` : `/oplata?bookingId=${trip.id}`;
      return <article className="house-card trip-card" key={trip.id}>
        <div className="house-image"><PublicImage src={normalizeImageUrl(trip.houseImage) ?? DEFAULT_IMAGE_URL} context={`account-booking:${trip.id}`} alt={trip.houseName} fill sizes="300px" /></div>
        <div className="house-copy">
          <span className={`badge ${trip.status.includes("awaiting") ? "badge-warn" : ""}`}>{statusLabels[trip.status]}</span>
          <h3>{trip.houseName}</h3>
          {canReview && <div className="notice review-invitation"><strong>Спасибо, что отдыхали у нас.</strong><span>Расскажите, как прошёл ваш отдых — оставьте отзыв на сайте.</span><Link className="button button-secondary" href={`/otzyvy/novyi?booking=${encodeURIComponent(trip.publicNumber)}`}>Оставить отзыв</Link></div>}
          <div className="summary-row"><span>Заезд</span><strong>{trip.checkIn}, после 15:00</strong></div>
          <div className="summary-row"><span>Выезд</span><strong>{trip.checkOut}, до 12:00</strong></div>
          <div className="summary-row"><span>Оплата</span><strong>{trip.paymentMethod === "on_arrival" ? "По приезду" : `${formatCurrency(Number(trip.paidAmount))} из ${formatCurrency(Number(trip.totalAmount))}`}</strong></div>
          {!!serviceRows.filter((service) => service.bookingId === trip.id).length && <div className="trip-services"><strong>Услуги</strong>{serviceRows.filter((service) => service.bookingId === trip.id).map((service) => <div className="summary-row" key={`${service.bookingId}:${service.title}:${service.optionTitle}`}><span>{service.title}{service.optionTitle ? ` · ${service.optionTitle}` : ""} × {service.quantity}</span><strong>{formatCurrency(Number(service.totalPrice))}</strong></div>)}</div>}
          {!!documentRows.filter((document) => document.bookingId === trip.id).length && <div className="trip-documents"><strong>Документы</strong><div className="button-row">{documentRows.filter((document) => document.bookingId === trip.id).map((document) => <a className="button button-ghost" href={`/api/account/documents/${document.id}`} target="_blank" key={document.id}>{document.title}</a>)}</div></div>}
          <p>Номер: {trip.publicNumber}</p>
          <div className="action-row"><Link className="button button-ghost" href={`/domiki/${trip.houseSlug}`}>О домике</Link>{due > 0 && !["cancelled", "completed"].includes(trip.status) && <Link className="button button-primary" href={paymentHref}>{onlinePaymentsEnabled() ? `Оплатить ${formatCurrency(due)}` : "Информация об оплате"}</Link>}</div>
        </div>
      </article>;
    }) : <div className="form-card"><h2 style={{ font: "700 30px var(--serif)" }}>Поездок пока нет</h2><p>Выберите домик и отправьте заявку — после подтверждения она появится здесь.</p><Link className="button button-primary" href="/domiki">Выбрать домик</Link></div>}</div></section>
  </main></>;
}
