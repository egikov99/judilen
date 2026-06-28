import Image from "next/image";
import Link from "next/link";
import type { House } from "@/lib/catalog";
import { formatPrice } from "@/lib/catalog";

export function HouseCard({ house }: { house: House }) {
  return (
    <article className="house-card">
      <div className="house-image">
        <Image src={house.images[0]} alt={`${house.name} в усадьбе «Юдилен»`} fill sizes="(max-width: 650px) 100vw, (max-width: 950px) 50vw, 33vw" />
        <span className="house-tag">{house.eyebrow}</span>
      </div>
      <div className="house-copy">
        <h3>{house.name}</h3>
        <p>{house.description}</p>
        <div className="house-meta"><span>До {house.guests} гостей</span><span>{house.rooms} комнаты</span></div>
        <div className="house-footer"><span className="price"><strong>{formatPrice(house.price)} ₽</strong> / ночь</span><Link className="text-link" href={`/domiki/${house.slug}`}>Подробнее →</Link></div>
      </div>
    </article>
  );
}

