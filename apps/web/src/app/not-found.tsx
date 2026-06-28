import Link from "next/link";
import { PublicShell } from "@/components/public-shell";

export default function NotFound() {
  return <PublicShell><section className="section"><div className="container" style={{ maxWidth: 680, textAlign: "center" }}><span className="eyebrow">Ошибка 404</span><h1 className="page-title">Эта тропа никуда не ведет</h1><p className="page-intro" style={{ marginInline: "auto" }}>Страница была перемещена или никогда не существовала.</p><Link className="button button-primary" href="/">Вернуться на главную</Link></div></section></PublicShell>;
}

