import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImageGallery } from "@/components/image-gallery";
import { PublicShell } from "@/components/public-shell";
import { getPublicGazeboBySlug } from "@/lib/gazebos";
import { DEFAULT_IMAGE_URL } from "@/lib/image-urls";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const gazebo = await getPublicGazeboBySlug(slug);
  if (!gazebo) return {};
  return {
    title: gazebo.title,
    description: gazebo.shortDescription,
    alternates: { canonical: `/besedki/${slug}` },
    openGraph: { title: gazebo.title, description: gazebo.shortDescription, images: [{ url: gazebo.images[0] ?? DEFAULT_IMAGE_URL }] }
  };
}

export default async function GazeboPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gazebo = await getPublicGazeboBySlug(slug);
  if (!gazebo) notFound();
  return <PublicShell>
    <section className="page-hero"><div className="container"><div className="breadcrumbs">Главная / Беседки / {gazebo.title}</div><h1 className="page-title">{gazebo.title}</h1><p className="page-intro">{gazebo.shortDescription}</p></div></section>
    <section className="section" style={{ paddingTop: 45 }}><div className="container">
      <ImageGallery galleryId={`gazebo:${gazebo.id}`} images={gazebo.images} fallbackImage={DEFAULT_IMAGE_URL} alt={gazebo.title} preserveAspectRatio />
      <article className="prose gazebo-detail-copy"><span className="eyebrow">О беседке</span><p>{gazebo.description}</p>{!!gazebo.amenities.length && <><h2>Характеристики и удобства</h2><ul className="amenities">{gazebo.amenities.map((item) => <li key={item}>✓ {item}</li>)}</ul></>}</article>
    </div></section>
  </PublicShell>;
}
