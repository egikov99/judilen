import Link from "next/link";
import { SiteBrand } from "@/components/site-brand";

export function SiteHeader() {
  return (
    <header className="site-header">
      <nav className="container nav" aria-label="Основная навигация">
        <SiteBrand priority />
        <div className="nav-links">
          <Link href="/">Главная</Link>
          <Link href="/domiki">Домики</Link>
          <Link href="/uslugi">Услуги</Link>
          <Link href="/otzyvy">Отзывы</Link>
          <Link href="/kontakty">Контакты</Link>
        </div>
        <div className="nav-actions">
          <Link className="button button-ghost" href="/login">Войти</Link>
          <Link className="button button-primary" href="/domiki">Забронировать</Link>
        </div>
      </nav>
    </header>
  );
}
