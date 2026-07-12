import Link from "next/link";
import type { House } from "@/lib/catalog";
import { HousePriceRangeText } from "@/components/house-price-range";
import { PublicImage } from "@/components/public-image";
import { normalizeHousePriceRange } from "@/lib/house-price-range";

function roomLabel(count: number) {
  const remainder = count % 100;
  if (remainder >= 11 && remainder <= 14) return "комнат";
  if (count % 10 === 1) return "комната";
  if (count % 10 >= 2 && count % 10 <= 4) return "комнаты";
  return "комнат";
}

export function HouseCard({ house }: { house: House }) {
  const priceRange = normalizeHousePriceRange(house);
  return (
    <article className="house-card">
      <div className="house-image">
        <PublicImage src={house.images[0]} context={`house-card:${house.id}`} alt={`${house.name} в усадьбе «Юдилен»`} fill sizes="(max-width: 650px) 100vw, (max-width: 950px) 50vw, 33vw" />
        {house.badgeText && <span className="house-tag">{house.badgeText}</span>}
      </div>
      <div className="house-copy">
        <h3>{house.name}</h3>
        <p>{house.description}</p>
        <div className="house-meta">
          <span>Максимум {house.guests} человек</span>
          <span>{house.rooms} {roomLabel(house.rooms)}</span>
        </div>
        <div className="house-footer">{priceRange && <span className={`price ${priceRange.maxPrice && priceRange.minPrice !== priceRange.maxPrice ? "house-price-range" : ""}`}><HousePriceRangeText range={priceRange} /></span>}<Link className="text-link" href={`/domiki/${house.slug}`}>Подробнее →</Link></div>
      </div>
    </article>
  );
}
