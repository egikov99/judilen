import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HouseBookingCard } from "@/components/house-booking-card";
import { HouseGallery } from "@/components/house-gallery";
import { HousePriceRangeText } from "@/components/house-price-range";
import { PublicShell } from "@/components/public-shell";
import { getHouseBySlug } from "@/lib/houses";
import { normalizeHousePriceRange } from "@/lib/house-price-range";
import { getPublicServicesForHouse } from "@/lib/services";
import { safeJsonForHtml } from "@/lib/safe-json";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const house = await getHouseBySlug(slug);
  if (!house) return {};
  return {
    title: house.name,
    description: house.description,
    alternates: { canonical: `/domiki/${slug}` },
    openGraph: { title: house.name, description: house.description, images: [{ url: house.images[0] }] }
  };
}

export default async function HousePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const house = await getHouseBySlug(slug);
  if (!house) notFound();
  const services = await getPublicServicesForHouse(house.id);
  const priceRange = normalizeHousePriceRange(house);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Accommodation",
    name: house.name,
    description: house.description,
    occupancy: { "@type": "QuantitativeValue", maxValue: house.guests },
    image: house.images
  };
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonForHtml(schema) }} />
      <section className="page-hero"><div className="container"><div className="breadcrumbs">Главная / Домики / {house.name}</div>{house.badgeText && <span className="eyebrow">{house.badgeText}</span>}<h1 className="page-title">{house.name}</h1><p className="page-intro">{house.description}</p></div></section>
      <section className="section" style={{ paddingTop: 45 }}><div className="container">
        <HouseGallery houseId={house.id} houseName={house.name} images={house.images} />
        <div className="detail-layout" style={{ marginTop: 60 }}>
          <article className="prose"><span className="eyebrow">О доме</span><h2>Тишина с продуманным комфортом</h2><p>{house.longDescription}</p><h2>В доме есть</h2><ul className="amenities">{house.amenities.map((item) => <li key={item}>✓ {item}</li>)}</ul><h2>Правила</h2><p>Заезд после 14:00, выезд до 12:00. В домах не курят. Тихие часы — с 22:00 до 09:00. Размещение с питомцами согласовывается заранее.</p>{priceRange && <div className="house-detail-price"><span>Стоимость проживания</span><strong><HousePriceRangeText range={priceRange} /></strong></div>}</article>
          <HouseBookingCard house={house} services={services} />
        </div>
      </div></section>
    </PublicShell>
  );
}
