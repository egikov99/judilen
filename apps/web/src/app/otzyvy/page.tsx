import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { getPublishedReviews, getPublishedReviewStats } from "@/lib/reviews";

export const metadata: Metadata = { title: "Отзывы гостей", description: "Отзывы гостей об отдыхе в усадьбе «Юдилен».", alternates: { canonical: "/otzyvy" } };
export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const [reviews, stats] = await Promise.all([getPublishedReviews(), getPublishedReviewStats()]);
  return <PublicShell><section className="page-hero"><div className="container"><div className="breadcrumbs">Главная / Отзывы</div><h1 className="page-title">Впечатления наших гостей</h1><p className="page-intro">Честные истории о тишине, домах и маленьких деталях, из которых складывается отдых.</p></div></section><section className="section"><div className="container"><div className="section-heading"><div><span className="eyebrow">{stats.average.toLocaleString("ru-RU")} из 5</span><h2>{stats.count} отзывов</h2></div><Link className="button button-primary" href="/otzyvy/novyi">Оставить отзыв</Link></div>{reviews.length ? <div className="review-grid">{reviews.map((review) => <article className="review-card" key={review.id}><div className="stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div><blockquote>«{review.text}»</blockquote><div className="review-byline"><strong>{review.customerName}</strong><br />{review.houseName ?? review.source}</div></article>)}</div> : <p className="notice">Опубликованных отзывов пока нет.</p>}</div></section></PublicShell>;
}
