import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { reviews } from "@/lib/catalog";

export const metadata: Metadata = { title: "Отзывы гостей", description: "Отзывы гостей об отдыхе в усадьбе «Юдилен».", alternates: { canonical: "/otzyvy" } };

export default function ReviewsPage() {
  const allReviews = [...reviews, ...reviews.map((review, index) => ({ ...review, name: ["Олег", "Дарья", "Сергей"][index], date: "Апрель 2026" }))];
  return <PublicShell><section className="page-hero"><div className="container"><div className="breadcrumbs">Главная / Отзывы</div><h1 className="page-title">Впечатления наших гостей</h1><p className="page-intro">Честные истории о тишине, домах и маленьких деталях, из которых складывается отдых.</p></div></section><section className="section"><div className="container"><div className="section-heading"><div><span className="eyebrow">5,0 из 5</span><h2>128 отзывов</h2></div><Link className="button button-primary" href="/otzyvy/novyi">Оставить отзыв</Link></div><div className="review-grid">{allReviews.map((review, index) => <article className="review-card" key={`${review.name}-${index}`}><div className="stars">★★★★★</div><blockquote>«{review.text}»</blockquote><div className="review-byline"><strong>{review.name}</strong><br />{review.date}</div></article>)}</div></div></section></PublicShell>;
}

