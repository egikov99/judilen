import type { Metadata } from "next";
import { PublicShell } from "@/components/public-shell";

export const metadata: Metadata = { title: "Контакты и проезд", description: "Как добраться до усадьбы «Юдилен», контакты и координаты.", alternates: { canonical: "/kontakty" } };

export default function ContactsPage() {
  return <PublicShell><section className="page-hero"><div className="container"><div className="breadcrumbs">Главная / Контакты</div><h1 className="page-title">Контакты и проезд</h1><p className="page-intro">Подскажем лучший маршрут и встретим, если дорога покажется незнакомой.</p></div></section><section className="section"><div className="container contact-grid"><div className="contact-card"><span className="eyebrow">Связаться</span><h2 style={{ font: "700 31px var(--serif)" }}>Мы на связи каждый день</h2><div className="summary-row"><span>Телефон</span><a href="tel:+78005553535"><strong>+7 800 555-35-35</strong></a></div><div className="summary-row"><span>Email</span><a href="mailto:hello@judilen.ru"><strong>hello@judilen.ru</strong></a></div><div className="summary-row"><span>Навигатор</span><strong>56.3125, 38.1328</strong></div><h3>На автомобиле</h3><p>90 минут от города по шоссе, последние 4 км — хорошая лесная дорога. Парковка у каждого домика.</p><h3>Трансфер</h3><p>Организуем индивидуальную поездку от вокзала или аэропорта по предварительной заявке.</p></div><div className="map" role="img" aria-label="Карта проезда к усадьбе «Юдилен»" /></div></section></PublicShell>;
}

