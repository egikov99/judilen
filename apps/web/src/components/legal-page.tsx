import { PublicShell } from "./public-shell";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return <PublicShell><section className="page-hero"><div className="container"><div className="breadcrumbs">Главная / {title}</div><h1 className="page-title">{title}</h1></div></section><section className="section"><article className="container prose" style={{ maxWidth: 820 }}>{children}</article></section></PublicShell>;
}

