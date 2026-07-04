import Link from "next/link";
import { BookingSearch } from "@/components/booking-search";
import { HouseCard } from "@/components/house-card";
import { PublicShell } from "@/components/public-shell";
import { formatCurrency } from "@/components/currency";
import { PublicImage } from "@/components/public-image";
import { TerritoryGallery } from "@/components/territory-gallery";
import { getTerritoryGallery, TERRITORY_GALLERY_FALLBACK } from "@/lib/homepage-gallery";
import { DEFAULT_IMAGE_URL } from "@/lib/image-urls";
import { getPublishedHouses } from "@/lib/houses";
import { getPublishedReviews, getPublishedReviewStats } from "@/lib/reviews";
import { getPublicServices, priceUnitLabels } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [houses, reviews, reviewStats, services, territoryGalleryRows] = await Promise.all([
    getPublishedHouses(),
    getPublishedReviews(),
    getPublishedReviewStats(),
    getPublicServices(),
    getTerritoryGallery()
  ]);
  const territoryGallery = territoryGalleryRows.length ? territoryGalleryRows : [{
    id: "territory-fallback",
    imageUrl: TERRITORY_GALLERY_FALLBACK,
    alt: "Вид на лесное озеро из домика",
    sortOrder: 0
  }];
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
          <div className="kicker">Озеро. Природа. Семейный отдых.</div>
          <h1>Отдых на первой береговой линии озера Струсто</h1>
          <p>Агроэкоусадьба «Юдилен-Струсто» — уютное место для отдыха у воды с большой ухоженной территорией, песчаным берегом, пирсом, беседками и развлечениями для всей семьи.</p>
          <Link className="button button-light" href="#booking">Выбрать даты ↓</Link>
        </div>
      </section>
      <div className="booking-strip" id="booking"><BookingSearch /></div>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <div><span className="eyebrow">Проживание у озера</span><h2>Домики для семейного отдыха на природе</h2></div>
            <p>Комфортные домики рядом с озером Струсто: для спокойного отдыха, семейных выходных, рыбалки и прогулок по Браславщине.</p>
          </div>
          <div className="house-grid">{houses.map((house) => <HouseCard key={house.slug} house={house} />)}</div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container split">
          <TerritoryGallery images={territoryGallery} />
          <div>
            <span className="eyebrow">Территория и отдых</span>
            <h2 className="page-title">Место, где интересно и взрослым, и детям</h2>
            <p className="page-intro">На территории усадьбы есть просторные беседки с зоной барбекю, батут, детская площадка, понтонный пирс для рыбалки и песчаный берег с пологим заходом в воду.</p>
            <div className="feature-list">
              <div className="feature"><span className="feature-icon">⌂</span><div><h3>Первая береговая линия</h3><p>Озеро Струсто рядом: купание, прогулки у воды, пирс и красивые виды каждый день.</p></div></div>
              <div className="feature"><span className="feature-icon">♧</span><div><h3>Отдых для всей семьи</h3><p>Детская площадка, батут, беседки, зона барбекю и большая ухоженная территория.</p></div></div>
              <div className="feature"><span className="feature-icon">♡</span><div><h3>Живой уголок</h3><p>На территории есть домашние животные, которых можно покормить и сделать красивые фотографии.</p></div></div>
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
              <span className="eyebrow">Активный отдых</span>
              <h2>Развлечения на озере и рядом с усадьбой</h2>
            </div>
            <p>Лодки на веслах и с мотором, сапборды, лодка-барбекю до 6 человек, рыбалка с гидом и прогулки по живописным местам Браславщины.</p>
          </div>
          {services.length ? (
            <div className="home-service-grid">
              {services.slice(0, 3).map((service) => {
                const defaultOption = service.options.find((option) => option.isDefault) ?? service.options[0];
                const price = defaultOption?.price ?? service.basePrice;
                return (
                  <article className="home-service-card" key={service.id}>
                    <PublicImage className="home-service-image" src={service.images[0] ?? DEFAULT_IMAGE_URL} context={`home-service:${service.id}`} alt={service.title} width={512} height={384} loading="lazy" />
                    <div className="home-service-copy">
                      <span className="home-service-price">от {formatCurrency(price)} {priceUnitLabels[service.priceUnit]}</span>
                      <h3>{service.title}</h3>
                      <p>{service.description}</p>
                      <Link className="text-link" href={`/uslugi/${service.slug}`}>Подробнее →</Link>
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

      <section className="section"><div className="container"><div className="cta"><h2>Озеро Струсто уже ждет</h2><p>Выберите домик и даты отдыха. Мы подтвердим бронирование и поможем подобрать развлечения: баню, лодку, сапборды, рыбалку или семейный отдых у воды.</p><Link className="button button-light" href="/domiki">Выбрать домик</Link></div></div></section>
    </PublicShell>
  );
}
