import type { Metadata } from "next";
import Link from "next/link";
import { PublicImage } from "@/components/public-image";
import { PublicShell } from "@/components/public-shell";
import { getPublicGazebos } from "@/lib/gazebos";
import { DEFAULT_IMAGE_URL } from "@/lib/image-urls";

export const metadata: Metadata = {
  title: "Беседки",
  description: "Беседки на территории усадьбы «Юдилен»: фотографии, описания и удобства.",
  alternates: { canonical: "/besedki" }
};
export const dynamic = "force-dynamic";

export default async function GazebosPage() {
  const gazebos = await getPublicGazebos();
  return <PublicShell>
    <section className="page-hero"><div className="container"><div className="breadcrumbs">Главная / Беседки</div><h1 className="page-title">Беседки для отдыха на природе</h1><p className="page-intro">Выберите место для тихого обеда, вечерней встречи или отдыха после прогулки.</p></div></section>
    <section className="section"><div className="container">
      {gazebos.length ? <div className="service-grid">{gazebos.map((gazebo) => <article className="service-card" key={gazebo.id}><PublicImage src={gazebo.images[0] ?? DEFAULT_IMAGE_URL} context={`gazebo-card:${gazebo.id}`} alt={gazebo.title} width={512} height={512} loading="lazy" /><div><h2>{gazebo.title}</h2><p>{gazebo.shortDescription}</p><Link className="text-link" href={`/besedki/${gazebo.slug}`}>Подробнее →</Link></div></article>)}</div> : <p className="notice">Беседки пока не опубликованы.</p>}
    </div></section>
  </PublicShell>;
}
