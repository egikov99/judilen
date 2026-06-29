import Image from "next/image";
import Link from "next/link";
import { BookingSearch } from "@/components/booking-search";
import { HouseCard } from "@/components/house-card";
import { PublicShell } from "@/components/public-shell";
import { formatCurrency } from "@/lib/catalog";
import { getPublishedHouses } from "@/lib/houses";
import { getPublishedReviews, getPublishedReviewStats } from "@/lib/reviews";
import { getPublicServices, priceUnitLabels } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [houses, reviews, reviewStats, services] = await Promise.all([
    getPublishedHouses(),
    getPublishedReviews(),
    getPublishedReviewStats(),
    getPublicServices()
  ]);
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: "Усадьба «Юдилен»",
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    image: "/images/stitch/asset-025.png",
    telephone: "+375 29 555-35-35",
    priceRange: "BYN",
    ...(reviewStats.count ? { aggregateRating: { "@type": "AggregateRating", ratingValue: String(reviewStats.average), reviewCount: String(reviewStats.count) } } : {})
  };
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
      <section className="hero">
        <div className="hero-content">
          <div className="kicker">Природа. Тишина. Забота.</div>
          <h1>Побег в сердце природы</h1>
          <p>Премиальный отдых среди хвойного леса. Пространство, где время замедляется, а главное снова становится заметным.</p>
          <Link className="button button-light" href="#booking">Выбрать даты ↓</Link>
        </div>
      </section>
      <div className="booking-strip" id="booking"><BookingSearch /></div>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div><span className="eyebrow">Ваш дом в лесу</span><h2>Домики для тишины и близких</h2></div>
            <p>Каждый дом спроектирован так, чтобы лес оставался главным героем, а бытовые детали не отвлекали от отдыха.</p>
          </div>
          <div className="house-grid">{houses.map((house) => <HouseCard key={house.slug} house={house} />)}</div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container split">
          <div className="split-image" role="img" aria-label="Вид на лесное озеро из домика" />
          <div>
            <span className="eyebrow">Философия усадьбы</span>
            <h2 className="page-title">Комфорт, который не спорит с природой</h2>
            <p className="page-intro">Мы убрали лишнее и оставили то, что действительно помогает отдыхать: натуральные материалы, чистый воздух, приватность и внимательный сервис.</p>
            <div className="feature-list">
              <div className="feature"><span className="feature-icon">⌂</span><div><h3>Продуманные дома</h3><p>Тепло в любой сезон, удобные кухни и качественный сон.</p></div></div>
              <div className="feature"><span className="feature-icon">♧</span><div><h3>Лес рядом</h3><p>Маршруты начинаются от порога, без машин и шума.</p></div></div>
              <div className="feature"><span className="feature-icon">♡</span><div><h3>Забота без навязчивости</h3><p>Команда рядом, когда нужна, и незаметна в остальное время.</p></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading"><div><span className="eyebrow">Отзывы гостей</span><h2>Сюда хочется вернуться</h2></div><Link className="text-link" href="/otzyvy">Все отзывы →</Link></div>
          {reviews.length ? <div className="review-grid">{reviews.slice(0, 3).map((review) => <article className="review-card" key={review.id}><div className="stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div><blockquote>«{review.text}»</blockquote><div className="review-byline"><strong>{review.customerName}</strong><br />{review.houseName ?? review.source}</div></article>)}</div> : <p className="notice">Опубликованных отзывов пока нет.</p>}
        </div>
      </section>

      <section className="section section-dark">
        <div className="container">
          <div className="section-heading services-heading">
            <div>
              <span className="eyebrow">Больше впечатлений</span>
              <h2>Услуги для вашего отдыха</h2>
            </div>
            <p>Дополните проживание баней, прогулкой на лодке или другими занятиями на природе.</p>
          </div>
          {services.length ? (
            <div className="home-service-grid">
              {services.slice(0, 3).map((service) => {
                const defaultOption = service.options.find((option) => option.isDefault) ?? service.options[0];
                const price = defaultOption?.price ?? service.basePrice;
                return (
                  <article className="home-service-card" key={service.id}>
                    {service.imageUrl && <Image className="home-service-image" src={service.imageUrl} alt={service.title} width={512} height={384} loading="lazy" />}
                    <div className="home-service-copy">
                      <span className="home-service-price">от {formatCurrency(price)} {priceUnitLabels[service.priceUnit]}</span>
                      <h3>{service.title}</h3>
                      <p>{service.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <p className="dark-notice">Услуги пока не опубликованы.</p>}
          <div className="services-action">
            <Link className="button button-light" href="/uslugi">Все услуги</Link>
          </div>
        </div>
      </section>

      <section className="section"><div className="container"><div className="cta"><h2>Лес уже ждет</h2><p>Выберите дом и даты. Мы подтвердим бронирование и поможем подготовить отдых под ваши пожелания.</p><Link className="button button-light" href="/domiki">Выбрать домик</Link></div></div></section>
    </PublicShell>
  );
}
