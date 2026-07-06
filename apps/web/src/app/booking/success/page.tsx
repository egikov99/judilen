import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { bookings, customers, db, houses } from "@judilen/db";
import { eq } from "drizzle-orm";
import { formatCurrency } from "@/components/currency";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Спасибо за бронирование — База отдыха «Юдилен»",
  description: "Спасибо за оформление бронирования. Мы получили вашу заявку и скоро свяжемся с вами.",
  alternates: { canonical: "/booking/success" }
};

export default async function BookingSuccessPage({ searchParams }: { searchParams?: { bookingId?: string } }) {
  const session = await getSession();
  const bookingId = searchParams?.bookingId;

  let booking: {
    publicNumber?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    totalAmount?: string;
    status?: string;
    houseName?: string;
    email?: string;
  } | null = null;

  if (bookingId) {
    const [row] = await db.select({
      publicNumber: bookings.publicNumber,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      guests: bookings.guests,
      totalAmount: bookings.totalAmount,
      status: bookings.status,
      email: customers.email,
      houseName: houses.name
    }).from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .innerJoin(houses, eq(bookings.houseId, houses.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);
    if (row) booking = row;
  }

  return (
    <PublicShell>
      <section className="section booking-success-section" style={{ paddingTop: 36, paddingBottom: 60 }}>
        <div className="container">
          <div className="hero" style={{ textAlign: "center" }}>
            <div className="video-wrap" aria-hidden={!booking}>
              <video
                className="booking-success-video"
                src="/images/booking-success/animation.mp4"
                autoPlay
                muted
                playsInline
                loop
                preload="metadata"
                aria-label="Анимация: рыбак вытягивает рыбу"
              />
            </div>
            <span className="eyebrow">Спасибо!</span>
            <h1 className="page-title">Бронирование успешно отправлено!</h1>
            <p className="page-intro" style={{ maxWidth: 720, margin: "0 auto 20px" }}>
              Мы получили вашу заявку на бронирование. В ближайшее время администратор базы отдыха свяжется с вами для подтверждения деталей бронирования.
              После подтверждения бронирование станет активным.
            </p>
          </div>

          <div className="grid" style={{ gap: 28, display: "grid", gridTemplateColumns: "1fr 360px", alignItems: "start" }}>
            <div>
              <article className="form-card" style={{ marginBottom: 20, animationDelay: "120ms" }}>
                <h2>📧 Подробная информация отправлена на email</h2>
                <p>
                  Если письмо не появилось в течение нескольких минут, пожалуйста, проверьте папку «Спам».
                </p>
                {booking?.email || session?.email ? (
                  <p className="notice">Отправлено на: <strong>{booking?.email ?? session.email}</strong></p>
                ) : null}
              </article>

              <article className="form-card timeline" style={{ animationDelay: "200ms" }}>
                <h3>Что будет дальше</h3>
                <ol className="timeline-list">
                  <li><span className="timeline-icon">✅</span><div><strong>Заявка успешно получена</strong><p className="muted">Мы получили ваш запрос</p></div></li>
                  <li><span className="timeline-icon">☎️</span><div><strong>Мы свяжемся с вами</strong><p className="muted">Уточним детали бронирования</p></div></li>
                  <li><span className="timeline-icon">🏡</span><div><strong>Подтвердим бронирование</strong><p className="muted">После подтверждения бронь станет активной</p></div></li>
                  <li><span className="timeline-icon">🎣</span><div><strong>Ждём вас на базе отдыха «Юдилен»</strong><p className="muted">Увидимся скоро!</p></div></li>
                </ol>
              </article>

              {booking ? (
                <article className="form-card" style={{ marginTop: 18, animationDelay: "280ms" }}>
                  <h3>Карточка бронирования</h3>
                  <div className="summary-row"><span>Домик</span><strong>{booking.houseName ?? "—"}</strong></div>
                  <div className="summary-row"><span>Даты</span><strong>{booking.checkIn} — {booking.checkOut}</strong></div>
                  <div className="summary-row"><span>Гости</span><strong>{booking.guests ?? "—"}</strong></div>
                  <div className="summary-row"><span>Итоговая стоимость</span><strong>{booking.totalAmount ? formatCurrency(Number(booking.totalAmount)) : "—"}</strong></div>
                  <div className="summary-row"><span>Статус</span><strong>{booking.status ?? "Ожидает подтверждения"}</strong></div>
                </article>
              ) : null}

              <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
                <Link className="button button-ghost" href="/">Вернуться на главную</Link>
                <Link className="button button-ghost" href="/domiki">Посмотреть домики</Link>
                {session ? <Link className="button button-primary" href="/cabinet/trips">Мои бронирования</Link> : <Link className="button button-primary" href="/login">Перейти в личный кабинет</Link>}
              </div>

            </div>

            <aside>
              <div className="form-card" style={{ animationDelay: "140ms" }}>
                <h3>Есть вопросы?</h3>
                <p>Позвоните нам или напишите через онлайн-чат.</p>
                <div className="action-row" style={{ marginTop: 12 }}>
                  <a className="button button-ghost" href="tel:+375296733546">Позвонить</a>
                  <button className="button button-primary" type="button" onClick={() => window?.postMessage?.({ type: "open-chat" }, "*")}>Написать в чат</button>
                </div>
              </div>

              <div style={{ height: 12 }} />
              <div className="form-card">
                <h4>Полезно знать</h4>
                <p className="muted">Проверьте почту и номер телефона — мы свяжемся для подтверждения. Если нужно срочно — звоните.</p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
