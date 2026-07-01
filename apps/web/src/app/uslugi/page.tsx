import type { Metadata } from "next";
import Image from "next/image";
import { PublicShell } from "@/components/public-shell";
import { formatCurrency } from "@/components/currency";
import { getPublicServices, priceUnitLabels } from "@/lib/services";

export const metadata: Metadata = { title: "Услуги", description: "Баня, лодки, рыбалка, трансфер и дополнительные услуги усадьбы «Юдилен».", alternates: { canonical: "/uslugi" } };
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const services = await getPublicServices();
  return (
    <PublicShell>
      <section className="page-hero"><div className="container"><div className="breadcrumbs">Главная / Услуги</div><h1 className="page-title">Ритм отдыха выбираете вы</h1><p className="page-intro">Добавьте к проживанию баню, лодку, трансфер или другие услуги.</p></div></section>
      <section className="section"><div className="container">
        {services.length ? <div className="service-grid">{services.map((service) => {
          const defaultOption = service.options.find((option) => option.isDefault) ?? service.options[0];
          const price = defaultOption?.price ?? service.basePrice;
          return <article className="service-card" key={service.id}>{service.imageUrl && <Image src={service.imageUrl} alt={service.title} width={512} height={512} loading="lazy" />}<div><span className="eyebrow">от {formatCurrency(price)} {priceUnitLabels[service.priceUnit]}</span><h2>{service.title}</h2><p>{service.description}</p>{!!service.options.length && <div className="form-stack">{service.options.map((option) => <div className="summary-row" key={option.id}><span>{option.title}</span><strong>{formatCurrency(option.price)}</strong></div>)}</div>}</div></article>;
        })}</div> : <p className="notice">Услуги пока не опубликованы.</p>}
      </div></section>
    </PublicShell>
  );
}
