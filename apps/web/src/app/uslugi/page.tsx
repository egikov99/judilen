import type { Metadata } from "next";
import Image from "next/image";
import { PublicShell } from "@/components/public-shell";
import { services } from "@/lib/catalog";

export const metadata: Metadata = { title: "Услуги", description: "Баня, завтраки, прогулки и дополнительные услуги усадьбы «Юдилен».", alternates: { canonical: "/uslugi" } };

export default function ServicesPage() {
  return <PublicShell><section className="page-hero"><div className="container"><div className="breadcrumbs">Главная / Услуги</div><h1 className="page-title">Ритм отдыха выбираете вы</h1><p className="page-intro">Добавьте к проживанию банный ритуал, завтрак или прогулку с проводником.</p></div></section><section className="section"><div className="container"><div className="service-grid">{services.map((service) => <article className="service-card" key={service.title}><Image src={service.image} alt={service.title} width={512} height={512} /><div><span className="eyebrow">{service.price}</span><h2>{service.title}</h2><p>{service.description}</p><button className="button button-primary">Добавить к поездке</button></div></article>)}</div></div></section></PublicShell>;
}

