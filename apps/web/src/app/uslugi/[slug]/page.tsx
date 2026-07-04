import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatCurrency } from "@/components/currency";
import { DetailImageGallery } from "@/components/house-gallery";
import { PublicShell } from "@/components/public-shell";
import { DEFAULT_IMAGE_URL } from "@/lib/image-urls";
import { getPublicServiceBySlug, priceUnitLabels } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = await getPublicServiceBySlug(slug);
  if (!service) return {};
  return {
    title: service.title,
    description: service.description,
    alternates: { canonical: `/uslugi/${slug}` },
    openGraph: { title: service.title, description: service.description, images: [{ url: service.images[0] ?? DEFAULT_IMAGE_URL }] }
  };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await getPublicServiceBySlug(slug);
  if (!service) notFound();
  const images = service.images.length ? service.images : [DEFAULT_IMAGE_URL];
  const defaultOption = service.options.find((option) => option.isDefault) ?? service.options[0];
  const price = defaultOption?.price ?? service.basePrice;
  return <PublicShell>
    <section className="page-hero"><div className="container"><div className="breadcrumbs">Главная / Услуги / {service.title}</div><span className="eyebrow">от {formatCurrency(price)} {priceUnitLabels[service.priceUnit]}</span><h1 className="page-title">{service.title}</h1><p className="page-intro">{service.description}</p></div></section>
    <section className="section" style={{ paddingTop: 45 }}><div className="container">
      <DetailImageGallery galleryId={`service:${service.id}`} title={service.title} images={images} />
      {!!service.options.length && <div className="public-service-options"><h2>Варианты и цены</h2>{service.options.map((option) => <div className="summary-row" key={option.id}><span><strong>{option.title}</strong>{option.description && <small>{option.description}</small>}</span><strong>{formatCurrency(option.price)}</strong></div>)}</div>}
    </div></section>
  </PublicShell>;
}
