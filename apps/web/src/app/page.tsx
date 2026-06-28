import Image from "next/image";
import Link from "next/link";
import { BookingSearch } from "@/components/booking-search";
import { HouseCard } from "@/components/house-card";
import { PublicShell } from "@/components/public-shell";
import { reviews } from "@/lib/catalog";
import { getPublishedHouses } from "@/lib/houses";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const houses = await getPublishedHouses();
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: "Усадьба «Юдилен»",
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    image: "/images/stitch/asset-025.png",
    telephone: "+7 800 555-35-35",
    priceRange: "₽₽₽",
    aggregateRating: { "@type": "AggregateRating", ratingValue: "5", reviewCount: "128" }
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
          <div className="review-grid">{reviews.map((review) => <article className="review-card" key={review.name}><div className="stars">★★★★★</div><blockquote>«{review.text}»</blockquote><div className="review-byline"><strong>{review.name}</strong><br />{review.date}</div></article>)}</div>
        </div>
      </section>

      <section className="section section-dark">
        <div className="container split">
          <div>
            <span className="eyebrow">Вкус места</span>
            <h2 className="page-title">Завтрак без спешки</h2>
            <p style={{ color: "rgba(255,255,255,.72)", fontSize: 18 }}>Локальные продукты, сезонное меню и доставка прямо к вашей двери в выбранное время.</p>
            <Link className="button button-light" href="/uslugi">Посмотреть услуги</Link>
          </div>
          <Image src="/images/stitch/asset-038.png" alt="Завтрак из локальных продуктов" width={512} height={512} style={{ borderRadius: 24, width: "100%" }} />
        </div>
      </section>

      <section className="section"><div className="container"><div className="cta"><h2>Лес уже ждет</h2><p>Выберите дом и даты. Мы подтвердим бронирование и поможем подготовить отдых под ваши пожелания.</p><Link className="button button-light" href="/domiki">Выбрать домик</Link></div></div></section>
    </PublicShell>
  );
}
