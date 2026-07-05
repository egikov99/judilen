import Link from "next/link";
import { SiteBrand } from "@/components/site-brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <SiteBrand className="site-brand-footer" logoSrc="/images/judilen-strusto-logo-white.png" />
            <p style={{ maxWidth: 350, color: "rgba(255,255,255,.67)" }}>Тихое место для отдыха среди хвойного леса. Продуманные дома и искренняя забота о гостях.</p>
          </div>
          <div><div className="footer-title">Отдых</div><div className="footer-list"><Link href="/domiki">Домики</Link><Link href="/uslugi">Услуги</Link><Link href="/otzyvy">Отзывы</Link></div></div>
          <div><div className="footer-title">Информация</div><div className="footer-list"><Link href="/kontakty">Контакты</Link><Link href="/pravila">Правила проживания и бронирования</Link><Link href="/privacy">Конфиденциальность</Link></div></div>
          <div><div className="footer-title">Связаться</div><div className="footer-list"><a href="tel:+375296733546">+375 29 673 35 46</a><a href="mailto:hello@judilen.by">hello@judilen.by</a><span>Ежедневно, 09:00–21:00</span></div></div>
        </div>
        <div className="footer-bottom"><span>© 2026 База отдыха«Юдилен»</span><Link href="/terms">Пользовательское соглашение</Link></div>
      </div>
    </footer>
  );
}
