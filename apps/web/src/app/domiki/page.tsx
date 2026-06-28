import type { Metadata } from "next";
import { BookingSearch } from "@/components/booking-search";
import { HouseCard } from "@/components/house-card";
import { PublicShell } from "@/components/public-shell";
import { getPublishedHouses } from "@/lib/houses";

export const metadata: Metadata = {
  title: "Домики для аренды",
  description: "Каталог домиков усадьбы «Юдилен»: цены, вместимость, удобства и свободные даты.",
  alternates: { canonical: "/domiki" }
};

export const dynamic = "force-dynamic";

export default async function HousesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const houses = await getPublishedHouses();
  const hasDates = typeof query.checkIn === "string" && typeof query.checkOut === "string";
  return (
    <PublicShell>
      <section className="page-hero"><div className="container"><div className="breadcrumbs">Главная / Домики</div><h1 className="page-title">Выберите свой дом в лесу</h1><p className="page-intro">От камерной студии для двоих до просторного дома для семьи. Во всех домах — тепло, тишина и лес за окном.</p></div></section>
      <div className="booking-strip" style={{ marginTop: -25 }}><BookingSearch /></div>
      <section className="section"><div className="container">
        {hasDates && <p className="notice" style={{ marginBottom: 25 }}>Показаны варианты на выбранные даты. Финальная доступность подтверждается при оформлении.</p>}
        <div className="house-grid">{houses.map((house) => <HouseCard key={house.slug} house={house} />)}</div>
      </div></section>
    </PublicShell>
  );
}
