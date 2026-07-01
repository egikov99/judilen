import type { Metadata } from "next";
import { bookings, customers, db, payments } from "@judilen/db";
import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { getSession } from "@/lib/session";
import { formatCurrency } from "@/components/currency";

export const metadata: Metadata = { title: "Статус оплаты", robots: { index: false, follow: false } };
export default async function PaymentSuccessPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const session = await getSession();
  if (!session) notFound();
  const { bookingId } = await params;
  const conditions = [eq(bookings.id, bookingId)];
  if (session.role === "client") conditions.push(eq(customers.userId, session.userId));
  const [row] = await db.select({
    publicNumber: bookings.publicNumber,
    totalAmount: bookings.totalAmount,
    paidAmount: bookings.paidAmount,
    paymentStatus: payments.status
  }).from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .leftJoin(payments, eq(payments.bookingId, bookings.id))
    .where(and(...conditions))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  if (!row) notFound();
  const paid = row.paymentStatus === "paid" || Number(row.paidAmount) >= Number(row.totalAmount);
  return <PublicShell><section className="section"><div className="container" style={{ maxWidth: 700, textAlign: "center" }}><div style={{ display: "grid", placeItems: "center", width: 80, height: 80, borderRadius: "50%", background: paid ? "var(--sage-200)" : "var(--terracotta-light)", color: paid ? "var(--forest-900)" : "var(--terracotta)", fontSize: 38, margin: "0 auto 25px" }}>{paid ? "✓" : "…"}</div><span className="eyebrow">{paid ? "Оплата подтверждена" : "Оплата обрабатывается"}</span><h1 className="page-title">{paid ? "До встречи в «Юдилен»" : "Проверяем платеж"}</h1><p className="page-intro" style={{ marginInline: "auto" }}>{paid ? "Чек и детали заезда отправлены на email." : "Статус обновится после подтвержденного webhook платежного провайдера."}</p><div className="form-card" style={{ textAlign: "left", margin: "35px 0" }}><div className="summary-row"><span>Номер бронирования</span><strong>{row.publicNumber}</strong></div><div className="summary-row"><span>Сумма</span><strong>{formatCurrency(Number(row.totalAmount))}</strong></div><div className="summary-row"><span>Статус</span><strong>{row.paymentStatus ?? "не создан"}</strong></div></div><Link className="button button-primary" href="/cabinet/trips">Перейти к поездкам</Link></div></section></PublicShell>;
}
