import type { Metadata } from "next";
import { bookings, customers, db, houses } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { PaymentButton } from "@/components/payment-button";
import { PublicShell } from "@/components/public-shell";
import { formatCurrency } from "@/components/currency";
import { getSession } from "@/lib/session";
import { onlinePaymentsEnabled } from "@/lib/payments";

export const metadata: Metadata = { title: "Оплата бронирования", robots: { index: false, follow: false } };

export default async function PaymentPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const session = await getSession();
  if (!session) notFound();
  const { bookingId } = await params;
  if (!onlinePaymentsEnabled()) redirect(`/oplata?bookingId=${encodeURIComponent(bookingId)}`);
  const [booking] = await db.select({
    id: bookings.id,
    publicNumber: bookings.publicNumber,
    checkIn: bookings.checkIn,
    checkOut: bookings.checkOut,
    totalAmount: bookings.totalAmount,
    paidAmount: bookings.paidAmount,
    customerName: customers.firstName,
    customerLastName: customers.lastName,
    customerEmail: customers.email,
    houseName: houses.name
  }).from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .innerJoin(houses, eq(bookings.houseId, houses.id))
    .where(and(
      eq(bookings.id, bookingId),
      eq(customers.userId, session.userId)
    ))
    .limit(1);
  if (!booking) notFound();
  const due = Math.max(0, Number(booking.totalAmount) - Number(booking.paidAmount));
  const amount = formatCurrency(due);
  return <PublicShell><section className="page-hero"><div className="container"><div className="breadcrumbs">Бронирование / Оплата</div><h1 className="page-title">Завершение бронирования</h1><p className="page-intro">Проверьте детали перед переходом на защищенную страницу оплаты.</p></div></section><section className="section"><div className="container detail-layout"><div className="form-card"><span className="eyebrow">Безопасная оплата</span><h2 style={{ font: "700 31px var(--serif)" }}>Контактные данные</h2><div className="summary-row"><span>Гость</span><strong>{booking.customerName} {booking.customerLastName}</strong></div><div className="summary-row"><span>Email</span><strong>{booking.customerEmail}</strong></div><p className="notice">После нажатия вы перейдете на страницу настроенного платежного провайдера. Данные карты не проходят через сервер усадьбы.</p>{due > 0 ? <PaymentButton bookingId={booking.id} amount={due} /> : <div className="notice">Бронирование уже оплачено.</div>}</div><aside className="booking-card"><Image src="/images/stitch/asset-022.png" width={512} height={512} alt={booking.houseName} style={{ borderRadius: 12 }} /><h2 style={{ fontFamily: "var(--serif)" }}>{booking.houseName}</h2><div className="summary-row"><span>Даты</span><strong>{booking.checkIn} — {booking.checkOut}</strong></div><div className="summary-row"><span>Номер</span><strong>{booking.publicNumber}</strong></div><div className="summary-row"><span>К оплате</span><strong>{amount}</strong></div></aside></div></section></PublicShell>;
}
